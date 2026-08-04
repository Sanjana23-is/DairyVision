"""Independent genetics analytics dashboard for sire milk yield evaluation."""
import os

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

from genetics.load_data import load_sire_data
from genetics.train_models import (
    evaluate_models,
    train_models,
    get_feature_importances,
    save_feature_importance,
    save_model_comparison,
)
from genetics.sire_ranking import rank_sires, save_sire_ranking

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
sns.set(style="whitegrid")


def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def _plot_model_comparison(df: pd.DataFrame) -> str:
    path = os.path.join(OUTPUT_DIR, "genetics_model_comparison.png")
    plt.figure(figsize=(8, 5))
    sns.barplot(data=df, x="R2_Mean", y="Model", palette="muted")
    plt.xlabel("Mean R²")
    plt.title("Genetics model comparison")
    plt.tight_layout()
    plt.savefig(path, dpi=300)
    plt.close()
    return path


def _plot_feature_importance(df: pd.DataFrame) -> str:
    path = os.path.join(OUTPUT_DIR, "genetics_feature_importance.png")
    top_features = df.groupby("Feature").Importance.mean().sort_values(ascending=False).head(12)
    plt.figure(figsize=(8, 6))
    sns.barplot(x=top_features.values, y=top_features.index, palette="coolwarm")
    plt.xlabel("Mean importance")
    plt.title("Genetics feature importance")
    plt.tight_layout()
    plt.savefig(path, dpi=300)
    plt.close()
    return path


def _plot_sire_ranking(df: pd.DataFrame) -> str:
    path = os.path.join(OUTPUT_DIR, "sire_ranking.png")
    top = df.head(20).copy()
    plt.figure(figsize=(10, 7))
    sns.barplot(
        data=top,
        x="mean_predicted_total_milk_yield",
        y="Sire_ID",
        palette="viridis",
    )
    plt.xlabel("Predicted total milk yield")
    plt.ylabel("Sire ID")
    plt.title("Top 20 predicted sire rankings")
    plt.tight_layout()
    plt.savefig(path, dpi=300)
    plt.close()
    return path


def generate_dashboard(data_path: str | None = None) -> dict[str, str]:
    _ensure_output_dir()

    df = load_sire_data(data_path)
    comparison_df = evaluate_models(df)
    comparison_path = save_model_comparison(comparison_df)

    trained = train_models(df)
    importance_df = get_feature_importances(trained, df)
    importance_path = save_feature_importance(importance_df)

    best_model_name = comparison_df.iloc[0]["Model"]
    best_model = trained[best_model_name]
    features = [col for col in df.columns if col != "Total_Milk_Yield"]

    ranking_df = rank_sires(df, model=best_model, features=features)
    ranking_path = save_sire_ranking(ranking_df)

    plots = {
        "model_comparison": _plot_model_comparison(comparison_df),
        "feature_importance": _plot_feature_importance(importance_df),
        "sire_ranking": _plot_sire_ranking(ranking_df),
    }

    summary_path = os.path.join(OUTPUT_DIR, "genetics_dashboard_summary.md")
    with open(summary_path, "w") as fh:
        fh.write("# Genetics Analytics Summary\n\n")
        fh.write("This independent genetics analytics module evaluates sire contributions to total milk yield.\n\n")
        fh.write(f"Best model: {best_model_name}\n\n")
        fh.write("## Model comparison\n")
        fh.write(comparison_df.to_markdown(index=False))
        fh.write("\n\n## Top ranked sires\n")
        fh.write(ranking_df.head(20).to_markdown(index=False))

    return {
        "model_comparison_csv": comparison_path,
        "feature_importance_csv": importance_path,
        "sire_ranking_csv": ranking_path,
        "model_comparison_plot": plots["model_comparison"],
        "feature_importance_plot": plots["feature_importance"],
        "sire_ranking_plot": plots["sire_ranking"],
        "dashboard_summary": summary_path,
    }


if __name__ == "__main__":
    outputs = generate_dashboard()
    print("Genetics analytics outputs generated:")
    for name, path in outputs.items():
        print(f"- {name}: {path}")
