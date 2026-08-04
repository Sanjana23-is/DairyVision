"""Train and evaluate genetics models for sire milk yield prediction."""
import os
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_validate
from xgboost import XGBRegressor

from genetics.load_data import REQUIRED_COLUMNS

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")


def get_models() -> dict[str, Any]:
    return {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=200,
            max_depth=6,
            random_state=42,
            n_jobs=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            random_state=42,
            verbosity=0,
            n_jobs=-1,
        ),
    }


def evaluate_models(df: pd.DataFrame, target_column: str = "Total_Milk_Yield") -> pd.DataFrame:
    features = [c for c in df.columns if c not in {"Sire_ID", target_column}]
    X = df[features].astype(float)
    y = df[target_column].astype(float)

    models = get_models()
    results = []
    for name, model in models.items():
        scores = cross_validate(
            model,
            X,
            y,
            cv=5,
            scoring=["r2", "neg_mean_absolute_error", "neg_root_mean_squared_error"],
            return_train_score=False,
            n_jobs=-1,
        )
        results.append({
            "Model": name,
            "R2_Mean": np.mean(scores["test_r2"]),
            "R2_STD": np.std(scores["test_r2"]),
            "MAE_Mean": -np.mean(scores["test_neg_mean_absolute_error"]),
            "RMSE_Mean": -np.mean(scores["test_neg_root_mean_squared_error"]),
        })
    return pd.DataFrame(results).sort_values("R2_Mean", ascending=False).reset_index(drop=True)


def train_models(df: pd.DataFrame, target_column: str = "Total_Milk_Yield") -> dict[str, Any]:
    features = [c for c in df.columns if c not in {"Sire_ID", target_column}]
    X = df[features].astype(float)
    y = df[target_column].astype(float)

    models = get_models()
    trained = {}
    for name, model in models.items():
        model.fit(X, y)
        trained[name] = model
    return trained


def get_feature_importances(models: dict[str, Any], df: pd.DataFrame, target_column: str = "Total_Milk_Yield") -> pd.DataFrame:
    features = [c for c in df.columns if c not in {"Sire_ID", target_column}]
    rows = []
    for name, model in models.items():
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
        elif hasattr(model, "coef_"):
            importances = np.abs(model.coef_)
        else:
            importances = np.zeros(len(features))
        for feat, imp in zip(features, importances):
            rows.append({"Model": name, "Feature": feat, "Importance": float(imp)})
    return pd.DataFrame(rows).sort_values(["Model", "Importance"], ascending=[True, False])


def save_model_comparison(df: pd.DataFrame) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "genetics_model_comparison.csv")
    df.to_csv(path, index=False)
    return path


def save_feature_importance(df: pd.DataFrame) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "genetics_feature_importance.csv")
    df.to_csv(path, index=False)
    return path
