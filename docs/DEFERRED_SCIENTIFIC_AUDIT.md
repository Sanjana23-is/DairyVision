# DairyVision AI — Deferred Scientific & ML Pipeline Audit

**Status:** DEFERRED TO SEPARATE SCIENTIFIC PHASE
**Date:** 2026-10-20
**Scope Notice:** As requested, this document tracks all identified scientific questions, mathematical formulas, biological thresholds, and feature alignment issues that are intentionally **not** being modified in this engineering and product stabilization phase.

---

## 1. Identified Scientific Issues Deferred for Review

### Issue 1: THI Formula Formulation Discrepancy
- **Affected Files:**
  - `backend/app/services/weather_service.py` (`calculate_thi`)
  - `ml_engine/feature_engineering.py` (`compute_thi`)
  - `ml_engine/thi_audit.py`
  - `backend/app/services/feature_engineering_service.py`
- **Description:**
  - `backend/app/services/weather_service.py` implements Thom's (1959) / Kibler (1964) Temperature-Humidity Index formula:
    $$\text{THI}_{\text{Thom}} = (1.8 \times T + 32) - (0.55 - 0.0055 \times \text{RH}) \times (1.8 \times T - 26)$$
    For $T = 30^\circ\text{C}, \text{RH} = 60\%$, this yields **$\approx 79.84$**.
  - `ml_engine/feature_engineering.py` trained the XGBoost regression model using the NRC (2001) adaptation for Celsius:
    $$\text{THI}_{\text{NRC}} = (0.8 \times T) + \left(\frac{\text{RH}}{100}\right) \times (T - 14.4) + 16.4$$
    For $T = 30^\circ\text{C}, \text{RH} = 60\%$, this yields **$\approx 49.76$**.
- **Potential Impact:**
  - When live weather logs created via `weather_service.py` are fed into `feature_engineering_service.py`, the `thi`, `thi_squared`, and `feed_thi_interaction` features receive values approximately 30 points higher than the data distribution used during XGBoost training (`mean THI ~ 58.3`).
- **Deferred Actions:**
  - Formal alignment between training data generation and production weather service.
  - Literature review on whether NRC (2001) or Thom (1959) index is the target standard for tropical/Indian cattle breeds.

---

### Issue 2: Heat-Stress Category Thresholds & Breed Sensitivity
- **Affected Files:**
  - `backend/app/services/health_alert_service.py` (lines 267, 283, 302, 308)
  - `backend/app/services/anomaly_detection_service.py` (line 84)
  - `ml_engine/thi_audit.py` (lines 65–80)
- **Description:**
  - In `health_alert_service.py`, the threshold for acute heat stress is hardcoded at $\text{THI} \ge 80.0$ and mild heat stress at $\text{THI} \ge 70.0$.
  - In `ml_engine/thi_audit.py`, categories are:
    - No Stress: $< 60$
    - Mild: $60 \le \text{THI} < 70$
    - Moderate: $70 \le \text{THI} < 79$
    - Severe: $79 \le \text{THI} < 90$
    - Emergency: $\ge 90$
  - Furthermore, Bos indicus (Zebu breeds like Gir and Sahiwal) exhibit substantially higher thermal tolerance than Bos taurus (Holstein, Jersey), but current thresholds do not adjust for breed genetics.
- **Potential Impact:**
  - Indigenous cattle (Gir, Sahiwal) may trigger heat stress warnings prematurely if thresholds calibrated for European Holstein-Friesian cattle are applied uniformly.
- **Deferred Actions:**
  - Calibrate breed-specific thermal thresholds (Zebu vs Exotic/Crossbred).
  - Unify categorical threshold constants in `ml_engine/config.py`.

---

### Issue 3: Model Target & Prediction Calibration Transparency
- **Affected Files:**
  - `ml_engine/train.py`
  - `ml_engine/evaluate.py`
  - `backend/app/services/prediction_service.py`
- **Description:**
  - The model achieves $R^2 = 0.1848$ and $\text{MAE} = 2.04\text{ L/day}$ on hold-out data. Permutation feature importance shows cow weight ($\Delta R^2 = 0.2687$) and age ($\Delta R^2 = 0.0701$) dominate the prediction, with weather interaction having a smaller statistical weight.
- **Potential Impact:**
  - If presented as an exact microclimate milk yield predictor without uncertainty bounds, judges may question the statistical significance of daily temperature fluctuations relative to baseline animal weight and lactation curve.
- **Deferred Actions:**
  - Display confidence intervals transparently on all prediction cards.
  - Explore quantile regression or conformal prediction intervals in the next ML iteration.

---

## 2. Policy for Current Phase

In accordance with user instructions:
1. **No mathematical formulas, constants, or scientific calculations have been altered** in this phase.
2. The software engineering layer, API validation, database schema, demo data reliability, and frontend user flows are being optimized independently of the deferred scientific audit.
3. The scientific layer is explicitly documented as **under active review** and not yet fully validated.
