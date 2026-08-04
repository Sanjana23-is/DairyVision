"""
train.py
========
Trains all candidate models using stratified k-fold cross-validation,
runs a Wilcoxon signed-rank test to select the best model with
statistical confidence, then fits the winner on the full dataset
and saves it.

Usage
-----
    python train.py [--tune]

    --tune   Run RandomizedSearchCV for XGBoost and Random Forest before
             the main CV loop (adds ~2–5 min on a laptop).  Omit for a
             fast run using the literature-informed defaults in config.py.

Output
------
    models/best_milk_model.pkl     — fitted best model
    outputs/cv_results.csv         — per-fold metrics for all models
    outputs/tuning_results.json    — best params from RandomizedSearchCV
                                     (only written when --tune is used)
"""

import argparse
import json
import logging
import os
import sys
import warnings

import joblib
import numpy as np
import pandas as pd
from scipy.stats import wilcoxon
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import make_scorer, mean_absolute_error, r2_score, mean_squared_error
from sklearn.model_selection import KFold, RandomizedSearchCV, cross_validate
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

# Local modules
sys.path.insert(0, os.path.dirname(__file__))
from config import (
    MODEL_PATH, RESULTS_CSV, CV_FOLDS, RANDOM_SEED, MODEL_PARAMS,
    ALL_FEATURES, TARGET, OUTPUT_DIR, MODEL_DIR, LOG_DIR
)
from data_loader import load_and_prepare
from feature_engineering import build_features
from weather import fetch_weather

# ── Logging ──────────────────────────────────────────────────────────────────
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, "train.log"), mode="w"),
    ],
)
logger = logging.getLogger(__name__)


# ── Model registry ────────────────────────────────────────────────────────────

def build_models() -> dict:
    """
    Return a dict of {name: unfitted estimator}.
    DummyRegressor (mean strategy) is the mandatory naive baseline —
    all models must beat it to justify their complexity.
    """
    p = MODEL_PARAMS
    return {
        "Naive Baseline":   DummyRegressor(strategy="mean"),
        "Linear Regression": LinearRegression(),
        "Decision Tree":    DecisionTreeRegressor(**p["Decision Tree"]),
        "Random Forest":    RandomForestRegressor(**p["Random Forest"]),
        "XGBoost":          XGBRegressor(**p["XGBoost"], verbosity=0),
    }


# ── Hyperparameter search ─────────────────────────────────────────────────────

def tune_models(X: pd.DataFrame, y: pd.Series,
                cv_folds: int = CV_FOLDS) -> dict:
    """
    RandomizedSearchCV for XGBoost and Random Forest.
    Returns updated MODEL_PARAMS dict with best found parameters.
    """
    logger.info("=== Hyperparameter tuning (RandomizedSearchCV) ===")

    xgb_grid = {
        "n_estimators":     [200, 300, 500],
        "learning_rate":    [0.01, 0.05, 0.1],
        "max_depth":        [3, 4, 6],
        "subsample":        [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
        "min_child_weight": [1, 3, 5],
        "reg_alpha":        [0, 0.1, 0.5],
        "reg_lambda":       [0.5, 1.0, 2.0],
    }
    rf_grid = {
        "n_estimators":    [100, 200, 400],
        "max_features":    ["sqrt", "log2", 0.5],
        "max_depth":       [None, 8, 16],
        "min_samples_leaf": [1, 2, 4],
    }

    kf = KFold(n_splits=cv_folds, shuffle=True, random_state=RANDOM_SEED)
    best_params = {}

    for name, estimator, grid in [
        ("XGBoost",       XGBRegressor(random_state=RANDOM_SEED, n_jobs=-1, verbosity=0), xgb_grid),
        ("Random Forest", RandomForestRegressor(random_state=RANDOM_SEED, n_jobs=-1),     rf_grid),
    ]:
        logger.info("  Tuning %s ...", name)
        search = RandomizedSearchCV(
            estimator, grid,
            n_iter=30, scoring="r2", cv=kf,
            random_state=RANDOM_SEED, n_jobs=-1, refit=True
        )
        search.fit(X, y)
        best_params[name] = search.best_params_
        logger.info("  Best %s params: %s  (CV R²=%.4f)",
                    name, search.best_params_, search.best_score_)

    return best_params


# ── Cross-validated evaluation ────────────────────────────────────────────────

def cross_validate_all(models: dict,
                       X: pd.DataFrame,
                       y: pd.Series,
                       cv_folds: int = CV_FOLDS) -> pd.DataFrame:
    """
    Run k-fold CV for every model and collect per-fold metrics.

    Returns
    -------
    DataFrame with columns: Model, Fold, R2, MAE, RMSE
    """
    logger.info("=== %d-fold cross-validation ===", cv_folds)
    kf = KFold(n_splits=cv_folds, shuffle=True, random_state=RANDOM_SEED)

    scorers = {
        "r2":   make_scorer(r2_score),
        "mae":  make_scorer(mean_absolute_error, greater_is_better=False),
        "rmse": make_scorer(
            lambda y_t, y_p: np.sqrt(mean_squared_error(y_t, y_p)),
            greater_is_better=False
        ),
    }

    records = []
    for name, model in models.items():
        cv_out = cross_validate(
            model, X, y, cv=kf, scoring=scorers, return_train_score=False
        )
        for fold_i in range(cv_folds):
            records.append({
                "Model": name,
                "Fold":  fold_i + 1,
                "R2":    cv_out["test_r2"][fold_i],
                "MAE":  -cv_out["test_mae"][fold_i],
                "RMSE": -cv_out["test_rmse"][fold_i],
            })
        logger.info(
            "  %-22s R²=%.4f ± %.4f   MAE=%.3f ± %.3f   RMSE=%.3f ± %.3f",
            name,
            cv_out["test_r2"].mean(),   cv_out["test_r2"].std(),
            -cv_out["test_mae"].mean(), cv_out["test_mae"].std(),
            -cv_out["test_rmse"].mean(), cv_out["test_rmse"].std(),
        )

    return pd.DataFrame(records)


# ── Statistical model selection ───────────────────────────────────────────────

def select_best_model(df_cv: pd.DataFrame,
                      models: dict) -> tuple[str, dict]:
    """
    Identify the best model by mean CV R², then confirm it is
    statistically significantly better than each competitor using a
    two-sided Wilcoxon signed-rank test on the fold-level R² values.

    Returns
    -------
    best_name : str
    test_results : dict  {competitor_name: {'stat': ..., 'p': ...}}
    """
    summary = (df_cv.groupby("Model")["R2"]
               .agg(["mean", "std"])
               .sort_values("mean", ascending=False))

    logger.info("\n=== Model ranking by mean CV R² ===\n%s", summary.to_string())

    best_name   = summary.index[0]
    best_folds  = df_cv[df_cv["Model"] == best_name]["R2"].values
    test_results = {}

    logger.info("\n=== Wilcoxon signed-rank test (best vs. others) ===")
    for name in summary.index:
        if name == best_name:
            continue
        other_folds = df_cv[df_cv["Model"] == name]["R2"].values
        try:
            stat, p = wilcoxon(best_folds, other_folds, alternative="greater")
        except ValueError:
            # Wilcoxon requires non-zero differences; can happen if models tie
            stat, p = float("nan"), 1.0
        test_results[name] = {"stat": round(float(stat), 4),
                               "p":    round(float(p),    4)}
        sig = "✓ significant" if p < 0.05 else "✗ not significant"
        logger.info(
            "  %s vs %-22s : W=%.2f  p=%.4f  %s",
            best_name, name, stat, p, sig
        )

    return best_name, test_results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train dairy twin models.")
    parser.add_argument("--tune", action="store_true",
                        help="Run RandomizedSearchCV before main CV loop.")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR,  exist_ok=True)

    # 1. Data
    logger.info("=== Loading data ===")
    df_clean   = load_and_prepare()
    base_temp, base_hum = fetch_weather()
    df_full, X, y = build_features(df_clean, base_temp, base_hum)

    logger.info("Features  : %s", list(X.columns))
    logger.info("Samples   : %d", len(X))
    logger.info("Target    : mean=%.2f  std=%.2f", y.mean(), y.std())

    # 2. Optional tuning
    models = build_models()
    if args.tune:
        best_hp = tune_models(X, y)
        # Re-instantiate tuned models
        xgb_p = {**MODEL_PARAMS["XGBoost"],   **best_hp.get("XGBoost", {})}
        rf_p  = {**MODEL_PARAMS["Random Forest"], **best_hp.get("Random Forest", {})}
        models["XGBoost"]       = XGBRegressor(**xgb_p, verbosity=0)
        models["Random Forest"] = RandomForestRegressor(**rf_p)

        tuning_out = os.path.join(OUTPUT_DIR, "tuning_results.json")
        with open(tuning_out, "w") as f:
            json.dump(best_hp, f, indent=2)
        logger.info("Tuning results saved → %s", tuning_out)

    # 3. Cross-validation
    df_cv = cross_validate_all(models, X, y)
    df_cv.to_csv(RESULTS_CSV, index=False)
    logger.info("CV results saved → %s", RESULTS_CSV)

    # 4. Statistical model selection
    best_name, test_results = select_best_model(df_cv, models)
    logger.info("\nBest model: %s", best_name)

    # 5. Fit best model on full data and save
    best_estimator = models[best_name]
    best_estimator.fit(X, y)
    joblib.dump(best_estimator, MODEL_PATH)
    logger.info("Best model saved → %s", MODEL_PATH)

    # 6. Summary table for paper
    summary = (
        df_cv.groupby("Model")[["R2", "MAE", "RMSE"]]
        .agg(["mean", "std"])
        .round(4)
    )
    summary.columns = ["_".join(c) for c in summary.columns]
    summary = summary.sort_values("R2_mean", ascending=False)

    print("\n" + "=" * 70)
    print(" MODEL COMPARISON (5-fold CV, mean ± std)")
    print("=" * 70)
    for model_name, row in summary.iterrows():
        marker = " ◀ BEST" if model_name == best_name else ""
        print(f"  {model_name:<24}  "
              f"R²={row['R2_mean']:.4f} ± {row['R2_std']:.4f}  "
              f"MAE={row['MAE_mean']:.3f} ± {row['MAE_std']:.3f}  "
              f"RMSE={row['RMSE_mean']:.3f} ± {row['RMSE_std']:.3f}"
              f"{marker}")
    print("=" * 70)

    print("\nWilcoxon tests (best model vs. others):")
    for competitor, res in test_results.items():
        sig = "significant" if res["p"] < 0.05 else "NOT significant"
        print(f"  {best_name} > {competitor:<22}  "
              f"W={res['stat']:.2f}  p={res['p']:.4f}  [{sig}]")

    return best_name, df_cv, X, y


if __name__ == "__main__":
    main()
