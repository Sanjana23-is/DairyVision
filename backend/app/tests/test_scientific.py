"""
test_scientific.py
==================
Unit tests for app.core.scientific module.
"""

import pytest
from app.core.scientific import (
    calculate_thi,
    get_heat_stress_category,
    get_heat_stress_details,
    HeatStressLevel,
    THI_COMFORT_MAX,
    THI_MILD_MAX,
    THI_MODERATE_MAX,
    THI_ACUTE_THRESHOLD,
)


def test_calculate_thi_known_values():
    # Test 30°C and 60% RH -> standard Thom THI is approx 79.84
    thi = calculate_thi(30.0, 60.0)
    assert abs(thi - 79.84) < 0.01

    # Test 20°C and 50% RH (cool, comfortable)
    thi_cool = calculate_thi(20.0, 50.0)
    assert thi_cool < 68.0

    # Test 38°C and 80% RH (extreme heat emergency)
    thi_extreme = calculate_thi(38.0, 80.0)
    assert thi_extreme > 90.0


def test_calculate_thi_clamping():
    # Negative humidity should be clamped to 0.0
    thi_clamped_low = calculate_thi(30.0, -10.0)
    thi_zero = calculate_thi(30.0, 0.0)
    assert thi_clamped_low == thi_zero

    # Humidity > 100 should be clamped to 100.0
    thi_clamped_high = calculate_thi(30.0, 150.0)
    thi_100 = calculate_thi(30.0, 100.0)
    assert thi_clamped_high == thi_100


def test_heat_stress_category_mapping():
    assert get_heat_stress_category(65.0) == HeatStressLevel.COMFORT
    assert get_heat_stress_category(70.0) == HeatStressLevel.MILD
    assert get_heat_stress_category(75.0) == HeatStressLevel.MODERATE
    assert get_heat_stress_category(82.0) == HeatStressLevel.SEVERE
    assert get_heat_stress_category(92.0) == HeatStressLevel.EMERGENCY


def test_get_heat_stress_details():
    details = get_heat_stress_details(80.0)
    assert details["level"] == HeatStressLevel.SEVERE.value
    assert details["is_alert"] is True
    assert details["estimated_yield_loss_kg_day"] > 0
    assert len(details["recommended_actions"]) > 0

    comfort_details = get_heat_stress_details(65.0)
    assert comfort_details["level"] == HeatStressLevel.COMFORT.value
    assert comfort_details["is_alert"] is False
    assert comfort_details["estimated_yield_loss_kg_day"] == 0.0
