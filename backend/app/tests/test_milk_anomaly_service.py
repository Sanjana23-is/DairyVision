from datetime import date
import pytest

from app.services.milk_baseline_service import BaselineResult, BaselineStatus
from app.services.milk_anomaly_service import MilkAnomalyService, AnomalyStatus


def _mock_established_baseline(expected: float = 18.0, variability: float = 0.8) -> BaselineResult:
    return BaselineResult(
        cow_id="cow-123",
        target_date=date(2026, 10, 10),
        expected_baseline=expected,
        baseline_status=BaselineStatus.ESTABLISHED_BASELINE,
        observations_used=7,
        baseline_window_days=7,
        method="rolling_median_7d",
        historical_variability=variability,
        previous_day_yield=expected,
    )


def test_normal_production_within_typical_range():
    baseline = _mock_established_baseline(expected=18.0, variability=0.8)
    # 17.5 L is a minor drop of 0.5 L (2.8%), well within normal variance
    res = MilkAnomalyService.evaluate_observation(actual_yield=17.5, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.NORMAL
    assert res.residual_liters == -0.50
    assert res.drop_liters == 0.50
    assert res.drop_percentage == 2.8
    assert res.is_persistent is False
    assert "within normal expected range" in res.alert_explanation


def test_higher_than_expected_yield_is_normal():
    baseline = _mock_established_baseline(expected=18.0, variability=0.8)
    res = MilkAnomalyService.evaluate_observation(actual_yield=20.5, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.NORMAL
    assert res.residual_liters == 2.50
    assert res.drop_liters == -2.50
    assert res.drop_percentage == -13.9
    assert res.is_persistent is False


def test_moderate_deviation_triggers_monitor():
    baseline = _mock_established_baseline(expected=18.0, variability=0.8)
    # Drop of 2.2 L (12.2%), z = 2.2 / 0.8 = 2.75 -> triggers monitor
    res = MilkAnomalyService.evaluate_observation(actual_yield=15.8, baseline=baseline)

    assert res.anomaly_status in (AnomalyStatus.MONITOR, AnomalyStatus.UNUSUAL_DROP)
    assert res.drop_liters == 2.20
    assert res.drop_percentage == 12.2
    assert "below expected baseline" in res.alert_explanation


def test_large_unusual_drop_triggers_unusual_drop():
    baseline = _mock_established_baseline(expected=18.0, variability=0.8)
    # The Gauri case: baseline was ~17.7 L, actual was 9.2 L! Drop of 8.8 L (48.9%)
    res = MilkAnomalyService.evaluate_observation(actual_yield=9.2, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.UNUSUAL_DROP
    assert res.drop_liters == 8.80
    assert res.drop_percentage == 48.9
    assert res.z_score is not None and res.z_score > 3.0
    assert res.is_persistent is False
    assert "substantially below recent baseline" in res.alert_explanation
    # Verify non-diagnostic action
    assert "feed, water access, milking routine and general condition" in res.recommended_action
    assert "diagnosed" not in res.recommended_action.lower()


def test_persistent_drop_across_consecutive_records():
    baseline = _mock_established_baseline(expected=18.0, variability=0.8)

    # Today drop is 4.0 L (22%), and yesterday also had a drop of 3.5 L
    res = MilkAnomalyService.evaluate_observation(
        actual_yield=14.0,
        baseline=baseline,
        previous_drop_liters=3.5,
        previous_anomaly_status="unusual_drop",
    )

    assert res.anomaly_status == AnomalyStatus.PERSISTENT_DROP
    assert res.is_persistent is True
    assert "remained significantly below baseline" in res.alert_explanation
    assert "consecutive records" in res.alert_explanation


def test_recovery_after_drop_resets_to_normal():
    baseline = _mock_established_baseline(expected=18.0, variability=0.8)

    # Yesterday had an unusual drop, but today yield rebounded to 18.2 L
    res = MilkAnomalyService.evaluate_observation(
        actual_yield=18.2,
        baseline=baseline,
        previous_drop_liters=4.0,
        previous_anomaly_status="unusual_drop",
    )

    assert res.anomaly_status == AnomalyStatus.NORMAL
    assert res.is_persistent is False
    assert res.residual_liters == 0.20


def test_missing_actual_observation_yield():
    baseline = _mock_established_baseline(expected=18.0)
    res = MilkAnomalyService.evaluate_observation(actual_yield=None, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.MISSING_OBSERVATION
    assert res.actual_yield is None
    assert "No milk yield recorded" in res.alert_explanation


def test_negative_yield_data_quality_issue():
    baseline = _mock_established_baseline(expected=18.0)
    res = MilkAnomalyService.evaluate_observation(actual_yield=-5.0, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.DATA_QUALITY_ISSUE
    assert "outside plausible biological boundaries" in res.alert_explanation


def test_implausible_extreme_yield_data_quality_issue():
    baseline = _mock_established_baseline(expected=18.0)
    res = MilkAnomalyService.evaluate_observation(actual_yield=150.0, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.DATA_QUALITY_ISSUE
    assert "outside plausible biological boundaries" in res.alert_explanation


def test_cold_start_insufficient_history():
    baseline = BaselineResult(
        cow_id="cow-new",
        target_date=date(2026, 10, 10),
        expected_baseline=None,
        baseline_status=BaselineStatus.INSUFFICIENT_HISTORY,
        observations_used=0,
        baseline_window_days=7,
        method="none",
        historical_variability=None,
        previous_day_yield=None,
    )

    res = MilkAnomalyService.evaluate_observation(actual_yield=15.0, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.INSUFFICIENT_HISTORY
    assert res.expected_baseline is None
    assert res.drop_liters is None
    assert "personalized baseline cannot be established yet" in res.alert_explanation


def test_provisional_baseline_soft_alerting():
    baseline = BaselineResult(
        cow_id="cow-provisional",
        target_date=date(2026, 10, 10),
        expected_baseline=17.0,
        baseline_status=BaselineStatus.PROVISIONAL_BASELINE,
        observations_used=2,
        baseline_window_days=7,
        method="provisional_median",
        historical_variability=1.0,
        previous_day_yield=17.0,
    )

    # Moderate drop on provisional baseline does not create alarmist alert
    res = MilkAnomalyService.evaluate_observation(actual_yield=15.0, baseline=baseline)

    assert res.anomaly_status == AnomalyStatus.PROVISIONAL_BASELINE
    assert "provisional reference" in res.alert_explanation
    assert res.is_persistent is False
