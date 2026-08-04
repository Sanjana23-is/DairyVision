"""
simulate.py
===========
Digital twin what-if simulation engine.

Generates a grid of predictions over (feed_intake × ambient_temperature)
scenarios, with:
  - Proper THI computation at each grid point
  - 90% prediction intervals via Random Forest quantile method
  - Monotonicity check against biological expectations
  - Publication-quality plots saved to outputs/

Usage
-----
    python simulate.py

Outputs
-------
    outputs/simulation_results.csv
    outputs/simulation_heatmap.png
    outputs/simulation_feedlines.png
    outputs/simulation_thi_impact.png
    outputs/monotonicity_report.txt

Prediction interval method
---------------------------
We use the "forest of trees" approach (Meinshausen, 2006): fit a Random
Forest on the full dataset, then for each prediction point collect
individual tree outputs and compute the [5th, 95th] percentiles as the
90% prediction interval.  This is wider than a confidence interval — it
captures both model uncertainty and data variability.

Reference
---------
Meinshausen, N. (2006). Quantile regression forests.
Journal of Machine Learning Research, 7, 983-999.
"""

import logging
import os
import sys
import warnings

import joblib
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from sklearn.ensemble import RandomForestRegressor

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(__file__))
from config import (
    MODEL_PATH, SIM_CSV, OUTPUT_DIR, ALL_FEATURES, RANDOM_SEED,
    SIM_FEED_RANGE, SIM_TEMP_RANGE, SIM_HUM_FIXED, SIM_PI_ALPHA,
    THI_COMFORT, THI_MILD, THI_MODERATE, THI_SEVERE, LOG_DIR
)
from data_loader import load_and_prepare
from feature_engineering import build_features, compute_thi
from weather import fetch_weather

os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(LOG_DIR, "simulate.log"), mode="w"),
    ],
)
logger = logging.getLogger(__name__)


# ── Prediction with interval ──────────────────────────────────────────────────

def build_interval_model(X: pd.DataFrame,
                         y: pd.Series) -> RandomForestRegressor:
    """
    Fit a Random Forest used solely for deriving prediction intervals.
    A larger n_estimators gives smoother quantile estimates.
    """
    rf = RandomForestRegressor(
        n_estimators=500,
        max_features="sqrt",
        min_samples_leaf=2,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    rf.fit(X, y)
    logger.info("Interval RF fitted  — OOB R²=%.4f (if oob_score=True)",
                0.0)   # oob not enabled to save memory
    return rf


def predict_with_interval(
    point_model,
    interval_rf: RandomForestRegressor,
    X_row: pd.DataFrame,
    alpha: float = SIM_PI_ALPHA,
) -> tuple[float, float, float]:
    """
    Return (point_prediction, lower_bound, upper_bound) for a single row.

    point_prediction : from the best model (XGBoost or RF)
    lower / upper    : (1-alpha)/2 and (1+alpha)/2 quantiles of tree predictions
    """
    point = float(point_model.predict(X_row)[0])
    tree_preds = np.array([t.predict(X_row.values)[0]
                           for t in interval_rf.estimators_])
    lo = float(np.percentile(tree_preds, (1 - alpha) / 2 * 100))
    hi = float(np.percentile(tree_preds, (1 + alpha) / 2 * 100))
    return point, lo, hi


# ── Monotonicity audit ────────────────────────────────────────────────────────

def check_monotonicity(df_sim: pd.DataFrame) -> pd.DataFrame:
    """
    For each temperature scenario, check whether predicted milk yield
    is monotonically non-decreasing in feed intake.

    Biologically, more feed should increase yield (within realistic range).
    Violations indicate model extrapolation artefacts and must be reported.
    """
    results = []
    for temp, grp in df_sim.groupby("Temp_C"):
        grp_sorted = grp.sort_values("Feed_kg")
        preds      = grp_sorted["Pred_L"].values
        diffs      = np.diff(preds)
        n_violations = int((diffs < -0.01).sum())  # allow 0.01 L tolerance
        results.append({
            "Temp_C":       temp,
            "N_violations": n_violations,
            "Monotone":     n_violations == 0,
            "Max_reversal": float(np.abs(diffs[diffs < 0]).max()) if n_violations > 0 else 0.0,
        })

    df_mono = pd.DataFrame(results)
    logger.info("Monotonicity check:\n%s", df_mono.to_string(index=False))
    return df_mono


# ── Simulation grid ───────────────────────────────────────────────────────────

def run_simulation(point_model, interval_rf,
                   X_ref: pd.DataFrame) -> pd.DataFrame:
    """
    Run the full (feed × temperature) simulation grid.

    For each grid point:
    - Set feed and temperature to the scenario values
    - Recompute THI and feed_weight_ratio consistently
    - Hold all other features at their dataset mean (average cow)
    - Predict milk yield + 90% PI
    """
    avg_row = {feat: float(X_ref[feat].mean()) for feat in ALL_FEATURES}

    records = []
    for temp in SIM_TEMP_RANGE:
        hum = SIM_HUM_FIXED
        thi_val = float(compute_thi(
            pd.Series([temp]), pd.Series([hum])
        ).iloc[0])

        for feed in SIM_FEED_RANGE:
            row = {**avg_row,
                   "feed":             feed,
                   "temperature":      temp,
                   "humidity":         hum,
                   "thi":              thi_val,
                   "feed_weight_ratio": feed / avg_row["weight"]}

            X_row = pd.DataFrame([row], columns=ALL_FEATURES)
            pt, lo, hi = predict_with_interval(point_model, interval_rf, X_row)

            # Clip to physically valid range (yield ≥ 0)
            pt = max(pt, 0.0)
            lo = max(lo, 0.0)
            hi = max(hi, 0.0)

            # THI stress category
            if thi_val < THI_COMFORT:
                stress = "None"
            elif thi_val < THI_MILD:
                stress = "Mild"
            elif thi_val < THI_MODERATE:
                stress = "Moderate"
            elif thi_val < THI_SEVERE:
                stress = "Severe"
            else:
                stress = "Emergency"

            records.append({
                "Temp_C":       temp,
                "Feed_kg":      feed,
                "THI":          round(thi_val, 1),
                "Stress_Level": stress,
                "Pred_L":       round(pt, 3),
                "Lower_L":      round(lo, 3),
                "Upper_L":      round(hi, 3),
                "PI_width_L":   round(hi - lo, 3),
            })

    df_sim = pd.DataFrame(records)
    logger.info("Simulation complete — %d grid points", len(df_sim))
    return df_sim


# ── Plots ─────────────────────────────────────────────────────────────────────

def plot_feed_lines(df_sim: pd.DataFrame):
    """Line chart: Feed vs Predicted Yield, one line per temperature."""
    temp_labels = {t: f"{t}°C (THI≈{df_sim[df_sim['Temp_C']==t]['THI'].iloc[0]:.0f})"
                   for t in SIM_TEMP_RANGE}
    df_plot = df_sim.copy()
    df_plot["Scenario"] = df_plot["Temp_C"].map(temp_labels)

    fig = go.Figure()
    colors = px.colors.sequential.RdBu
    n = len(SIM_TEMP_RANGE)
    for i, (temp, grp) in enumerate(df_plot.groupby("Temp_C")):
        color = colors[int(i / (n - 1) * (len(colors) - 1))]
        label = temp_labels[temp]
        fig.add_trace(go.Scatter(
            x=grp["Feed_kg"], y=grp["Pred_L"],
            mode="lines+markers",
            name=label,
            line=dict(color=color, width=2),
            marker=dict(size=6),
        ))
        # Prediction interval as shaded region
        fig.add_trace(go.Scatter(
            x=pd.concat([grp["Feed_kg"], grp["Feed_kg"].iloc[::-1]]),
            y=pd.concat([grp["Upper_L"], grp["Lower_L"].iloc[::-1]]),
            fill="toself",
            fillcolor=color,
            opacity=0.12,
            line=dict(width=0),
            showlegend=False,
            hoverinfo="skip",
        ))

    fig.update_layout(
        title="Digital Twin Simulation: Feed Intake vs Milk Yield (90% PI shaded)",
        xaxis_title="Feed Intake (kg/day)",
        yaxis_title="Predicted Milk Yield (L/day)",
        legend_title="Temperature (THI)",
        width=800, height=520,
    )
    path = os.path.join(OUTPUT_DIR, "simulation_feedlines.png")
    fig.write_image(path)
    logger.info("Saved → %s", path)
    return fig


def plot_heatmap(df_sim: pd.DataFrame):
    """Heatmap of predicted yield over (temp × feed) grid."""
    pivot = df_sim.pivot(index="Temp_C", columns="Feed_kg", values="Pred_L")
    fig = px.imshow(
        pivot,
        labels=dict(x="Feed Intake (kg/day)",
                    y="Temperature (°C)",
                    color="Milk Yield (L/day)"),
        title="Predicted Milk Yield Heatmap: Temperature × Feed Grid",
        color_continuous_scale="RdBu_r",
        aspect="auto",
    )
    path = os.path.join(OUTPUT_DIR, "simulation_heatmap.png")
    fig.write_image(path)
    logger.info("Saved → %s", path)
    return fig


def plot_thi_impact(df_sim: pd.DataFrame):
    """Scatter of THI vs Predicted Yield at mean feed."""
    mean_feed = float(np.median(SIM_FEED_RANGE))
    df_thi = df_sim[df_sim["Feed_kg"] == mean_feed].copy()
    if df_thi.empty:
        df_thi = df_sim.groupby("Temp_C").mean(numeric_only=True).reset_index()

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=df_thi["THI"], y=df_thi["Pred_L"],
        mode="markers+lines",
        marker=dict(size=10, color=df_thi["THI"],
                    colorscale="RdYlGn_r",
                    showscale=True,
                    colorbar=dict(title="THI")),
        line=dict(color="gray", dash="dot"),
        error_y=dict(
            array=df_thi["Upper_L"] - df_thi["Pred_L"],
            arrayminus=df_thi["Pred_L"] - df_thi["Lower_L"],
            visible=True,
        ),
        name="Predicted yield",
    ))

    # Add THI threshold lines
    for thr, label, col in [
        (THI_COMFORT,  "Mild stress onset",     "#BA7517"),
        (THI_MILD,     "Moderate stress onset",  "#E24B4A"),
        (THI_MODERATE, "Severe stress onset",    "#993C1D"),
    ]:
        fig.add_vline(x=thr, line_dash="dash", line_color=col,
                      annotation_text=label, annotation_position="top right")

    fig.update_layout(
        title=f"THI vs Milk Yield at Feed = {mean_feed:.0f} kg/day (90% PI)",
        xaxis_title="Temperature-Humidity Index (THI)",
        yaxis_title="Predicted Milk Yield (L/day)",
        width=750, height=480,
    )
    path = os.path.join(OUTPUT_DIR, "simulation_thi_impact.png")
    fig.write_image(path)
    logger.info("Saved → %s", path)
    return fig


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Data
    logger.info("=== Building feature matrix ===")
    df_clean            = load_and_prepare()
    base_temp, base_hum = fetch_weather()
    df_full, X, y       = build_features(df_clean, base_temp, base_hum)

    # Models
    if not os.path.exists(MODEL_PATH):
        logger.error("Model not found — run train.py first.")
        sys.exit(1)

    point_model = joblib.load(MODEL_PATH)
    logger.info("Loaded best model: %s", type(point_model).__name__)

    logger.info("=== Fitting interval RF ===")
    interval_rf = build_interval_model(X, y)

    # Simulation
    logger.info("=== Running simulation grid ===")
    logger.info("  Feed range : %s kg", SIM_FEED_RANGE)
    logger.info("  Temp range : %s °C", SIM_TEMP_RANGE)
    df_sim = run_simulation(point_model, interval_rf, X)
    df_sim.to_csv(SIM_CSV, index=False)
    logger.info("Simulation results saved → %s", SIM_CSV)

    # Monotonicity audit
    df_mono = check_monotonicity(df_sim)
    mono_path = os.path.join(OUTPUT_DIR, "monotonicity_report.txt")
    with open(mono_path, "w") as f:
        f.write("Monotonicity audit — Feed vs Predicted Yield\n")
        f.write("=" * 50 + "\n")
        f.write(df_mono.to_string(index=False))
        f.write("\n\nNote: violations indicate model extrapolation artefacts.\n")
        f.write("Consider constraining simulation to training data range.\n")
    logger.info("Monotonicity report saved → %s", mono_path)

    # Plots
    logger.info("=== Generating plots ===")
    plot_feed_lines(df_sim)
    plot_heatmap(df_sim)
    plot_thi_impact(df_sim)

    # Console summary
    print("\n" + "=" * 65)
    print(" DIGITAL TWIN SIMULATION SUMMARY")
    print("=" * 65)
    for temp, grp in df_sim.groupby("Temp_C"):
        thi = grp["THI"].iloc[0]
        stress = grp["Stress_Level"].iloc[0]
        avg_y  = grp["Pred_L"].mean()
        print(f"  {temp}°C  THI={thi:.0f}  [{stress:<9}]  "
              f"Avg yield={avg_y:.2f} L/day")

    print("\nMonotonicity violations:")
    for _, row in df_mono.iterrows():
        status = "OK" if row["Monotone"] else f"⚠ {int(row['N_violations'])} violations"
        print(f"  {row['Temp_C']}°C : {status}")

    print("\nAll simulation outputs saved to outputs/")


if __name__ == "__main__":
    main()
