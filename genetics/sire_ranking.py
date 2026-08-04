"""Generate sire ranking from genetics model predictions."""
import os
from typing import Any

import pandas as pd

OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "outputs", "genetics")
)


def rank_sires(df: pd.DataFrame,
               model: Any | None = None,
               features: list[str] | None = None,
               target: str = "Total_Milk_Yield") -> pd.DataFrame:
    ranked = df.copy()
    if model is not None and features is not None:
        X = ranked[features].astype(float)
        ranked["Predicted_Total_Milk_Yield"] = model.predict(X)
    else:
        ranked["Predicted_Total_Milk_Yield"] = ranked[target]

    grouped = (
        ranked.groupby("Sire_ID")
        .agg(
            mean_actual_total_milk_yield=(target, "mean"),
            mean_predicted_total_milk_yield=("Predicted_Total_Milk_Yield", "mean"),
            count_records=(target, "count"),
        )
        .reset_index()
    )
    grouped = grouped.sort_values("mean_predicted_total_milk_yield", ascending=False)
    return grouped


def save_sire_ranking(df: pd.DataFrame) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "sire_ranking.csv")
    df.to_csv(path, index=False)
    return path
