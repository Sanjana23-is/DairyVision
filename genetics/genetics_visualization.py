"""Publication-quality plots for genetics analytics results."""
import os

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "outputs", "genetics")
)

sns.set(style="whitegrid", font_scale=1.1)


def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def plot_top_sires(df: pd.DataFrame, path: str | None = None) -> str:
    _ensure_output_dir()
    if path is None:
        path = os.path.join(OUTPUT_DIR, "top_sires.png")

    top = df.head(20).copy()
    plt.figure(figsize=(11, 8))
    sns.barplot(
        data=top,
        x="mean_predicted_total_milk_yield",
        y="Sire_ID",
        palette="viridis",
    )
    plt.xlabel("Predicted Total Milk Yield")
    plt.ylabel("Sire ID")
    plt.title("Top 20 Predicted Sire Rankings")
    plt.tight_layout()
    plt.savefig(path, dpi=300)
    plt.close()
    return path


def plot_predicted_vs_actual(y_true: pd.Series,
                             y_pred: pd.Series,
                             path: str | None = None) -> str:
    _ensure_output_dir()
    if path is None:
        path = os.path.join(OUTPUT_DIR, "predicted_vs_actual.png")

    plt.figure(figsize=(8, 8))
    sns.scatterplot(x=y_true, y=y_pred, color="#1f77b4", edgecolor="w", s=80)
    sns.lineplot(x=y_true, y=y_true, color="#ff7f0e", linestyle="--")
    plt.xlabel("Actual Total Milk Yield")
    plt.ylabel("Predicted Total Milk Yield")
    plt.title("Predicted vs Actual Total Milk Yield")
    plt.tight_layout()
    plt.savefig(path, dpi=300)
    plt.close()
    return path


def plot_feature_importance(df: pd.DataFrame, path: str | None = None) -> str:
    _ensure_output_dir()
    if path is None:
        path = os.path.join(OUTPUT_DIR, "feature_importance.png")

    summary = (
        df.groupby("Feature").Importance.mean()
        .sort_values(ascending=False)
        .head(12)
        .reset_index()
    )

    plt.figure(figsize=(9, 6))
    sns.barplot(data=summary, x="Importance", y="Feature", palette="coolwarm")
    plt.xlabel("Mean Importance")
    plt.ylabel("Feature")
    plt.title("Genetics Feature Importance")
    plt.tight_layout()
    plt.savefig(path, dpi=300)
    plt.close()
    return path
