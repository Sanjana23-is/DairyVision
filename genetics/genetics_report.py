"""Independent genetics analytics report generation for DairyVision AI."""
import os
from datetime import datetime

import pandas as pd

from genetics.load_data import load_sire_data
from genetics.evaluate_models import (
    cross_validate_models,
    compute_test_metrics,
    save_df,
)
from genetics.train_models import train_models, get_feature_importances
from genetics.sire_ranking import rank_sires, save_sire_ranking
from genetics.genetics_visualization import (
    plot_top_sires,
    plot_predicted_vs_actual,
    plot_feature_importance,
)

OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "outputs", "genetics")
)


def generate_genetics_report(data_path: str | None = None) -> dict[str, str]:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    df = load_sire_data(data_path)
    cv_results = cross_validate_models(df, cv=5)
    cv_path = save_df(cv_results, "genetics_cv_results.csv")

    trained_models = train_models(df)
    feature_importance_df = get_feature_importances(trained_models, df)
    feature_importance_path = save_df(feature_importance_df, "genetics_feature_importance.csv")

    best_model_name = cv_results.iloc[0]["Model"]
    best_model = trained_models[best_model_name]
    features = [c for c in df.columns if c not in {"Sire_ID", "Total_Milk_Yield"}]
    sire_rankings = rank_sires(df, model=best_model, features=features)
    sire_ranking_path = save_sire_ranking(sire_rankings)

    test_metrics = []
    for name, model in trained_models.items():
        metrics_df = compute_test_metrics(df, model)
        metrics_df["Model"] = name
        test_metrics.append(metrics_df)
    test_metrics_df = pd.concat(test_metrics, ignore_index=True)
    test_metrics_path = save_df(test_metrics_df, "genetics_test_metrics.csv")

    comparison_df = cv_results.copy()
    comparison_path = save_df(comparison_df, "genetics_model_comparison.csv")

    top_sires_path = plot_top_sires(sire_rankings)

    y_true = df["Total_Milk_Yield"].astype(float)
    y_pred = best_model.predict(df[features].astype(float))
    predicted_vs_actual_path = plot_predicted_vs_actual(y_true, y_pred)
    feature_importance_plot = plot_feature_importance(feature_importance_df)

    def _df_to_markdown(df: pd.DataFrame) -> str:
        try:
            return df.to_markdown(index=False)
        except ImportError:
            return "\n" + df.to_string(index=False) + "\n"

    report_path = os.path.join(OUTPUT_DIR, "genetics_report.md")
    with open(report_path, "w") as fh:
        fh.write("# Genetics Analytics Report\n\n")
        fh.write("This independent genetics analytics module evaluates superior dairy cattle sires and predicts genetic milk production potential.\n\n")
        fh.write(f"Generated: {datetime.utcnow().isoformat()}Z\n\n")
        fh.write("## Dataset and target\n")
        fh.write("- Dataset: Superior Dairy Cattle Sires\n")
        fh.write("- Target: Total Milk Yield\n")
        fh.write("- Features: Peak Yield, Days To Peak, Lactation Length, Corrected Milk Yield, Dry Days\n\n")
        fh.write("## Cross-validation results\n")
        fh.write(_df_to_markdown(cv_results))
        fh.write("\n\n")
        fh.write("## Test metrics\n")
        fh.write(_df_to_markdown(test_metrics_df))
        fh.write("\n\n")
        fh.write("## Top predicted sire rankings\n")
        fh.write(_df_to_markdown(sire_rankings.head(20)))
        fh.write("\n\n")
        fh.write("## Output artifacts\n")
        fh.write(f"- genetics_cv_results.csv\n")
        fh.write(f"- genetics_test_metrics.csv\n")
        fh.write(f"- genetics_model_comparison.csv\n")
        fh.write(f"- genetics_feature_importance.csv\n")
        fh.write(f"- sire_ranking.csv\n")
        fh.write(f"- top_sires.png\n")
        fh.write(f"- predicted_vs_actual.png\n")
        fh.write(f"- feature_importance.png\n")

    return {
        "cv_results": cv_path,
        "test_metrics": test_metrics_path,
        "model_comparison": comparison_path,
        "feature_importance": feature_importance_path,
        "sire_ranking": sire_ranking_path,
        "top_sires_plot": top_sires_path,
        "predicted_vs_actual_plot": predicted_vs_actual_path,
        "feature_importance_plot": feature_importance_plot,
        "report": report_path,
    }


if __name__ == "__main__":
    outputs = generate_genetics_report()
    print("Genetics analytics outputs generated:")
    for name, path in outputs.items():
        print(f"- {name}: {path}")
