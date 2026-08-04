"""
data_loader.py
==============
Loads the two source CSVs (disease detection + milk yield) and merges
them on an explicit join key.  Returns a clean, validated DataFrame.

Design notes
------------
- The original code used  set(cols_a) & set(cols_b)  as the merge key.
  Python sets are unordered, so the join column could vary between runs
  or Python versions — a reproducibility bug.  We always join on JOIN_KEY.
- Duplicate columns produced by the merge receive deterministic suffixes
  (_dis, _yld) so downstream code can inspect and drop them explicitly.
- Shape, dtypes, and missing-value counts are logged at INFO level so
  the researcher can verify the merge without running a separate script.
"""

import logging
import pandas as pd

from config import (
    DISEASE_CSV, YIELD_CSV, JOIN_KEY, RENAME_MAP,
    TARGET, ALL_FEATURES
)

logger = logging.getLogger(__name__)


def load_raw() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Read the two source CSVs and return them as separate DataFrames."""
    df_dis = pd.read_csv(DISEASE_CSV)
    df_yld = pd.read_csv(YIELD_CSV)
    logger.info("Disease dataset  : %d rows × %d cols", *df_dis.shape)
    logger.info("Yield dataset    : %d rows × %d cols", *df_yld.shape)
    return df_dis, df_yld


def merge_datasets(df_dis: pd.DataFrame,
                   df_yld: pd.DataFrame) -> pd.DataFrame:
    """
    Inner-join the two DataFrames on JOIN_KEY.

    Columns that appear in both datasets (other than the key) receive
    suffixes '_dis' and '_yld' so they can be inspected or dropped cleanly.
    """
    if JOIN_KEY not in df_dis.columns:
        raise KeyError(f"JOIN_KEY '{JOIN_KEY}' missing from disease dataset. "
                       f"Available: {list(df_dis.columns)}")
    if JOIN_KEY not in df_yld.columns:
        raise KeyError(f"JOIN_KEY '{JOIN_KEY}' missing from yield dataset. "
                       f"Available: {list(df_yld.columns)}")

    df = pd.merge(df_dis, df_yld, on=JOIN_KEY,
                  how="inner", suffixes=("_dis", "_yld"))
    logger.info("After inner join : %d rows × %d cols", *df.shape)

    # Report any duplicated column families for transparency
    dup_cols = [c for c in df.columns if c.endswith("_dis")]
    if dup_cols:
        logger.info("Duplicated column families (kept both): %s", dup_cols)

    return df


def engineer_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply column renames and binary-encode the disease label.
    Works on a copy — does NOT modify the input in place.
    """
    df = df.copy()

    # Binary health label: 0 = Healthy, 1 = Diseased
    if "Disease_Status" in df.columns:
        df["health_status"] = (df["Disease_Status"] != "Healthy").astype(int)
        pct_diseased = df["health_status"].mean() * 100
        logger.info("Health label: %.1f%% diseased", pct_diseased)
    else:
        logger.warning("'Disease_Status' column not found — defaulting health_status to 0.")
        df["health_status"] = 0

    # Rename columns to short, consistent names
    df.rename(columns=RENAME_MAP, inplace=True)

    return df


def clean(df: pd.DataFrame,
          feature_cols: list[str] | None = None,
          target_col: str = TARGET) -> pd.DataFrame:
    """
    Drop rows with NaN in any model-relevant column and remove duplicates.

    Parameters
    ----------
    df            : merged DataFrame (after engineer_labels)
    feature_cols  : columns that must be non-null (defaults to ALL_FEATURES)
    target_col    : target column that must be non-null
    """
    if feature_cols is None:
        # Only keep columns that actually exist in the frame at this stage
        # (engineered features like 'thi' are added later in feature_engineering)
        feature_cols = [c for c in ["age", "weight", "health_status",
                                    "feed", TARGET]
                        if c in df.columns]

    required = list(set(feature_cols + [target_col]))
    before   = len(df)
    df       = df.dropna(subset=required)
    df       = df.drop_duplicates()
    after    = len(df)

    logger.info("After clean      : %d rows (dropped %d)", after, before - after)
    return df.reset_index(drop=True)


def load_and_prepare() -> pd.DataFrame:
    """
    Full pipeline: load → merge → label → clean.
    Returns a DataFrame ready for feature_engineering.py.
    """
    df_dis, df_yld = load_raw()
    df             = merge_datasets(df_dis, df_yld)
    df             = engineer_labels(df)
    df             = clean(df)
    return df


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-8s  %(message)s")
    df = load_and_prepare()
    print(df[["age", "weight", "health_status", "feed", TARGET]].describe())
