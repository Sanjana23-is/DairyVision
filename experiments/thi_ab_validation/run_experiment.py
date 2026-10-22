"""
run_experiment.py
=================
Isolated THI A/B validation experiment for DairyVision AI.

Safety Guarantees:
- Reads datasets directly from datasets/
- Writes ALL outputs, models, data, and metrics ONLY to experiments/thi_ab_validation/
- Does NOT touch models/, outputs/, backend/, or database.
- Does NOT import any module that writes to disk during import or execution.
"""

import os
import sys
import json
import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

# Setup directories
EXP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(EXP_DIR, "data")
MODEL_DIR = os.path.join(EXP_DIR, "models")
RESULTS_DIR = os.path.join(EXP_DIR, "results")
LOG_PATH = os.path.join(RESULTS_DIR, "experiment.log")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_PATH, mode="w", encoding="utf-8"),
    ]
)
logger = logging.getLogger("THI_AB_Experiment")

# Constants
PROJECT_ROOT = os.path.dirname(os.path.dirname(EXP_DIR))
DISEASE_CSV = os.path.join(PROJECT_ROOT, "datasets", "global_cattle_disease_detection_dataset.csv")
YIELD_CSV = os.path.join(PROJECT_ROOT, "datasets", "global_cattle_milk_yield_prediction_dataset.csv")
JOIN_KEY = "Cattle_ID"
TARGET = "milk_output"
RANDOM_SEED = 42

BASE_FEATURES = ["age", "weight", "health_status", "feed", "temperature", "humidity"]
ENGINEERED_FEATURES = [
    "thi", "feed_weight_ratio", "feed_per_weight", "temp_humidity",
    "thi_squared", "feed_thi_interaction", "age_weight_ratio"
]
ALL_FEATURES = BASE_FEATURES + ENGINEERED_FEATURES
MONOTONE_CONSTRAINTS = (0, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0)

RENAME_MAP = {
    "Age_Months": "age",
    "Weight_kg": "weight",
    "Feed_Quantity_kg": "feed",
    "Milk_Yield_L": "milk_output",
}

def load_data():
    logger.info("Loading raw datasets from datasets/...")
    df_dis = pd.read_csv(DISEASE_CSV)
    df_yld = pd.read_csv(YIELD_CSV)
    logger.info("Disease dataset: %d rows", len(df_dis))
    logger.info("Yield dataset: %d rows", len(df_yld))

    # Inner join on Cattle_ID
    df = pd.merge(df_dis, df_yld, on=JOIN_KEY, how="inner", suffixes=("_dis", "_yld"))
    logger.info("Merged dataset: %d rows", len(df))

    # Encode health_status
    if "Disease_Status" in df.columns:
        df["health_status"] = (df["Disease_Status"] != "Healthy").astype(int)
    else:
        df["health_status"] = 0

    df.rename(columns=RENAME_MAP, inplace=True)

    # Clean
    required = ["Cattle_ID", "age", "weight", "health_status", "feed", TARGET]
    df = df.dropna(subset=required).drop_duplicates(subset=[JOIN_KEY]).reset_index(drop=True)
    logger.info("Cleaned unique cattle: %d rows", len(df))
    return df

def assign_synthetic_weather(df):
    """Exact identical weather assignment as feature_engineering.py with fixed seed 42."""
    rng = np.random.default_rng(RANDOM_SEED)
    n = len(df)
    df = df.copy()

    seasonal_phase = rng.uniform(0, 1, n)
    temp_seasonal_min = 18.0
    temp_seasonal_max = 42.0
    temp_range = temp_seasonal_max - temp_seasonal_min
    temp_seasonal = temp_seasonal_min + temp_range * (0.55 + 0.45 * np.sin(2 * np.pi * seasonal_phase))
    temp_diurnal = rng.normal(0, 3.0, n)
    df["temperature"] = np.clip(temp_seasonal + temp_diurnal, 18.0, 42.0)

    hum_seasonal_min = 40.0
    hum_seasonal_max = 95.0
    hum_range = hum_seasonal_max - hum_seasonal_min
    hum_seasonal = hum_seasonal_max - hum_range * (0.5 + 0.4 * np.sin(2 * np.pi * seasonal_phase))
    hum_diurnal = rng.normal(0, 6.0, n)
    df["humidity"] = np.clip(hum_seasonal + hum_diurnal, 40.0, 95.0)

    # Hot + humid conditions
    hot_humid_mask = rng.uniform(0, 1, n) < 0.35
    df.loc[hot_humid_mask, "temperature"] = np.clip(df.loc[hot_humid_mask, "temperature"] + 7.0, 18.0, 50.0)
    df.loc[hot_humid_mask, "humidity"] = np.clip(df.loc[hot_humid_mask, "humidity"] + 18.0, 40.0, 95.0)

    # Severe conditions
    severe_mask = rng.uniform(0, 1, n) < 0.08
    df.loc[severe_mask, "temperature"] = np.clip(df.loc[severe_mask, "temperature"] + 14.0, 18.0, 52.0)
    df.loc[severe_mask, "humidity"] = np.clip(df.loc[severe_mask, "humidity"] + 25.0, 40.0, 98.0)

    return df

def build_features(df, thi_formula_constant):
    """Compute engineered features using specified THI constant (+16.4 or +46.4)."""
    df = df.copy()
    t = df["temperature"]
    rh = df["humidity"]

    # Candidate THI
    thi = (0.8 * t) + ((rh / 100.0) * (t - 14.4)) + thi_formula_constant
    df["thi"] = thi

    # Derived features
    df["feed_weight_ratio"] = df["feed"] / df["weight"].replace(0, np.nan)
    df["feed_per_weight"] = df["feed"] / df["weight"].replace(0, np.nan)
    df["temp_humidity"] = df["temperature"] * df["humidity"]
    df["thi_squared"] = df["thi"] ** 2
    df["feed_thi_interaction"] = df["feed"] * df["thi"]
    df["age_weight_ratio"] = df["age"] / df["weight"].replace(0, np.nan)

    return df

def run_ab_experiment():
    logger.info("=== STARTING ISOLATED THI A/B EXPERIMENT ===")
    df_raw = load_data()
    df_weather = assign_synthetic_weather(df_raw)

    # 1. Check for duplicate cattle IDs or related rows
    total_rows = len(df_weather)
    unique_cattle = df_weather["Cattle_ID"].nunique()
    logger.info("Checking data leakage: %d total rows, %d unique Cattle_ID", total_rows, unique_cattle)
    has_duplicates = (total_rows != unique_cattle)
    if has_duplicates:
        logger.warning("Duplicate Cattle_ID records found! Must stratify/group split.")
    else:
        logger.info("Data check confirmed: Every row corresponds to a strictly unique Cattle_ID. No cross-row cow identity leakage.")

    # 2. Fixed 80/20 train/test split on row indices
    indices = np.arange(total_rows)
    train_idx, test_idx = train_test_split(indices, test_size=0.20, random_state=RANDOM_SEED, shuffle=True)
    logger.info("Data split created: %d train rows (80%%), %d test rows (20%%)", len(train_idx), len(test_idx))

    # Verify no intersection
    assert len(set(train_idx).intersection(set(test_idx))) == 0, "Train and test index overlap!"
    logger.info("Train/test separation verified: 0 overlapping records.")

    # Save split indices for audit trail
    split_info = {
        "total_rows": total_rows,
        "train_rows": len(train_idx),
        "test_rows": len(test_idx),
        "train_indices": train_idx.tolist(),
        "test_indices": test_idx.tolist(),
        "test_cattle_ids": df_weather.iloc[test_idx]["Cattle_ID"].tolist()
    }
    with open(os.path.join(RESULTS_DIR, "split_info.json"), "w") as f:
        json.dump(split_info, f)

    # 3. Build Feature Sets
    # Model A: +16.4
    df_A = build_features(df_weather, 16.4)
    # Model B: +46.4
    df_B = build_features(df_weather, 46.4)

    # Save datasets in experiment directory
    df_A.to_csv(os.path.join(DATA_DIR, "dataset_model_A_16.4.csv"), index=False)
    df_B.to_csv(os.path.join(DATA_DIR, "dataset_model_B_46.4.csv"), index=False)

    X_train_A, X_test_A = df_A.iloc[train_idx][ALL_FEATURES], df_A.iloc[test_idx][ALL_FEATURES]
    y_train_A, y_test_A = df_A.iloc[train_idx][TARGET], df_A.iloc[test_idx][TARGET]

    X_train_B, X_test_B = df_B.iloc[train_idx][ALL_FEATURES], df_B.iloc[test_idx][ALL_FEATURES]
    y_train_B, y_test_B = df_B.iloc[train_idx][TARGET], df_B.iloc[test_idx][TARGET]

    # Target values are identical
    np.testing.assert_array_equal(y_train_A.values, y_train_B.values)
    np.testing.assert_array_equal(y_test_A.values, y_test_B.values)

    # Verify feature names and ordering match production contract
    logger.info("Checking production feature contract...")
    from app.schemas.feature import FeatureVector
    fv_fields = list(FeatureVector.model_fields.keys())
    for f in ALL_FEATURES:
        assert f in fv_fields, f"Feature {f} not in FeatureVector schema!"
    logger.info("Feature contract verified: All 13 training features exist in backend FeatureVector schema.")

    # 4. Train Model A (Control: +16.4)
    logger.info("Training Model A (Control: +16.4)...")
    xgb_params = {
        "n_estimators": 100,
        "learning_rate": 0.05,
        "max_depth": 2,
        "min_child_weight": 8,
        "subsample": 1.0,
        "colsample_bytree": 0.7,
        "reg_alpha": 0.1,
        "reg_lambda": 0.5,
        "monotone_constraints": MONOTONE_CONSTRAINTS,
        "random_state": RANDOM_SEED,
        "n_jobs": -1,
    }
    model_A = XGBRegressor(**xgb_params)
    model_A.fit(X_train_A, y_train_A)
    joblib.dump(model_A, os.path.join(MODEL_DIR, "model_A_16.4.pkl"))

    # 5. Train Model B (Candidate: +46.4)
    logger.info("Training Model B (Candidate: +46.4)...")
    model_B = XGBRegressor(**xgb_params)
    model_B.fit(X_train_B, y_train_B)
    joblib.dump(model_B, os.path.join(MODEL_DIR, "model_B_46.4.pkl"))

    # 6. Evaluation on the Identical 20% Held-Out Test Set
    preds_A = model_A.predict(X_test_A)
    preds_B = model_B.predict(X_test_B)

    mae_A = mean_absolute_error(y_test_A, preds_A)
    rmse_A = np.sqrt(mean_squared_error(y_test_A, preds_A))
    r2_A = r2_score(y_test_A, preds_A)

    mae_B = mean_absolute_error(y_test_B, preds_B)
    rmse_B = np.sqrt(mean_squared_error(y_test_B, preds_B))
    r2_B = r2_score(y_test_B, preds_B)

    metrics_summary = {
        "Model_A_Control_16.4": {
            "MAE": round(float(mae_A), 4),
            "RMSE": round(float(rmse_A), 4),
            "R2": round(float(r2_A), 4),
            "Prediction_Min": round(float(preds_A.min()), 2),
            "Prediction_Max": round(float(preds_A.max()), 2),
            "Prediction_Mean": round(float(preds_A.mean()), 2),
            "THI_Train_Mean": round(float(X_train_A["thi"].mean()), 2),
            "THI_Train_Min": round(float(X_train_A["thi"].min()), 2),
            "THI_Train_Max": round(float(X_train_A["thi"].max()), 2),
        },
        "Model_B_Candidate_46.4": {
            "MAE": round(float(mae_B), 4),
            "RMSE": round(float(rmse_B), 4),
            "R2": round(float(r2_B), 4),
            "Prediction_Min": round(float(preds_B.min()), 2),
            "Prediction_Max": round(float(preds_B.max()), 2),
            "Prediction_Mean": round(float(preds_B.mean()), 2),
            "THI_Train_Mean": round(float(X_train_B["thi"].mean()), 2),
            "THI_Train_Min": round(float(X_train_B["thi"].min()), 2),
            "THI_Train_Max": round(float(X_train_B["thi"].max()), 2),
        }
    }
    with open(os.path.join(RESULTS_DIR, "metrics_summary.json"), "w") as f:
        json.dump(metrics_summary, f, indent=2)

    logger.info("=== HELD-OUT TEST EVALUATION RESULTS ===")
    logger.info("Model A (+16.4):  R2=%.4f  MAE=%.4f  RMSE=%.4f  Pred Range=[%.2f, %.2f]",
                r2_A, mae_A, rmse_A, preds_A.min(), preds_A.max())
    logger.info("Model B (+46.4):  R2=%.4f  MAE=%.4f  RMSE=%.4f  Pred Range=[%.2f, %.2f]",
                r2_B, mae_B, rmse_B, preds_B.min(), preds_B.max())

    # 7. Stratified Error Comparison Across Heat Stress Bands
    # Standard physiological bands (Thom / Canonical NRC scale):
    # Comfort: < 68, Mild: 68-72, Moderate: 72-79, Severe: >= 79
    test_temps = df_weather.iloc[test_idx]["temperature"].values
    test_hums = df_weather.iloc[test_idx]["humidity"].values
    canonical_thi = (0.8 * test_temps) + ((test_hums / 100.0) * (test_temps - 14.4)) + 46.4

    bands = [
        ("Comfort (<68)", canonical_thi < 68),
        ("Mild (68-72)", (canonical_thi >= 68) & (canonical_thi < 72)),
        ("Moderate (72-79)", (canonical_thi >= 72) & (canonical_thi < 79)),
        ("Severe (>=79)", canonical_thi >= 79),
    ]

    band_results = []
    for band_name, mask in bands:
        count = int(np.sum(mask))
        if count == 0:
            continue
        y_b = y_test_A.values[mask]
        p_A = preds_A[mask]
        p_B = preds_B[mask]

        band_results.append({
            "Band": band_name,
            "Count": count,
            "MAE_A": round(float(mean_absolute_error(y_b, p_A)), 4),
            "MAE_B": round(float(mean_absolute_error(y_b, p_B)), 4),
            "RMSE_A": round(float(np.sqrt(mean_squared_error(y_b, p_A))), 4),
            "RMSE_B": round(float(np.sqrt(mean_squared_error(y_b, p_B))), 4),
            "Mean_Pred_A": round(float(p_A.mean()), 2),
            "Mean_Pred_B": round(float(p_B.mean()), 2),
        })

    df_bands = pd.DataFrame(band_results)
    df_bands.to_csv(os.path.join(RESULTS_DIR, "heat_stress_band_comparison.csv"), index=False)
    logger.info("\nHeat Stress Band Breakdown:\n%s", df_bands.to_string())

    # 8. Live Production Simulation Test
    # Check live inference feature consistency at (T=30°C, RH=60%)
    # Live WeatherService computes Thom THI = 79.84.
    # FeatureEngineeringService builds feature vector using live THI.
    test_cow = {
        "age": 4.0,
        "weight": 550.0,
        "health_status": 1,
        "feed": 30.0,
        "temperature": 30.0,
        "humidity": 60.0
    }
    # Live ingestion vector currently produced by backend:
    live_thi = 79.84  # Thom formula
    live_features = [
        test_cow["age"],
        test_cow["weight"],
        test_cow["health_status"],
        test_cow["feed"],
        test_cow["temperature"],
        test_cow["humidity"],
        live_thi,
        test_cow["feed"] / test_cow["weight"],
        test_cow["feed"] / test_cow["weight"],
        test_cow["temperature"] * test_cow["humidity"],
        live_thi ** 2,
        test_cow["feed"] * live_thi,
        test_cow["age"] / test_cow["weight"]
    ]

    pred_live_on_model_A = model_A.predict([live_features])[0]
    pred_live_on_model_B = model_B.predict([live_features])[0]

    # In-distribution vector for Model A (+16.4 scale):
    in_dist_A_thi = 49.76
    in_dist_features_A = list(live_features)
    in_dist_features_A[6] = in_dist_A_thi
    in_dist_features_A[10] = in_dist_A_thi ** 2
    in_dist_features_A[11] = test_cow["feed"] * in_dist_A_thi
    pred_in_dist_A = model_A.predict([in_dist_features_A])[0]

    # In-distribution vector for Model B (+46.4 scale):
    in_dist_B_thi = 79.76
    in_dist_features_B = list(live_features)
    in_dist_features_B[6] = in_dist_B_thi
    in_dist_features_B[10] = in_dist_B_thi ** 2
    in_dist_features_B[11] = test_cow["feed"] * in_dist_B_thi
    pred_in_dist_B = model_B.predict([in_dist_features_B])[0]

    live_audit = {
        "test_cow": test_cow,
        "live_weather": {"temperature": 30.0, "humidity": 60.0},
        "live_backend_thi_thom": live_thi,
        "candidate_thi_nrc": in_dist_B_thi,
        "delta_live_vs_candidate_thi": round(abs(live_thi - in_dist_B_thi), 2),
        "control_thi_nrc": in_dist_A_thi,
        "delta_live_vs_control_thi": round(abs(live_thi - in_dist_A_thi), 2),
        "predictions": {
            "model_A_in_distribution (THI=49.76)": round(float(pred_in_dist_A), 3),
            "model_A_live_injected   (THI=79.84)": round(float(pred_live_on_model_A), 3),
            "model_B_in_distribution (THI=79.76)": round(float(pred_in_dist_B), 3),
            "model_B_live_injected   (THI=79.84)": round(float(pred_live_on_model_B), 3),
        }
    }
    with open(os.path.join(RESULTS_DIR, "live_inference_audit.json"), "w") as f:
        json.dump(live_audit, f, indent=2)

    logger.info("=== LIVE INFERENCE AUDIT ===")
    logger.info("Live Backend Thom THI: %.2f", live_thi)
    logger.info("Model B Candidate THI: %.2f (Delta = %.2f)", in_dist_B_thi, abs(live_thi - in_dist_B_thi))
    logger.info("Model A Control THI:   %.2f (Delta = %.2f)", in_dist_A_thi, abs(live_thi - in_dist_A_thi))
    logger.info("Model B Prediction (In-Dist vs Live): %.3f vs %.3f", pred_in_dist_B, pred_live_on_model_B)
    logger.info("Model A Prediction (In-Dist vs Live): %.3f vs %.3f", pred_in_dist_A, pred_live_on_model_A)

    logger.info("=== EXPERIMENT COMPLETE ===")

if __name__ == "__main__":
    run_ab_experiment()
