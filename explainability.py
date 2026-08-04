"""
explainability.py
=================
Generate SHAP explainability artifacts for the final trained model.

Creates the following outputs under `outputs/shap/`:
 - shap_summary.png
 - shap_bar.png
 - shap_feature_importance.csv
 - shap_report.md

Usage
-----
Call `generate_shap_reports(X, df_full=...)` from the pipeline after
features have been built. The function will load the model from
`config.MODEL_PATH`.
"""
import os
import logging
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

try:
    import shap
except Exception:  # pragma: no cover - optional dependency
    shap = None

import joblib

from config import MODEL_PATH, OUTPUT_DIR

logger = logging.getLogger(__name__)
sns.set(style="whitegrid")


def _ensure_dirs(out_dir: str):
    os.makedirs(out_dir, exist_ok=True)


def _save_figure(fig, path: str, dpi: int = 300):
    fig.savefig(path, bbox_inches="tight", dpi=dpi)
    plt.close(fig)


def generate_shap_reports(X: pd.DataFrame,
                          df_full: pd.DataFrame | None = None,
                          model_path: str | None = None,
                          out_root: str | None = None):
    """Generate SHAP explainability outputs using the saved model.

    Parameters
    ----------
    X : pd.DataFrame
        Feature matrix used for prediction (the same columns as the
        trained model expects).
    df_full : pd.DataFrame, optional
        Original dataframe (useful for referencing raw columns),
        not strictly required.
    model_path : str, optional
        Path to trained model file. If None, reads from config.MODEL_PATH.
    out_root : str, optional
        Root output directory. If None, uses config.OUTPUT_DIR.
    """
    if model_path is None:
        model_path = MODEL_PATH
    if out_root is None:
        out_root = OUTPUT_DIR

    out_dir = os.path.join(out_root, "shap")
    _ensure_dirs(out_dir)

    logger.info("Loading model from %s", model_path)
    model = joblib.load(model_path)

    if shap is None:
        msg = (
            "The `shap` package is not available in this environment."
            " Install it with `pip install shap` to generate SHAP plots."
        )
        logger.error(msg)
        raise RuntimeError(msg)

    X_for_shap = X.copy()

    # Choose an appropriate explainer
    try:
        if hasattr(model, "feature_importances_") or model.__class__.__name__.lower().startswith("xgb"):
            explainer = shap.TreeExplainer(model)
        elif "linear" in model.__class__.__name__.lower() or "ridge" in model.__class__.__name__.lower():
            explainer = shap.LinearExplainer(model, X_for_shap, feature_dependence="independent")
        else:
            explainer = shap.KernelExplainer(lambda x: model.predict(x), shap.sample(X_for_shap, min(100, len(X_for_shap))))
    except Exception as e:
        logger.warning("Falling back to KernelExplainer due to: %s", e)
        explainer = shap.KernelExplainer(lambda x: model.predict(x), shap.sample(X_for_shap, min(100, len(X_for_shap))))

    logger.info("Computing SHAP values (this may take a while)...")
    shap_values = explainer.shap_values(X_for_shap)

    # Ensure shap_values is a 2D array with shape (n_samples, n_features)
    shap_arr = np.array(shap_values)
    if shap_arr.ndim == 3:
        # sometimes shap returns (n_outputs, n_samples, n_features)
        shap_arr = shap_arr[0]

    # Mean absolute SHAP per feature
    mean_abs_shap = np.abs(shap_arr).mean(axis=0)
    feature_names = list(X_for_shap.columns)
    fi_df = pd.DataFrame({"feature": feature_names, "mean_abs_shap": mean_abs_shap})
    fi_df = fi_df.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    fi_csv = os.path.join(out_dir, "shap_feature_importance.csv")
    fi_df.to_csv(fi_csv, index=False)
    logger.info("Wrote feature importance CSV: %s", fi_csv)

    # Save SHAP summary plot (dot)
    path1 = os.path.join(out_dir, "shap_summary.png")
    try:
        fig1 = plt.figure(figsize=(8, 6))
        shap.summary_plot(shap_arr, X_for_shap, show=False)
        fig1 = plt.gcf()
        _save_figure(fig1, path1)
        logger.info("Saved SHAP summary plot: %s", path1)
    except Exception as e:  # pragma: no cover - plotting edge cases
        logger.exception("Failed to create SHAP summary plot: %s", e)

    # Save SHAP bar plot (mean abs)
    try:
        topn = min(20, len(fi_df))
        fig, ax = plt.subplots(figsize=(8, max(4, topn * 0.25)))
        sns.barplot(x="mean_abs_shap", y="feature", data=fi_df.head(topn), palette="viridis", ax=ax)
        ax.set_xlabel("Mean |SHAP value|")
        ax.set_ylabel("")
        ax.set_title("SHAP Feature Importance")
        path2 = os.path.join(out_dir, "shap_bar.png")
        _save_figure(fig, path2)
        logger.info("Saved SHAP bar plot: %s", path2)
    except Exception as e:  # pragma: no cover
        logger.exception("Failed to create SHAP bar plot: %s", e)

    # Identify positive and negative contributors per feature
    mean_shap_signed = shap_arr.mean(axis=0)
    contrib_df = pd.DataFrame({
        "feature": feature_names,
        "mean_abs_shap": mean_abs_shap,
        "mean_shap": mean_shap_signed,
    })
    contrib_df["direction"] = contrib_df["mean_shap"].apply(lambda v: "positive" if v > 0 else ("negative" if v < 0 else "neutral"))
    contrib_df = contrib_df.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

    # Write markdown report
    md_path = os.path.join(out_dir, "shap_report.md")
    with open(md_path, "w") as fh:
        fh.write("# SHAP Explainability Report\n\n")
        fh.write("This report explains model predictions for milk yield using SHAP values computed on the final trained model.\n\n")

        fh.write("## Top features (by mean absolute SHAP)\n\n")
        for i, row in contrib_df.head(20).iterrows():
            fh.write(f"{i+1}. **{row['feature']}** — mean |SHAP|={row['mean_abs_shap']:.4f}, mean SHAP={row['mean_shap']:.4f} ({row['direction']})\n\n")

        # Focused explanations for required features
        fh.write("## Focused feature explanations\n\n")
        def feature_explain(name, reason):
            if name in contrib_df['feature'].values:
                r = contrib_df[contrib_df['feature'] == name].iloc[0]
                fh.write(f"### {name}\n- Importance (mean |SHAP|): {r['mean_abs_shap']:.4f}\n- Average contribution: {r['mean_shap']:.4f} ({r['direction']})\n- Explanation: {reason}\n\n")
            else:
                fh.write(f"### {name}\n- Not present in feature matrix.\n- Explanation: {reason}\n\n")

        feature_explain("thi", "Temperature-Humidity Index captures combined heat stress — higher THI typically reduces milk yield; SHAP shows how THI shifts predictions for individual cows.")
        feature_explain("age", "Age affects production lifecycle; depending on parity/lactation stage, age can increase or decrease yield.")
        feature_explain("weight", "Body weight correlates with metabolic capacity and milk production; heavier cows often produce more, reflected in a positive SHAP sign when present.")
        feature_explain("feed", "Feed intake is a direct input; more feed generally supports higher yield, so SHAP often shows positive contributions for higher feed values.")

        fh.write("## Engineered features\n\n")
        engineered = [c for c in contrib_df['feature'].values if any(sub in c for sub in ['ratio', 'interaction', 'thi', 'feed_per', 'age_weight'])]
        if engineered:
            for ef in engineered:
                r = contrib_df[contrib_df['feature'] == ef].iloc[0]
                fh.write(f"- **{ef}** — mean |SHAP|={r['mean_abs_shap']:.4f}, mean SHAP={r['mean_shap']:.4f}\n")
        else:
            fh.write("No engineered features detected in the feature matrix.\n")

        fh.write("\n## How to read these results\n")
        fh.write("- Mean |SHAP| indicates feature importance averaged across the dataset.\n")
        fh.write("- Mean SHAP (signed) indicates whether a feature tends to push predictions up (positive) or down (negative).\n")
        fh.write("\nGenerated files:\n")
        fh.write(f"- {os.path.relpath(path1, out_root)}\n")
        fh.write(f"- {os.path.relpath(path2, out_root)}\n")
        fh.write(f"- {os.path.relpath(fi_csv, out_root)}\n")

    logger.info("Wrote SHAP markdown report: %s", md_path)

    return {
        "shap_csv": fi_csv,
        "shap_summary": os.path.join(out_dir, "shap_summary.png"),
        "shap_bar": os.path.join(out_dir, "shap_bar.png"),
        "shap_md": md_path,
    }


if __name__ == "__main__":
    # Quick local smoke test (requires running inside project with model and data)
    import sys
    if len(sys.argv) < 2:
        print("Usage: python explainability.py <path_to_feature_csv>")
        raise SystemExit(1)
    Xp = pd.read_csv(sys.argv[1])
    generate_shap_reports(Xp)
