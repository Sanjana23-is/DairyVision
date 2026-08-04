"""
run_pipeline.py
===============
Master orchestrator — runs the complete Smart Dairy Farm Digital Twin
pipeline in one command:

    Step 1  Weather API
    Step 2  Data loading & merging
    Step 3  Feature engineering (THI, feed/weight ratio)
    Step 4  Cross-validated model training + statistical selection
    Step 5  Model evaluation & diagnostic plots
    Step 6  Digital twin simulation + monotonicity audit
    Step 7  Consolidated results table

Usage
-----
    python run_pipeline.py [--tune]

    --tune   Enable RandomizedSearchCV hyperparameter tuning (slower).
"""

import argparse
import logging
import os
import sys
import time
import warnings

import pandas as pd

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(__file__))
from config import OUTPUT_DIR, MODEL_DIR, LOG_DIR, RESULTS_CSV, SIM_CSV
from weather import fetch_weather
from data_loader import load_and_prepare
from feature_engineering import build_features

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(LOG_DIR,    exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, "pipeline.log"), mode="w"),
    ],
)
logger = logging.getLogger(__name__)

DIVIDER = "=" * 70


def step(n: int, title: str):
    logger.info("\n%s\n  STEP %d: %s\n%s", DIVIDER, n, title, DIVIDER)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true",
                        help="Run hyperparameter tuning (adds ~5 min).")
    args = parser.parse_args()

    t0 = time.time()

    print(DIVIDER)
    print("  SMART DAIRY FARM DIGITAL TWIN  —  Full Pipeline")
    print(DIVIDER)

    # ── Step 1: Weather ───────────────────────────────────────────────────────
    step(1, "Real-time weather fetch (Open-Meteo API)")
    base_temp, base_hum = fetch_weather()
    logger.info("Ambient conditions: %.1f°C  %.1f%% RH", base_temp, base_hum)

    # ── Step 2: Data loading ──────────────────────────────────────────────────
    step(2, "Data loading, merging & cleaning")
    df_clean = load_and_prepare()

    # ── Step 3: Feature engineering ───────────────────────────────────────────
    step(3, "Feature engineering (THI, feed/weight ratio, weather)")
    df_full, X, y = build_features(df_clean, base_temp, base_hum)
    logger.info("Final feature matrix: %d rows × %d features", *X.shape)
    logger.info("Features: %s", list(X.columns))

    # ── Step 4: Training ──────────────────────────────────────────────────────
    step(4, "Cross-validated model training + statistical selection")
    # Import here to avoid circular logging setup conflicts
    from train import main as train_main
    sys.argv = ["train.py"] + (["--tune"] if args.tune else [])
    best_name, df_cv, X_tr, y_tr = train_main()

    # ── Step 5: Evaluation ────────────────────────────────────────────────────
    step(5, "Model evaluation, diagnostics & plots")
    from evaluate import main as eval_main
    eval_main()

    # ── Explainability: SHAP outputs (saved under outputs/shap/) ───────────────
    logger.info("Generating SHAP explainability outputs")
    try:
        from explainability import generate_shap_reports
        generate_shap_reports(X, df_full=df_full)
    except Exception as e:
        logger.exception("SHAP explainability generation failed: %s", e)

    # ── Step 6: Anomaly detection and reporting ────────────────────────────────
    step(6, "Anomaly detection and reporting")
    try:
        from anomaly_detection import generate_anomaly_reports
        generate_anomaly_reports(df_full)
    except Exception as e:
        logger.exception("Anomaly detection failed: %s", e)

    # ── Step 7: Health alerts and decision support ────────────────────────────
    step(7, "Health alerts and decision support")
    try:
        from health_alerts import generate_health_alerts
        generate_health_alerts(df_full, base_temp=base_temp, base_hum=base_hum)
    except Exception as e:
        logger.exception("Health alert generation failed: %s", e)

    # ── Step 8: Digital twin what-if simulation ───────────────────────────────
    step(8, "Digital twin what-if simulation")
    from simulate import main as sim_main
    sim_main()

    # ── Step 7: Consolidated summary ──────────────────────────────────────────
    step(7, "Consolidated results for paper")

    df_cv_loaded = pd.read_csv(RESULTS_CSV)
    summary = (
        df_cv_loaded.groupby("Model")[["R2", "MAE", "RMSE"]]
        .agg(["mean", "std"])
        .round(4)
    )
    summary.columns = ["_".join(c) for c in summary.columns]
    summary = summary.sort_values("R2_mean", ascending=False)
    summary.to_csv(os.path.join(OUTPUT_DIR, "paper_table_model_comparison.csv"))

    elapsed = time.time() - t0
    print("\n" + DIVIDER)
    print(" PIPELINE COMPLETE")
    print(DIVIDER)
    print(f"  Total time  : {elapsed:.1f} s")
    print(f"  Best model  : {best_name}")
    print(f"  Outputs in  : {OUTPUT_DIR}/")
    print(f"  Model saved : {MODEL_DIR}/best_milk_model.pkl")
    print(DIVIDER)
    print("\nKey output files:")
    for fname in [
        "cv_results.csv",
        "test_metrics.csv",
        "feature_importance.csv",
        "anomaly_report.csv",
        "anomaly_summary.md",
        "anomaly_visualization.png",
        "health_alerts.csv",
        "health_alert_summary.md",
        "simulation_results.csv",
        "paper_table_model_comparison.csv",
        "predicted_vs_actual.png",
        "cv_r2_boxplot.png",
        "feature_importance.png",
        "simulation_feedlines.png",
        "simulation_heatmap.png",
        "simulation_thi_impact.png",
        "monotonicity_report.txt",
    ]:
        path = os.path.join(OUTPUT_DIR, fname)
        exists = "✓" if os.path.exists(path) else "✗ MISSING"
        print(f"  {exists}  {fname}")


if __name__ == "__main__":
    main()
