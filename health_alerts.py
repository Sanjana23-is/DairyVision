"""
health_alerts.py
================
Generate actionable health alerts for dairy farmers using THI thresholds
and predicted yield decline.

Exports:
- outputs/health_alerts.csv
- outputs/health_alert_summary.md
"""

import logging
import os

import joblib
import numpy as np
import pandas as pd

from config import ALL_FEATURES, FALLBACK_TEMP, FALLBACK_HUM, MODEL_PATH, OUTPUT_DIR
from feature_engineering import add_engineered_features, thi_stress_label

logger = logging.getLogger(__name__)


def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def _load_engineered_dataset() -> pd.DataFrame:
    engineered_path = os.path.join(OUTPUT_DIR, "engineered_dataset.csv")
    if not os.path.exists(engineered_path):
        raise FileNotFoundError(
            f"Engineered dataset not found at {engineered_path}. "
            "Run run_pipeline.py or feature_engineering.py to generate it."
        )

    df = pd.read_csv(engineered_path)
    missing = set(ALL_FEATURES) - set(df.columns)
    if missing:
        raise ValueError(
            f"Engineered dataset is missing required model features: {sorted(missing)}"
        )
    return df


def _prepare_health_df(df: pd.DataFrame | None = None,
                       base_temp: float | None = None,
                       base_hum: float | None = None) -> pd.DataFrame:
    # Prefer the persisted engineered dataset from Step 3 so health alerts use the
    # exact THI values and model feature set produced during training.
    df = _load_engineered_dataset()

    if df is None:
        raise ValueError("No input data available for health alert generation.")

    df["stress_category"] = thi_stress_label(df["thi"])
    return df


def _classify_alert(row):
    thi = row["thi"]
    decline = row["predicted_decline_pct"]

    if thi >= 90 or decline > 20:
        return ("Health Risk Alert", "Critical",
                "Critical heat stress or productivity decline detected."
                " Consider emergency cooling, veterinary assessment, and hydration.")
    if thi >= 79:
        return ("Heat Stress Alert", "High",
                "High heat stress detected. Consider active cooling, shading,"
                " and improved hydration measures.")
    if decline > 20:
        return ("Productivity Alert", "Critical",
                "Predicted yield decline exceeds 20%. Evaluate nutrition and heat"
                " mitigation immediately.")
    if decline > 10:
        return ("Productivity Alert", "High",
                "Predicted yield decline exceeds 10%. Review feeding and environmental"
                " conditions to prevent further drop.")
    if thi >= 70:
        return ("Heat Stress Alert", "Medium",
                "Moderate heat stress detected. Monitor cattle closely and provide"
                " ventilation and water access.")
    return ("No Alert", "Low",
            "Conditions are within expected range; continue routine monitoring.")


def _baseline_conditions(df: pd.DataFrame) -> pd.DataFrame:
    baseline = df.copy()
    baseline["temperature"] = 20.0
    baseline["humidity"] = 50.0

    feature_logger = logging.getLogger("feature_engineering")
    prev_disabled = feature_logger.disabled
    feature_logger.disabled = True
    try:
        baseline = add_engineered_features(baseline)
    finally:
        feature_logger.disabled = prev_disabled

    return baseline


def generate_health_alerts(df_full: pd.DataFrame | None = None,
                           base_temp: float | None = None,
                           base_hum: float | None = None) -> dict[str, str]:
    _ensure_output_dir()

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}. Run train.py first.")

    model = joblib.load(MODEL_PATH)
    df = _prepare_health_df(df_full, base_temp, base_hum)

    X = df[ALL_FEATURES]
    df["predicted_yield"] = model.predict(X)

    baseline_df = _baseline_conditions(df)
    X_base = baseline_df[ALL_FEATURES]
    df["baseline_yield"] = model.predict(X_base)

    df["predicted_decline_pct"] = np.where(
        df["baseline_yield"] > 0,
        100.0 * (df["baseline_yield"] - df["predicted_yield"]) / df["baseline_yield"],
        0.0,
    )

    alert_data = df.apply(lambda row: _classify_alert(row), axis=1)
    df[["alert_category", "severity", "recommendation"]] = pd.DataFrame(
        alert_data.tolist(), index=df.index
    )

    df_out = df.copy()
    output_cols = [
        "Cattle_ID", "age", "weight", "feed", "thi", "temperature", "humidity",
        "predicted_yield", "baseline_yield", "predicted_decline_pct",
        "alert_category", "severity", "recommendation"
    ]
    csv_path = os.path.join(OUTPUT_DIR, "health_alerts.csv")
    df_out.to_csv(csv_path, index=False, columns=output_cols)

    summary_path = os.path.join(OUTPUT_DIR, "health_alert_summary.md")
    with open(summary_path, "w") as fh:
        fh.write("# Health Alert Summary\n\n")
        fh.write("Actionable health alerts for dairy farmers based on THI and predicted yield decline.\n\n")

        counts = df_out["alert_category"].value_counts().reindex(
            ["Health Risk Alert", "Heat Stress Alert", "Productivity Alert", "No Alert"], fill_value=0
        )
        fh.write("## Alert counts\n")
        for name, count in counts.items():
            fh.write(f"- {name}: {count}\n")
        fh.write("\n")

        sev = df_out["severity"].value_counts().reindex(
            ["Critical", "High", "Medium", "Low"], fill_value=0
        )
        fh.write("## Severity summary\n")
        for level, count in sev.items():
            fh.write(f"- {level}: {count}\n")
        fh.write("\n")

        stress_counts = df_out["stress_category"].value_counts().reindex(
            ["No Stress", "Mild", "Moderate", "Severe", "Emergency"], fill_value=0
        )
        fh.write("## THI stress category distribution\n")
        for category, count in stress_counts.items():
            fh.write(f"- {category}: {count}\n")
        fh.write("\n")

        fh.write("## Recommendation examples\n")
        sample = df_out[df_out["alert_category"] != "No Alert"].head(5)
        for _, row in sample.iterrows():
            fh.write(
                f"- {row['Cattle_ID']}: {row['alert_category']} ({row['severity']}) — "
                f"{row['recommendation']}\n"
            )
        fh.write("\n")
        fh.write("## Alert rules\n")
        fh.write("- THI >= 70: Heat Stress Alert\n")
        fh.write("- THI >= 79: Heat Stress Alert (High)\n")
        fh.write("- THI >= 90: Health Risk Alert (Critical)\n")
        fh.write("- Predicted yield decline > 10%: Productivity Alert\n")
        fh.write("- Predicted yield decline > 20%: Health Risk Alert / Critical\n")

    return {
        "csv": csv_path,
        "summary": summary_path,
    }


if __name__ == "__main__":
    import sys
    from data_loader import load_and_prepare
    from feature_engineering import build_features

    df_clean = load_and_prepare()
    df_full, X, y = build_features(df_clean, base_temp=28.0, base_hum=65.0)
    print(generate_health_alerts(df_full))
