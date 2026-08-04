# SHAP Explainability Report

This report explains model predictions for milk yield using SHAP values computed on the final trained model.

## Top features (by mean absolute SHAP)

1. **weight** — mean |SHAP|=0.8084, mean SHAP=0.0153 (positive)

2. **age** — mean |SHAP|=0.3260, mean SHAP=-0.0033 (negative)

3. **age_weight_ratio** — mean |SHAP|=0.1134, mean SHAP=-0.0064 (negative)

4. **feed_thi_interaction** — mean |SHAP|=0.0324, mean SHAP=0.0028 (positive)

5. **feed** — mean |SHAP|=0.0237, mean SHAP=-0.0017 (negative)

6. **feed_weight_ratio** — mean |SHAP|=0.0136, mean SHAP=-0.0064 (negative)

7. **temperature** — mean |SHAP|=0.0100, mean SHAP=0.0005 (positive)

8. **temp_humidity** — mean |SHAP|=0.0094, mean SHAP=-0.0009 (negative)

9. **humidity** — mean |SHAP|=0.0076, mean SHAP=0.0002 (positive)

10. **thi** — mean |SHAP|=0.0060, mean SHAP=0.0000 (positive)

11. **health_status** — mean |SHAP|=0.0009, mean SHAP=0.0001 (positive)

12. **feed_per_weight** — mean |SHAP|=0.0000, mean SHAP=0.0000 (neutral)

13. **thi_squared** — mean |SHAP|=0.0000, mean SHAP=0.0000 (neutral)

## Focused feature explanations

### thi
- Importance (mean |SHAP|): 0.0060
- Average contribution: 0.0000 (positive)
- Explanation: Temperature-Humidity Index captures combined heat stress — higher THI typically reduces milk yield; SHAP shows how THI shifts predictions for individual cows.

### age
- Importance (mean |SHAP|): 0.3260
- Average contribution: -0.0033 (negative)
- Explanation: Age affects production lifecycle; depending on parity/lactation stage, age can increase or decrease yield.

### weight
- Importance (mean |SHAP|): 0.8084
- Average contribution: 0.0153 (positive)
- Explanation: Body weight correlates with metabolic capacity and milk production; heavier cows often produce more, reflected in a positive SHAP sign when present.

### feed
- Importance (mean |SHAP|): 0.0237
- Average contribution: -0.0017 (negative)
- Explanation: Feed intake is a direct input; more feed generally supports higher yield, so SHAP often shows positive contributions for higher feed values.

## Engineered features

- **age_weight_ratio** — mean |SHAP|=0.1134, mean SHAP=-0.0064
- **feed_thi_interaction** — mean |SHAP|=0.0324, mean SHAP=0.0028
- **feed_weight_ratio** — mean |SHAP|=0.0136, mean SHAP=-0.0064
- **thi** — mean |SHAP|=0.0060, mean SHAP=0.0000
- **feed_per_weight** — mean |SHAP|=0.0000, mean SHAP=0.0000
- **thi_squared** — mean |SHAP|=0.0000, mean SHAP=0.0000

## How to read these results
- Mean |SHAP| indicates feature importance averaged across the dataset.
- Mean SHAP (signed) indicates whether a feature tends to push predictions up (positive) or down (negative).

Generated files:
- shap/shap_summary.png
- shap/shap_bar.png
- shap/shap_feature_importance.csv
