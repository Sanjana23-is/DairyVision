"""Evaluate genetics models for sire total milk yield prediction."""
import os
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_validate, train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error

def _prepare_xy(df: pd.DataFrame, target_column: str = "Total_Milk_Yield"):
    features = [c for c in df.columns if c not in {"Sire_ID", target_column}]
    X = df[features].astype(float)
    y = df[target_column].astype(float)
    return X, y, features


def get_models() -> dict[str, Any]:
    try:
        from xgboost import XGBRegressor
    except ImportError as exc:
        raise ImportError(
            "XGBoost is required for the genetics analytics module. "
            "Install it with `pip install xgboost`."
        ) from exc

    return {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=200,
            max_depth=6,
            random_state=42,
            n_jobs=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.08,
            random_state=42,
            verbosity=0,
            n_jobs=-1,
        ),
    }


def cross_validate_models(df: pd.DataFrame,
                          target_column: str = "Total_Milk_Yield",
                          cv: int = 5) -> pd.DataFrame:
    X, y, _ = _prepare_xy(df, target_column=target_column)
    models = get_models()
    results = []

    for name, model in models.items():
        scores = cross_validate(
            model,
            X,
            y,
            cv=cv,
            scoring=["r2", "neg_mean_absolute_error", "neg_root_mean_squared_error"],
            return_train_score=False,
            n_jobs=-1,
        )
        results.append({
            "Model": name,
            "R2_Mean": np.mean(scores["test_r2"]),
            "R2_STD": np.std(scores["test_r2"]),
            "MAE_Mean": -np.mean(scores["test_neg_mean_absolute_error"]),
            "RMSE_Mean": -np.mean(scores["test_neg_root_mean_squared_error"]),
        })

    return pd.DataFrame(results).sort_values("R2_Mean", ascending=False).reset_index(drop=True)


def compute_test_metrics(df: pd.DataFrame,
                         model: Any,
                         target_column: str = "Total_Milk_Yield",
                         test_size: float = 0.2,
                         random_state: int = 42) -> pd.DataFrame:
    X, y, _ = _prepare_xy(df, target_column=target_column)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    metrics = {
        "Model": type(model).__name__,
        "R2": r2_score(y_test, predictions),
        "MAE": mean_absolute_error(y_test, predictions),
        "RMSE": float(np.sqrt(mse)),
    }
    return pd.DataFrame([metrics])


OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "outputs", "genetics")
)


def save_df(df: pd.DataFrame, path: str) -> str:
    if os.path.dirname(path) == "":
        path = os.path.join(OUTPUT_DIR, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_csv(path, index=False)
    return path
