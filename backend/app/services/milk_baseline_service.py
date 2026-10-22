"""
milk_baseline_service.py
========================
Calculates scientifically defensible expected milk yield baselines using robust
statistics (rolling medians and Median Absolute Deviation) from prior observations.

Target Definition:
    expected_yield(c, t): Baseline yield calculated strictly using valid observations
    recorded prior to date t (date < t). Current day t yield is NEVER included.

Baseline Categories:
    - established_baseline: >= min_observations (default 3) valid prior records.
    - provisional_baseline: 1 to (min_observations - 1) valid prior records.
    - insufficient_history: 0 valid prior records before date t.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum
from typing import Any, List, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.models.daily_observation import DailyObservation


class BaselineStatus(str, Enum):
    ESTABLISHED_BASELINE = "established_baseline"
    PROVISIONAL_BASELINE = "provisional_baseline"
    INSUFFICIENT_HISTORY = "insufficient_history"


@dataclass
class BaselineResult:
    cow_id: str
    target_date: date
    expected_baseline: Optional[float]
    baseline_status: BaselineStatus
    observations_used: int
    baseline_window_days: int
    method: str
    historical_variability: Optional[float]  # Scaled MAD in litres
    previous_day_yield: Optional[float]
    observations_history: List[dict[str, Any]] = field(default_factory=list)
    data_quality_warnings: List[str] = field(default_factory=list)
    explanation: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "cow_id": self.cow_id,
            "target_date": self.target_date.isoformat(),
            "expected_baseline": self.expected_baseline,
            "baseline_status": self.baseline_status.value,
            "observations_used": self.observations_used,
            "baseline_window_days": self.baseline_window_days,
            "method": self.method,
            "historical_variability": self.historical_variability,
            "previous_day_yield": self.previous_day_yield,
            "observations_history": self.observations_history,
            "data_quality_warnings": self.data_quality_warnings,
            "explanation": self.explanation,
        }


class MilkBaselineService:
    """Service for computing robust, historical milk production baselines."""

    # Default configuration parameters
    MIN_OBSERVATIONS_FOR_BASELINE: int = 3
    DEFAULT_WINDOW_OBSERVATIONS: int = 7
    EXTENDED_WINDOW_OBSERVATIONS: int = 14
    MAX_CALENDAR_LOOKBACK_DAYS: int = 45
    MIN_VARIABILITY_FLOOR_LITERS: float = 0.50
    MAX_PLAUSIBLE_DAILY_YIELD: float = 80.0

    def __init__(
        self,
        db: Session,
        min_observations: int = MIN_OBSERVATIONS_FOR_BASELINE,
        primary_window: int = DEFAULT_WINDOW_OBSERVATIONS,
    ) -> None:
        self.db = db
        self.min_observations = min_observations
        self.primary_window = primary_window

    def compute_cow_baseline(
        self,
        cow_id: str,
        target_date: date,
        window_size: Optional[int] = None,
    ) -> BaselineResult:
        """
        Computes expected daily milk yield baseline for a cow on a target date.

        Strictly enforces temporal ordering: only observations where
        observation_date < target_date are considered.
        """
        window_size = window_size or self.primary_window
        warnings: List[str] = []

        # Earliest calendar date to consider (prevents stale records from distorting current lactation)
        earliest_date = target_date - timedelta(days=self.MAX_CALENDAR_LOOKBACK_DAYS)

        # 1. Query raw prior observations strictly before target_date
        query = (
            self.db.query(DailyObservation)
            .filter(
                DailyObservation.cow_id == cow_id,
                DailyObservation.observation_date < target_date,
                DailyObservation.observation_date >= earliest_date,
            )
            .order_by(DailyObservation.observation_date.desc(), DailyObservation.created_at.desc())
        )
        raw_records = query.all()

        # 2. De-duplicate and validate records
        # Keep only the latest observation per calendar date
        seen_dates: set[date] = set()
        clean_records: List[tuple[date, float]] = []

        for rec in raw_records:
            obs_date = rec.observation_date
            if obs_date in seen_dates:
                warnings.append(
                    f"Duplicate observation detected for date {obs_date.isoformat()}; prioritizing latest entry."
                )
                continue
            seen_dates.add(obs_date)

            milk_val = rec.milk_produced_liters
            if milk_val is None:
                continue

            try:
                milk_float = float(milk_val)
            except (TypeError, ValueError):
                warnings.append(f"Non-numeric milk yield ignored on date {obs_date.isoformat()}.")
                continue

            if not np.isfinite(milk_float):
                warnings.append(f"Non-finite milk yield ignored on date {obs_date.isoformat()}.")
                continue

            if milk_float < 0.0:
                warnings.append(f"Negative milk yield ({milk_float} L) discarded on date {obs_date.isoformat()}.")
                continue

            if milk_float > self.MAX_PLAUSIBLE_DAILY_YIELD:
                warnings.append(
                    f"Implausible milk yield ({milk_float} L) on date {obs_date.isoformat()}; included but flagged."
                )

            clean_records.append((obs_date, milk_float))

        # Check for calendar gaps in historical records
        if len(clean_records) >= 2:
            dates_sorted = sorted([d for d, _ in clean_records])
            max_gap_days = max((dates_sorted[i] - dates_sorted[i - 1]).days for i in range(1, len(dates_sorted)))
            if max_gap_days > 3:
                warnings.append(f"Historical records contain observation gaps up to {max_gap_days} days.")

        # 3. Evaluate History Sufficiency
        num_clean = len(clean_records)

        if num_clean == 0:
            return BaselineResult(
                cow_id=cow_id,
                target_date=target_date,
                expected_baseline=None,
                baseline_status=BaselineStatus.INSUFFICIENT_HISTORY,
                observations_used=0,
                baseline_window_days=window_size,
                method="none",
                historical_variability=None,
                previous_day_yield=None,
                observations_history=[],
                data_quality_warnings=warnings,
                explanation="No prior milk production records found for this cow before this date. A personalized baseline cannot be calculated yet.",
            )

        history_summary = [
            {"date": d.isoformat(), "milk_yield": y} for d, y in clean_records[:14]
        ]
        previous_day_yield = clean_records[0][1]

        if num_clean < self.min_observations:
            provisional_yields = [y for _, y in clean_records]
            provisional_median = round(float(np.median(provisional_yields)), 2)
            provisional_mad = None
            if num_clean >= 2:
                diffs = [abs(y - provisional_median) for y in provisional_yields]
                provisional_mad = round(max(float(np.median(diffs)) * 1.4826, self.MIN_VARIABILITY_FLOOR_LITERS), 2)

            return BaselineResult(
                cow_id=cow_id,
                target_date=target_date,
                expected_baseline=provisional_median,
                baseline_status=BaselineStatus.PROVISIONAL_BASELINE,
                observations_used=num_clean,
                baseline_window_days=window_size,
                method="provisional_median",
                historical_variability=provisional_mad,
                previous_day_yield=previous_day_yield,
                observations_history=history_summary,
                data_quality_warnings=warnings,
                explanation=f"Provisional baseline estimated from {num_clean} prior observation(s). At least {self.min_observations} observations are required for an established baseline.",
            )

        # 4. Established Baseline Calculation
        selected_records = clean_records[:window_size]
        yields = [y for _, y in selected_records]

        # Use robust rolling median
        expected_baseline = round(float(np.median(yields)), 2)

        # Robust variability: Median Absolute Deviation (MAD) scaled by 1.4826 for normal consistency
        abs_deviations = [abs(y - expected_baseline) for y in yields]
        mad_raw = float(np.median(abs_deviations))
        mad_scaled = mad_raw * 1.4826
        historical_variability = round(max(mad_scaled, self.MIN_VARIABILITY_FLOOR_LITERS), 2)

        method_name = f"rolling_median_{len(selected_records)}d"
        explanation = (
            f"Established baseline calculated using the rolling median of the previous {len(selected_records)} "
            f"valid daily observations (variability: ±{historical_variability:.2f} L/day)."
        )

        return BaselineResult(
            cow_id=cow_id,
            target_date=target_date,
            expected_baseline=expected_baseline,
            baseline_status=BaselineStatus.ESTABLISHED_BASELINE,
            observations_used=len(selected_records),
            baseline_window_days=window_size,
            method=method_name,
            historical_variability=historical_variability,
            previous_day_yield=previous_day_yield,
            observations_history=history_summary,
            data_quality_warnings=warnings,
            explanation=explanation,
        )
