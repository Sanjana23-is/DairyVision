# Health Alert Summary

Actionable health alerts for dairy farmers based on THI and predicted yield decline.

## Alert counts
- Health Risk Alert: 41
- Heat Stress Alert: 550
- Productivity Alert: 0
- No Alert: 2409

## Severity summary
- Critical: 41
- High: 158
- Medium: 392
- Low: 2409

## THI stress category distribution
- No Stress: 1701
- Mild: 708
- Moderate: 392
- Severe: 158
- Emergency: 41

## Recommendation examples
- COW00001: Heat Stress Alert (Medium) — Moderate heat stress detected. Monitor cattle closely and provide ventilation and water access.
- COW00006: Heat Stress Alert (Medium) — Moderate heat stress detected. Monitor cattle closely and provide ventilation and water access.
- COW00014: Heat Stress Alert (Medium) — Moderate heat stress detected. Monitor cattle closely and provide ventilation and water access.
- COW00016: Health Risk Alert (Critical) — Critical heat stress or productivity decline detected. Consider emergency cooling, veterinary assessment, and hydration.
- COW00025: Heat Stress Alert (Medium) — Moderate heat stress detected. Monitor cattle closely and provide ventilation and water access.

## Alert rules
- THI >= 70: Heat Stress Alert
- THI >= 79: Heat Stress Alert (High)
- THI >= 90: Health Risk Alert (Critical)
- Predicted yield decline > 10%: Productivity Alert
- Predicted yield decline > 20%: Health Risk Alert / Critical
