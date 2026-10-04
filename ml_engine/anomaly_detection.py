"""
anomaly_detection.py
====================
Detect anomalous cattle behaviour and productivity patterns using
Isolation Forest.

Generates:
- outputs/anomaly_report.csv
- outputs/anomaly_summary.md
- outputs/anomaly_visualization.png
"""

import logging
import os

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.ensemble import IsolationForest

from config import OUTPUT_DIR, RANDOM_SEED

logger = logging.getLogger(__name__)
sns.set(style="whitegrid")


def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def _binarize_heat_stress(thi: pd.Series) -> pd.Series:
    return thi >= 80


def detect_anomalies(df_full: pd.DataFrame,
                     contamination: float = 0.08,
                     random_state: int | None = None) -> pd.DataFrame:
    """Detect anomalies using Isolation Forest and assign severity labels."""
    if random_state is None:
        random_state = RANDOM_SEED

    features = ["milk_output", "feed", "thi", "weight", "age"]
    missing = [f for f in features if f not in df_full.columns]
    if missing:
        raise KeyError(f"Missing required anomaly detection features: {missing}")

    df = df_full.copy()
    df = df.dropna(subset=features).reset_index(drop=True)

    X = df[features].astype(float)
    iso_kwargs = {
        "contamination": contamination,
        "random_state": random_state,
        "n_jobs": -1,
    }
    if hasattr(IsolationForest, "behaviour"):
        iso_kwargs["behaviour"] = "new"

    model = IsolationForest(**iso_kwargs)
    model.fit(X)

    raw_pred = model.predict(X)
    df["anomaly_score"] = -model.decision_function(X)
    df["model_anomaly"] = np.where(raw_pred == -1, True, False)

    score_norm = (df["anomaly_score"] - df["anomaly_score"].min())
    denom = df["anomaly_score"].max() - df["anomaly_score"].min()
    if denom > 0:
        score_norm /= denom
    else:
        score_norm = 0.0
    df["anomaly_score_norm"] = score_norm

    low_yield = df["milk_output"] <= df["milk_output"].quantile(0.10)
    low_feed = df["feed"] <= df["feed"].quantile(0.10)
    high_feed = df["feed"] >= df["feed"].quantile(0.90)
    abnormal_feed = low_feed | high_feed
    extreme_heat = _binarize_heat_stress(df["thi"])

    df["extreme_heat_stress"] = extreme_heat
    df["abnormal_yield_drop"] = low_yield
    df["abnormal_feed_behaviour"] = abnormal_feed

    df["anomaly_label"] = "Normal"
    df.loc[df["model_anomaly"], "anomaly_label"] = "Warning"
    df.loc[
        (df["model_anomaly"]) &
        (df["anomaly_score_norm"] >= 0.80),
        "anomaly_label"
    ] = "Critical"
    df.loc[
        (~df["model_anomaly"]) &
        (df["extreme_heat_stress"] | df["abnormal_yield_drop"] | df["abnormal_feed_behaviour"]),
        "anomaly_label"
    ] = "Warning"

    issue_tags = []
    for _, row in df.iterrows():
        tags = []
        if row["extreme_heat_stress"]:
            tags.append("extreme heat stress")
        if row["abnormal_yield_drop"]:
            tags.append("abnormal yield drop")
        if row["abnormal_feed_behaviour"]:
            tags.append("abnormal feed behaviour")
        if row["model_anomaly"] and not tags:
            tags.append("model anomaly")
        issue_tags.append(", ".join(tags) if tags else "none"
        )
    df["issue_tags"] = issue_tags

    return df


def summarize_anomalies(df: pd.DataFrame) -> str:
    labels = df["anomaly_label"].value_counts().reindex(
        ["Normal", "Warning", "Critical"], fill_value=0)
    extreme_cases = df[df["extreme_heat_stress"]]
    warning_cases = df[df["anomaly_label"] == "Warning"]
    critical_cases = df[df["anomaly_label"] == "Critical"]
    abnormal_feed = df[df["abnormal_feed_behaviour"]]
    abnormal_yield = df[df["abnormal_yield_drop"]]

    lines = [
        "# Anomaly Detection Summary\n",
        "This report summarizes cattle anomaly detection based on milk yield, feed intake, THI, weight and age.\n",
        "## Severity counts\n",
        f"- Normal: {labels['Normal']}\n",
        f"- Warning: {labels['Warning']}\n",
        f"- Critical: {labels['Critical']}\n",
        "\n## Key findings\n",
        f"- Extreme heat stress cases: {len(extreme_cases)}\n",
        f"- Abnormal yield drop cases: {len(abnormal_yield)}\n",
        f"- Abnormal feed behaviour cases: {len(abnormal_feed)}\n",
        f"- Critical cases with extreme heat stress: {len(critical_cases[critical_cases['extreme_heat_stress']])}\n",
        "\n## Top critical cases\n",
    ]

    top_critical = critical_cases.sort_values("anomaly_score", ascending=False).head(10)
    if top_critical.empty:
        lines.append("No critical cases detected.\n")
    else:
        lines.append("feature summary for top critical cases:\n")
        lines.append("| Cattle_ID | milk_output | feed | thi | weight | age | issue_tags |\n")
        lines.append("|---|---|---|---|---|---|---|\n")
        for _, row in top_critical.iterrows():
            lines.append(
                f"| {row.get('Cattle_ID', '')} | {row['milk_output']:.2f} | "
                f"{row['feed']:.2f} | {row['thi']:.1f} | {row['weight']:.1f} | "
                f"{row['age']:.0f} | {row['issue_tags']} |\n"
            )
    return "".join(lines)


def plot_anomalies(df: pd.DataFrame, out_path: str) -> None:
    plt.figure(figsize=(10, 7))
    palette = {"Normal": "#2ca02c", "Warning": "#ff7f0e", "Critical": "#d62728"}
    sns.scatterplot(
        data=df,
        x="feed",
        y="milk_output",
        hue="anomaly_label",
        size="anomaly_score",
        sizes=(40, 200),
        palette=palette,
        alpha=0.85,
        edgecolor="black",
        linewidth=0.4,
    )

    for _, row in df[df["extreme_heat_stress"]].head(8).iterrows():
        plt.annotate(
            "heat stress",
            (row["feed"], row["milk_output"]),
            textcoords="offset points",
            xytext=(5, 5),
            fontsize=8,
            color="#8b0000",
        )

    plt.title("Anomaly detection: feed intake vs milk yield")
    plt.xlabel("Feed intake (kg/day)")
    plt.ylabel("Milk yield (L/day)")
    plt.legend(title="Anomaly label", loc="upper right")
    plt.tight_layout()
    plt.savefig(out_path, dpi=300)
    plt.close()


def generate_anomaly_reports(df_full: pd.DataFrame) -> dict[str, str]:
    _ensure_output_dir()
    df_anom = detect_anomalies(df_full)
    report_csv = os.path.join(OUTPUT_DIR, "anomaly_report.csv")
    df_anom.to_csv(report_csv, index=False)

    summary_md = os.path.join(OUTPUT_DIR, "anomaly_summary.md")
    summary_text = summarize_anomalies(df_anom)
    with open(summary_md, "w") as fh:
        fh.write(summary_text)

    viz_path = os.path.join(OUTPUT_DIR, "anomaly_visualization.png")
    plot_anomalies(df_anom, viz_path)

    logger.info("Anomaly outputs saved: %s, %s, %s",
                report_csv, summary_md, viz_path)
    return {
        "report_csv": report_csv,
        "summary_md": summary_md,
        "visualization": viz_path,
    }


if __name__ == "__main__":
    import sys
    from data_loader import load_and_prepare
    from feature_engineering import build_features
    df_clean = load_and_prepare()
    df_full, X, y = build_features(df_clean, base_temp=28.0, base_hum=65.0)
    generate_anomaly_reports(df_full)
