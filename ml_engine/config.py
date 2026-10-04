"""
config.py
=========
Central configuration for the Smart Dairy Farm Digital Twin project.
All paths, hyperparameters, and constants are defined here so that
every other module imports from a single source of truth.
"""

import os

# ── Paths ───────────────────────────────────────────────────────────────────
# Root of repository: one level up from ml_engine/
BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR  = os.path.join(BASE_DIR, "datasets")
OUTPUT_DIR   = os.path.join(BASE_DIR, "outputs")
MODEL_DIR    = os.path.join(BASE_DIR, "models")
LOG_DIR      = os.path.join(BASE_DIR, "logs")

DISEASE_CSV  = os.path.join(DATASET_DIR, "global_cattle_disease_detection_dataset.csv")
YIELD_CSV    = os.path.join(DATASET_DIR, "global_cattle_milk_yield_prediction_dataset.csv")

MODEL_PATH   = os.path.join(MODEL_DIR,  "best_milk_model.pkl")
RESULTS_CSV  = os.path.join(OUTPUT_DIR, "cv_results.csv")
SIM_CSV      = os.path.join(OUTPUT_DIR, "simulation_results.csv")

# ── Dataset join ────────────────────────────────────────────────────────────
JOIN_KEY = "Cattle_ID"          # explicit — never use set-intersection

# ── Column rename map ────────────────────────────────────────────────────────
RENAME_MAP = {
    "Age_Months":       "age",
    "Weight_kg":        "weight",
    "Feed_Quantity_kg": "feed",
    "Milk_Yield_L":     "milk_output",
}

# ── Features used for modelling ──────────────────────────────────────────────
# Engineered features are created inside feature_engineering.py
BASE_FEATURES = ["age", "weight", "health_status", "feed",
                 "temperature", "humidity"]
ENGINEERED_FEATURES = ["thi", "feed_weight_ratio", "feed_per_weight",
                       "temp_humidity", "thi_squared", "feed_thi_interaction",
                       "age_weight_ratio"]
ALL_FEATURES  = BASE_FEATURES + ENGINEERED_FEATURES
TARGET        = "milk_output"

# ── Weather fallback (used if API fails) ────────────────────────────────────
FALLBACK_TEMP = 28.0   # °C   — Bangalore annual average
FALLBACK_HUM  = 65.0   # %
WEATHER_LAT   = 12.97
WEATHER_LON   = 77.59

# Gaussian noise parameters for synthetic micro-environment assignment
# These represent typical diurnal range for the study region
TEMP_SIGMA = 2.5   # °C
HUM_SIGMA  = 7.5   # %
TEMP_CLIP  = (5.0,  50.0)
HUM_CLIP   = (10.0, 100.0)

RANDOM_SEED = 42

# ── Cross-validation ─────────────────────────────────────────────────────────
CV_FOLDS = 5

# ── Monotonicity constraints (biological directional consistency) ─────────────
# Directional constraints for XGBoost over ALL_FEATURES:
#   age:                  0 (unconstrained)
#   weight:               1 (heavier cow -> higher yield capacity)
#   health_status:        0 (unconstrained)
#   feed:                 1 (higher feed intake -> higher or equal milk yield)
#   temperature:          0 (unconstrained)
#   humidity:             0 (unconstrained)
#   thi:                  0 (unconstrained)
#   feed_weight_ratio:    1 (higher feed/weight ratio -> non-decreasing yield)
#   feed_per_weight:      1 (higher feed/weight ratio -> non-decreasing yield)
#   temp_humidity:        0 (unconstrained)
#   thi_squared:          0 (unconstrained)
#   feed_thi_interaction: 1 (positive interaction slope with feeding)
#   age_weight_ratio:     0 (unconstrained)
MONOTONE_CONSTRAINTS = (0, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0)

# ── Model hyperparameters (literature-informed starting points) ──────────────
MODEL_PARAMS = {
    "XGBoost": {
        "n_estimators":         100,
        "learning_rate":        0.05,
        "max_depth":            2,
        "min_child_weight":     8,
        "subsample":            1.0,
        "colsample_bytree":     0.7,
        "reg_alpha":            0.1,
        "reg_lambda":           0.5,
        "monotone_constraints": MONOTONE_CONSTRAINTS,
        "random_state":         RANDOM_SEED,
        "n_jobs":               -1,
    },
    "Random Forest": {
        "n_estimators": 300,
        "max_features": "sqrt",
        "max_depth":    None,
        "min_samples_leaf": 2,
        "random_state": RANDOM_SEED,
        "n_jobs":       -1,
    },
    "Decision Tree": {
        "max_depth":        8,
        "min_samples_leaf": 4,
        "random_state":     RANDOM_SEED,
    },
}

# ── Digital-twin simulation grid ─────────────────────────────────────────────
SIM_FEED_RANGE   = list(range(10, 36, 2))      # kg/day
SIM_TEMP_RANGE   = [18, 24, 30, 36, 42]        # °C  (comfort → severe heat)
SIM_HUM_FIXED    = FALLBACK_HUM                # hold humidity at baseline
SIM_PI_ALPHA     = 0.90                        # prediction interval coverage

# ── THI thresholds (USDA / NRC 2001) ────────────────────────────────────────
# Corrected formula: THI = (0.8 × T) + ((RH/100) × (T − 14.4)) + 16.4
# Standard physiological heat-stress boundaries for dairy cattle
THI_COMFORT    = 60   # < 60: no stress (thermoneutral)
THI_MILD       = 70   # 60–70: mild stress begins
THI_MODERATE   = 79   # 70–79: moderate stress (milk yield -10%)
THI_SEVERE     = 90   # 79–90: severe stress (milk yield -20%+)
                      # ≥ 90: emergency (life-threatening)
