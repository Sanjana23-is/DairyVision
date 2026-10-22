"""
milk_anomaly_service.py
=======================
Evaluates actual daily milk yield against the expected baseline to detect
unusual production drops.

Key Design Principles:
    1. Multi-metric evaluation: Combines absolute drop (litres), percentage drop,
       and robust variability (MAD-scaled z-score).
    2. Persistence tracking: Flags consecutive low yields as persistent drops.
    3. Non-diagnostic: Explicitly framed as production monitoring, never as
       veterinary diagnoses.
    4. Cold-start safe: Explicit states for insufficient history, provisional,
       normal, monitor, unusual drop, persistent drop, and data quality issues.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from app.services.milk_baseline_service import BaselineResult, BaselineStatus


class AnomalyStatus(str, Enum):
    NORMAL = "normal"
    MONITOR = "monitor"
    UNUSUAL_DROP = "unusual_drop"
    PERSISTENT_DROP = "persistent_drop"
    PROVISIONAL_BASELINE = "provisional_baseline"
    INSUFFICIENT_HISTORY = "insufficient_history"
    DATA_QUALITY_ISSUE = "data_quality_issue"
    MISSING_OBSERVATION = "missing_observation"


@dataclass
class AnomalyResult:
    anomaly_status: AnomalyStatus
    actual_yield: Optional[float]
    expected_baseline: Optional[float]
    residual_liters: Optional[float]  # actual - expected
    drop_liters: Optional[float]      # expected - actual
    drop_percentage: Optional[float]  # 100 * drop_liters / expected
    z_score: Optional[float]          # drop_liters / variability
    is_persistent: bool
    alert_explanation: str
    recommended_action: str

    def to_dict(self) -> dict:
        return {
            "anomaly_status": self.anomaly_status.value,
            "actual_yield": self.actual_yield,
            "expected_baseline": self.expected_baseline,
            "residual_liters": self.residual_liters,
            "drop_liters": self.drop_liters,
            "drop_percentage": self.drop_percentage,
            "z_score": self.z_score,
            "is_persistent": self.is_persistent,
            "alert_explanation": self.alert_explanation,
            "recommended_action": self.recommended_action,
        }


class MilkAnomalyService:
    """Evaluates milk production observations for unusual drops and anomalies."""

    # Evaluation thresholds
    MONITOR_DROP_PERCENT_MIN: float = 10.0
    MONITOR_DROP_LITERS_MIN: float = 1.0
    MONITOR_Z_MIN: float = 1.5

    UNUSUAL_DROP_PERCENT_MIN: float = 20.0
    UNUSUAL_DROP_LITERS_MIN: float = 2.0
    UNUSUAL_Z_MIN: float = 2.5

    ACUTE_DROP_PERCENT_MIN: float = 35.0
    ACUTE_DROP_LITERS_MIN: float = 2.5

    PERSISTENT_DROP_PERCENT_MIN: float = 15.0
    PERSISTENT_DROP_LITERS_MIN: float = 1.5

    MAX_PLAUSIBLE_DAILY_YIELD: float = 80.0

    @classmethod
    def evaluate_observation(
        cls,
        actual_yield: Optional[float],
        baseline: BaselineResult,
        previous_drop_liters: Optional[float] = None,
        previous_anomaly_status: Optional[str] = None,
    ) -> AnomalyResult:
        """
        Evaluates an observed yield against its prior baseline.

        Parameters
        ----------
        actual_yield:
            Milk yield recorded for the day in litres.
        baseline:
            BaselineResult computed strictly prior to this observation.
        previous_drop_liters:
            Drop in litres observed on the previous valid day (for persistence).
        previous_anomaly_status:
            Anomaly status from the previous valid day.
        """
        # Case 1: Missing actual observation
        if actual_yield is None:
            return AnomalyResult(
                anomaly_status=AnomalyStatus.MISSING_OBSERVATION,
                actual_yield=None,
                expected_baseline=baseline.expected_baseline,
                residual_liters=None,
                drop_liters=None,
                drop_percentage=None,
                z_score=None,
                is_persistent=False,
                alert_explanation="No milk yield recorded for this observation.",
                recommended_action="Record the daily milk volume to monitor herd production trends.",
            )

        # Case 2: Data quality issue (negative or biologically implausible)
        if actual_yield < 0.0 or actual_yield > cls.MAX_PLAUSIBLE_DAILY_YIELD:
            return AnomalyResult(
                anomaly_status=AnomalyStatus.DATA_QUALITY_ISSUE,
                actual_yield=actual_yield,
                expected_baseline=baseline.expected_baseline,
                residual_liters=None,
                drop_liters=None,
                drop_percentage=None,
                z_score=None,
                is_persistent=False,
                alert_explanation=f"Recorded milk yield ({actual_yield:.1f} L) is outside plausible biological boundaries (0 to {cls.MAX_PLAUSIBLE_DAILY_YIELD} L).",
                recommended_action="Please review the entered volume and correct any transcription errors.",
            )

        # Case 3: Insufficient history (cold-start)
        if baseline.baseline_status == BaselineStatus.INSUFFICIENT_HISTORY or baseline.expected_baseline is None:
            return AnomalyResult(
                anomaly_status=AnomalyStatus.INSUFFICIENT_HISTORY,
                actual_yield=actual_yield,
                expected_baseline=None,
                residual_liters=None,
                drop_liters=None,
                drop_percentage=None,
                z_score=None,
                is_persistent=False,
                alert_explanation="First recorded milk observation for this cow. A personalized baseline cannot be established yet.",
                recommended_action="Continue recording daily milk logs over the next 1–3 days to establish an expected baseline.",
            )

        # Compute core residuals and deviations
        expected = baseline.expected_baseline
        residual = round(actual_yield - expected, 2)
        drop_liters = round(expected - actual_yield, 2)

        drop_pct = 0.0
        if expected > 0:
            drop_pct = round((drop_liters / expected) * 100.0, 1)

        variability = baseline.historical_variability or 1.0
        z_score = round(drop_liters / max(variability, 0.50), 2)

        # Case 4: Provisional baseline (limited records: 1 to 2 observations)
        if baseline.baseline_status == BaselineStatus.PROVISIONAL_BASELINE:
            if drop_pct >= cls.ACUTE_DROP_PERCENT_MIN and drop_liters >= cls.ACUTE_DROP_LITERS_MIN:
                alert_text = (
                    f"Notice: Today's milk yield ({actual_yield:.1f} L/day) is noticeably below the initial "
                    f"provisional reference ({expected:.1f} L/day). Interpret with caution while baseline history accumulates."
                )
                action_text = "Monitor the cow's feed and water intake while continuing daily milk logs."
            else:
                alert_text = (
                    f"Milk yield ({actual_yield:.1f} L/day) is consistent with provisional reference ({expected:.1f} L/day)."
                )
                action_text = "Continue daily records to establish a full baseline."

            return AnomalyResult(
                anomaly_status=AnomalyStatus.PROVISIONAL_BASELINE,
                actual_yield=actual_yield,
                expected_baseline=expected,
                residual_liters=residual,
                drop_liters=drop_liters,
                drop_percentage=drop_pct,
                z_score=z_score,
                is_persistent=False,
                alert_explanation=alert_text,
                recommended_action=action_text,
            )

        # Case 5: Established baseline evaluation
        # Check persistence across consecutive observations
        prev_had_drop = False
        if previous_drop_liters is not None and previous_drop_liters >= cls.PERSISTENT_DROP_LITERS_MIN:
            prev_had_drop = True
        elif previous_anomaly_status in (
            AnomalyStatus.UNUSUAL_DROP.value,
            AnomalyStatus.PERSISTENT_DROP.value,
            AnomalyStatus.MONITOR.value,
        ):
            prev_had_drop = True

        today_has_drop = (
            drop_liters >= cls.PERSISTENT_DROP_LITERS_MIN and (drop_pct >= cls.PERSISTENT_DROP_PERCENT_MIN or z_score >= 1.8)
        )

        if prev_had_drop and today_has_drop:
            return AnomalyResult(
                anomaly_status=AnomalyStatus.PERSISTENT_DROP,
                actual_yield=actual_yield,
                expected_baseline=expected,
                residual_liters=residual,
                drop_liters=drop_liters,
                drop_percentage=drop_pct,
                z_score=z_score,
                is_persistent=True,
                alert_explanation=(
                    f"Production has remained significantly below baseline ({expected:.1f} L/day) across consecutive records "
                    f"(current drop: -{drop_liters:.1f} L, {drop_pct:.0f}% below normal)."
                ),
                recommended_action=(
                    "Check the cow's feed intake, water access, milking routine and general condition. "
                    "If the drop persists or the cow appears unwell, consult a veterinarian."
                ),
            )

        # Check acute / unusual drop
        is_acute = drop_pct >= cls.ACUTE_DROP_PERCENT_MIN and drop_liters >= cls.ACUTE_DROP_LITERS_MIN
        is_unusual = (
            drop_liters >= cls.UNUSUAL_DROP_LITERS_MIN
            and drop_pct >= cls.UNUSUAL_DROP_PERCENT_MIN
            and z_score >= cls.UNUSUAL_Z_MIN
        )

        if is_acute or is_unusual:
            return AnomalyResult(
                anomaly_status=AnomalyStatus.UNUSUAL_DROP,
                actual_yield=actual_yield,
                expected_baseline=expected,
                residual_liters=residual,
                drop_liters=drop_liters,
                drop_percentage=drop_pct,
                z_score=z_score,
                is_persistent=False,
                alert_explanation=(
                    f"Today's recorded yield ({actual_yield:.1f} L/day) is substantially below recent baseline "
                    f"({expected:.1f} L/day), dropping by {drop_liters:.1f} L ({drop_pct:.0f}% below normal)."
                ),
                recommended_action=(
                    "Verify the entry and check the cow's feed, water access, milking routine and general condition. "
                    "If the drop persists or the cow appears unwell, consult a veterinarian."
                ),
            )

        # Check moderate monitor deviation
        is_monitor = (
            drop_liters >= cls.MONITOR_DROP_LITERS_MIN
            and (drop_pct >= cls.MONITOR_DROP_PERCENT_MIN or z_score >= cls.MONITOR_Z_MIN)
        )

        if is_monitor:
            return AnomalyResult(
                anomaly_status=AnomalyStatus.MONITOR,
                actual_yield=actual_yield,
                expected_baseline=expected,
                residual_liters=residual,
                drop_liters=drop_liters,
                drop_percentage=drop_pct,
                z_score=z_score,
                is_persistent=False,
                alert_explanation=(
                    f"Milk yield is moderately below expected baseline ({expected:.1f} L/day) by {drop_liters:.1f} L "
                    f"({drop_pct:.0f}% deviation). This may reflect normal variation or transient factors."
                ),
                recommended_action="Observe feed intake and comfort over the next 24–48 hours.",
            )

        # Case: Normal production (or positive residual)
        return AnomalyResult(
            anomaly_status=AnomalyStatus.NORMAL,
            actual_yield=actual_yield,
            expected_baseline=expected,
            residual_liters=residual,
            drop_liters=drop_liters,
            drop_percentage=drop_pct,
            z_score=z_score,
            is_persistent=False,
            alert_explanation=(
                f"Milk yield ({actual_yield:.1f} L/day) is within normal expected range for this cow's "
                f"recent baseline ({expected:.1f} L/day)."
            ),
            recommended_action="Maintain standard feeding and herd management routines.",
        )
