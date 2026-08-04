"""Load and validate sire performance data for genetics analytics."""
import os

import pandas as pd

REQUIRED_COLUMNS = [
    "Sire_ID",
    "Peak_Yield",
    "Days_To_Peak",
    "Lactation_Length",
    "Corrected_Milk_Yield",
    "Dry_Days",
    "Total_Milk_Yield",
]


def _default_data_path() -> str:
    return os.path.join(os.path.dirname(__file__), "data", "sire_performance.csv")


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.rename(columns={col.strip(): col.strip() for col in df.columns})
    canonical = {}
    for col in normalized.columns:
        key = col.strip().lower().replace(" ", "_")
        canonical[key] = col

    if "corrected_milk" in canonical and "corrected_milk_yield" not in canonical:
        normalized = normalized.rename(columns={canonical["corrected_milk"]: "Corrected_Milk_Yield"})
    return normalized


def load_sire_data(data_path: str | None = None) -> pd.DataFrame:
    """Load sire performance data from CSV and validate required fields."""
    if data_path is None:
        data_path = _default_data_path()

    df = pd.read_csv(data_path)
    df.columns = [col.strip() for col in df.columns]
    df = _normalize_columns(df)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"Sire performance dataset is missing required columns: {missing}."
        )

    df = df[REQUIRED_COLUMNS].copy()
    df = df.dropna().reset_index(drop=True)
    return df


def summarize_data(df: pd.DataFrame) -> pd.DataFrame:
    return df.describe().T
