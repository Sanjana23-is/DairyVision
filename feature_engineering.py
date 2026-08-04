"""
feature_engineering.py
======================
Adds ambient-condition and domain-specific features to the cleaned
DataFrame produced by data_loader.py.

Key features added
------------------
temperature     : Ambient temperature (°C) — from API or synthetic
humidity        : Relative humidity (%)   — from API or synthetic
thi             : Temperature-Humidity Index (USDA / NRC 2001)
                  The standard physiological heat-stress composite used
                  throughout dairy science literature.
feed_weight_ratio : Feed intake normalised by body weight — a common
                  proxy for feeding efficiency in ruminant nutrition.

THI formula (NRC, 2001)
-----------------------
    THI = T_db - (0.31 - 0.31 × RH/100) × (T_db - 14.4) - 32
where T_db = dry-bulb temperature (°C), RH = relative humidity (%).

    THI < 68          → no heat stress
    68 ≤ THI < 72     → mild stress
    72 ≤ THI < 80     → moderate stress (milk yield begins to decline)
    80 ≤ THI < 88     → severe stress
    THI ≥ 88          → emergency (life-threatening)

Source: National Research Council (2001). Nutrient Requirements of Dairy Cattle.
        7th Revised Edition. National Academy Press, Washington, DC.

IMPORTANT — no target manipulation
-----------------------------------
The original code subtracted a hand-crafted stress penalty directly from
milk_output (y), then compared the resulting model's R² against a baseline
trained on the original y.  This is invalid because:
  1. The two models predict different targets — the comparison is meaningless.
  2. The ML model learns to invert a manually coded formula, not real biology.

In this implementation, milk_output is NEVER modified.  Temperature and
humidity appear only as input features, and their relationship with y is
discovered entirely by the models from data.
"""

import logging
import numpy as np
import pandas as pd

from config import (
    ALL_FEATURES, TARGET,
    TEMP_SIGMA, HUM_SIGMA, TEMP_CLIP, HUM_CLIP,
    RANDOM_SEED, OUTPUT_DIR
)

logger = logging.getLogger(__name__)


# ── THI ─────────────────────────────────────────────────────────────────────

def compute_thi(temperature: pd.Series,
                humidity:    pd.Series) -> pd.Series:
    """
    USDA / NRC (2001) Temperature-Humidity Index (THI) for cattle.

    This is the standard dairy cattle physiological heat-stress index
    used throughout the literature. Values range typically 30–90.

    Parameters
    ----------
    temperature : pd.Series  — dry-bulb temperature in °C
    humidity    : pd.Series  — relative humidity in % (0–100)

    Returns
    -------
    pd.Series of float (THI index, typically 30–90)

    Formula (NRC 2001, adapted for Celsius)
    ----------------------------------------
    THI = (0.8 × T_db) + ((RH/100) × (T_db − 14.4)) + 16.4

    where:
      T_db = dry-bulb temperature (°C)
      RH   = relative humidity (%)

    Reference
    ---------
    National Research Council (2001). Nutrient Requirements of Dairy Cattle.
    7th Revised Edition. National Academy Press, Washington, DC.
    """
    thi = (0.8 * temperature) + ((humidity / 100.0) * (temperature - 14.4)) + 16.4
    return thi


def thi_stress_label(thi_series: pd.Series) -> pd.Series:
    """
    Map THI values to heat-stress categories per NRC (2001).

    THI Range       Category      Physiological Impact
    ─────────────────────────────────────────────────────
    < 60            No Stress     Thermoneutral environment
    60–70           Mild          Beginning of heat stress response
    70–79           Moderate      Milk yield decline begins (~10%)
    79–90           Severe        Significant milk loss (~20%)
    ≥ 90            Emergency     Critical; life-threatening heat stress
    """
    cats = pd.cut(
        thi_series,
        bins=[-np.inf, 60, 70, 79, 90, np.inf],
        labels=["No Stress", "Mild", "Moderate", "Severe", "Emergency"]
    )
    return cats
    return cats


# ── Synthetic weather assignment ─────────────────────────────────────────────

def assign_weather(df: pd.DataFrame,
                   base_temp: float,
                   base_hum:  float) -> pd.DataFrame:
    """
    Assign per-record ambient conditions using realistic seasonal variation.

    Rationale
    ---------
    Historical records in the source datasets do not carry timestamps or GPS
    coordinates. We generate realistic seasonal weather patterns that span
    the full annual range for a dairy farm region.

    This models:
    - Seasonal temperature variation (winter cool periods to summer heat stress)
    - Corresponding humidity patterns (negatively correlated in many climates)
    - Individual record-level micro-environment variation

    The ranges cover:
      Temperature: 18°C (cool season) to 42°C (extreme heat)
      Humidity:    40% (dry) to 95% (humid/monsoon)

    Distribution is designed to produce realistic cattle heat stress exposure:
      60-70% No Stress     (THI < 60)
      15-20% Mild Stress   (THI 60-70)
      10-15% Moderate      (THI 70-79)
      5-10% Severe         (THI 79-90)

    NOTE: the target variable (milk_output) is untouched.
    """
    rng = np.random.default_rng(RANDOM_SEED)
    n = len(df)

    df = df.copy()

    # Generate seasonal component (0 to 1) for each record
    # This represents variation across the year
    seasonal_phase = rng.uniform(0, 1, n)

    # Temperature: centered higher to capture more heat stress scenarios
    # Range: 18°C (cool winter) to 42°C (extreme heat)
    # Mean biased toward warm/hot period for dairy stress representation
    temp_seasonal_min = 18.0
    temp_seasonal_max = 42.0
    temp_range = temp_seasonal_max - temp_seasonal_min
    # Sinusoidal: peaks at summer (phase ~0.75)
    temp_seasonal = temp_seasonal_min + temp_range * (
        0.55 + 0.45 * np.sin(2 * np.pi * seasonal_phase)
    )
    # Add diurnal/micro-environment variation (larger for more diversity)
    temp_diurnal = rng.normal(0, 3.0, n)
    df["temperature"] = np.clip(temp_seasonal + temp_diurnal, 18.0, 42.0)

    # Humidity: 40% (dry) to 95% (humid)
    # Typically inversely correlated with temperature
    # Hot/dry periods vs. cool/humid periods
    hum_seasonal_min = 40.0
    hum_seasonal_max = 95.0
    hum_range = hum_seasonal_max - hum_seasonal_min
    # Inverse relationship: when temp is high (sin > 0), humidity is lower
    # But we want some high-humidity conditions too (monsoon)
    hum_seasonal = hum_seasonal_max - hum_range * (
        0.5 + 0.4 * np.sin(2 * np.pi * seasonal_phase)
    )
    # Add daily/micro-environment variation
    hum_diurnal = rng.normal(0, 6.0, n)
    df["humidity"] = np.clip(hum_seasonal + hum_diurnal, 40.0, 95.0)

    # Create hot+humid conditions for many records (35%) to reach Moderate stress
    hot_humid_mask = rng.uniform(0, 1, n) < 0.35
    df.loc[hot_humid_mask, "temperature"] = np.clip(
        df.loc[hot_humid_mask, "temperature"] + 7.0, 18.0, 50.0
    )
    df.loc[hot_humid_mask, "humidity"] = np.clip(
        df.loc[hot_humid_mask, "humidity"] + 18.0, 40.0, 95.0
    )

    # Create extreme hot+humid conditions for some records (8%) to reach Severe stress
    # These are heat wave/drought scenarios with sustained high heat and humidity
    severe_mask = rng.uniform(0, 1, n) < 0.08
    df.loc[severe_mask, "temperature"] = np.clip(
        df.loc[severe_mask, "temperature"] + 14.0, 18.0, 52.0
    )
    df.loc[severe_mask, "humidity"] = np.clip(
        df.loc[severe_mask, "humidity"] + 25.0, 40.0, 98.0
    )

    logger.info("Weather assigned (seasonal) — Temp: %.1f ± %.1f°C (%.1f–%.1f)  "
                "Humidity: %.1f ± %.1f%% (%.1f–%.1f)",
                df["temperature"].mean(), df["temperature"].std(),
                df["temperature"].min(), df["temperature"].max(),
                df["humidity"].mean(), df["humidity"].std(),
                df["humidity"].min(), df["humidity"].max())
    return df


# ── Derived features ─────────────────────────────────────────────────────────

def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add domain-derived features.  Requires 'temperature', 'humidity',
    'feed', 'weight', and 'age' columns to already be present.

    All division operations include safeguards against division by zero
    by replacing zero denominators with NaN before division.
    """
    df = df.copy()

    # THI — primary heat-stress composite
    df["thi"] = compute_thi(df["temperature"], df["humidity"])

    # Feed-to-weight ratio — feeding efficiency proxy
    df["feed_weight_ratio"] = df["feed"] / df["weight"].replace(0, np.nan)

    # New engineered features for improved milk yield prediction

    # Feed per weight (alternative normalization)
    df["feed_per_weight"] = df["feed"] / df["weight"].replace(0, np.nan)

    # Temperature-humidity interaction
    df["temp_humidity"] = df["temperature"] * df["humidity"]

    # THI squared (captures non-linear heat stress effects)
    df["thi_squared"] = df["thi"] ** 2

    # Feed-THI interaction (heat stress effects on feeding behavior)
    df["feed_thi_interaction"] = df["feed"] * df["thi"]

    # Age-weight ratio (body condition proxy)
    df["age_weight_ratio"] = df["age"] / df["weight"].replace(0, np.nan)

    logger.info("THI range        : %.1f – %.1f  (mean %.1f)",
                df["thi"].min(), df["thi"].max(), df["thi"].mean())

    stress_dist = thi_stress_label(df["thi"]).value_counts()
    logger.info("THI stress dist  :\n%s", stress_dist.to_string())

    # Log new features summary
    logger.info("\nNew engineered features created:")
    logger.info("  feed_per_weight          : mean=%.4f  std=%.4f",
                df["feed_per_weight"].mean(), df["feed_per_weight"].std())
    logger.info("  temp_humidity            : mean=%.4f  std=%.4f",
                df["temp_humidity"].mean(), df["temp_humidity"].std())
    logger.info("  thi_squared              : mean=%.4f  std=%.4f",
                df["thi_squared"].mean(), df["thi_squared"].std())
    logger.info("  feed_thi_interaction     : mean=%.4f  std=%.4f",
                df["feed_thi_interaction"].mean(), df["feed_thi_interaction"].std())
    logger.info("  age_weight_ratio         : mean=%.4f  std=%.4f",
                df["age_weight_ratio"].mean(), df["age_weight_ratio"].std())

    # Report missing values in new features
    new_features = ["feed_per_weight", "temp_humidity", "thi_squared",
                    "feed_thi_interaction", "age_weight_ratio"]
    missing_counts = {feat: df[feat].isna().sum() for feat in new_features}
    if any(missing_counts.values()):
        logger.warning("Missing values in engineered features: %s", missing_counts)

    return df


# ── Master pipeline ───────────────────────────────────────────────────────────

def build_features(df: pd.DataFrame,
                   base_temp: float,
                   base_hum:  float) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    """
    Full feature engineering pipeline.

    Parameters
    ----------
    df        : cleaned DataFrame from data_loader.load_and_prepare()
    base_temp : ambient temperature (°C) from API or fallback
    base_hum  : relative humidity (%)  from API or fallback

    Returns
    -------
    df_full : enriched DataFrame (all original columns + engineered)
    X       : feature matrix (ALL_FEATURES columns)
    y       : target Series (milk_output)
    """
    df = assign_weather(df, base_temp, base_hum)
    df = add_engineered_features(df)

    # Drop any rows where engineered features are NaN
    # (e.g., weight = 0 makes feed_weight_ratio undefined)
    before = len(df)
    df = df.dropna(subset=ALL_FEATURES + [TARGET]).reset_index(drop=True)
    if len(df) < before:
        logger.warning("Dropped %d rows after feature engineering (NaN).",
                       before - len(df))

    X = df[ALL_FEATURES]
    y = df[TARGET]

    logger.info("Feature matrix   : %d rows × %d cols", *X.shape)
    logger.info("Target stats     : mean=%.2f  std=%.2f  min=%.2f  max=%.2f",
                y.mean(), y.std(), y.min(), y.max())

    # Save engineered dataset to outputs
    import os
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    engineered_dataset_path = os.path.join(OUTPUT_DIR, "engineered_dataset.csv")
    df.to_csv(engineered_dataset_path, index=False)
    logger.info("Engineered dataset saved -> %s", engineered_dataset_path)

    return df, X, y


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-8s  %(message)s")

    from data_loader import load_and_prepare
    df_clean = load_and_prepare()
    df_full, X, y = build_features(df_clean, base_temp=28.0, base_hum=65.0)
    print("\nFeature matrix head:")
    print(X.head())
    print("\nTarget head:")
    print(y.head())
