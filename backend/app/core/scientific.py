"""
scientific.py
=============
Centralized Scientific Intelligence Module for DairyVision AI.

Provides the single source of truth for:
1. Temperature-Humidity Index (THI) calculation (Thom 1959 / Kibler 1964 standard).
2. Heat-stress thresholds based on dairy cattle physiological research (NRC / Armstrong / Collier).
3. Stage categorization and actionable mitigation guidance.
"""

from enum import Enum
from typing import Dict, Any


class HeatStressLevel(str, Enum):
    COMFORT = "Comfort"
    MILD = "Mild Stress"
    MODERATE = "Moderate Stress"
    ACUTE = "Acute Heat Stress"
    SEVERE = "Severe Stress"
    EMERGENCY = "Emergency"


# ── Canonical Physiological Thresholds (Thom / Dairy Science Scale) ───────────
THI_COMFORT_MAX = 68.0
THI_MILD_MAX = 72.0
THI_MODERATE_MAX = 78.0
THI_ACUTE_THRESHOLD = 78.0
THI_SEVERE_MAX = 88.0


def calculate_thi(temperature_c: float, humidity_pct: float) -> float:
    """
    Calculate Temperature-Humidity Index (THI) using the standardized
    Thom (1959) / Kibler (1964) formulation adapted for Celsius:

        THI = (1.8 * T + 32) - (0.55 - 0.0055 * RH) * (1.8 * T - 26)

    Parameters
    ----------
    temperature_c : float
        Dry-bulb ambient temperature in Celsius (°C).
    humidity_pct : float
        Relative humidity in percentage (0.0 to 100.0).

    Returns
    -------
    float
        Dimensionless Temperature-Humidity Index rounded to 2 decimal places.
    """
    t = float(temperature_c)
    rh = max(0.0, min(100.0, float(humidity_pct)))
    thi = (1.8 * t + 32.0) - (0.55 - 0.0055 * rh) * (1.8 * t - 26.0)
    return round(thi, 2)


def get_heat_stress_category(thi: float) -> HeatStressLevel:
    """
    Map a THI value to its physiological heat-stress level for dairy cattle.

    References:
    - Armstrong, D. V. (1994). Heat stress interaction with shade and cooling.
    - Collier, R. J. et al. (2006). Genes involved in nutritional and thermal stress.
    """
    val = float(thi)
    if val < THI_COMFORT_MAX:
        return HeatStressLevel.COMFORT
    elif val < THI_MILD_MAX:
        return HeatStressLevel.MILD
    elif val < THI_MODERATE_MAX:
        return HeatStressLevel.MODERATE
    elif val < THI_SEVERE_MAX:
        return HeatStressLevel.SEVERE
    else:
        return HeatStressLevel.EMERGENCY


def get_heat_stress_details(thi: float) -> Dict[str, Any]:
    """
    Return comprehensive physiological diagnostics for a given THI value.
    """
    level = get_heat_stress_category(thi)
    is_alert = thi >= THI_ACUTE_THRESHOLD

    recommendations = []
    if level == HeatStressLevel.COMFORT:
        expected_yield_loss_kg = 0.0
        impact = "Thermoneutral conditions. Optimal biological production efficiency."
    elif level == HeatStressLevel.MILD:
        expected_yield_loss_kg = 1.0
        impact = "Mild heat load. Respiration rates slightly elevated; slight DMI reduction."
        recommendations.append("Ensure continuous access to cool, fresh drinking water.")
        recommendations.append("Activate passive shade and verify natural barn airflow.")
    elif level == HeatStressLevel.MODERATE:
        expected_yield_loss_kg = 2.5
        impact = "Moderate heat stress. Noticeable panting; milk yield decline begins (~10%)."
        recommendations.append("Engage mechanical ventilation fans in holding and feeding alleys.")
        recommendations.append("Shift primary feeding schedule to cooler dawn/dusk hours.")
    elif level == HeatStressLevel.SEVERE:
        expected_yield_loss_kg = 4.5
        impact = "Severe heat stress. Rapid open-mouth panting; significant yield loss (~20%)."
        recommendations.append("Activate evaporative cooling misting/sprinklers with high-speed fans.")
        recommendations.append("Supplement diet with dietary electrolytes and buffer minerals.")
    else:
        expected_yield_loss_kg = 7.0
        impact = "Critical heat emergency. Acute hyperthermia risk; potential mortality."
        recommendations.append("Immediate physical intervention: direct water soaking and emergency cooling.")
        recommendations.append("Alert herd veterinarian immediately.")

    return {
        "thi": round(thi, 2),
        "level": level.value,
        "is_alert": is_alert,
        "impact_summary": impact,
        "estimated_yield_loss_kg_day": expected_yield_loss_kg,
        "recommended_actions": recommendations,
    }
