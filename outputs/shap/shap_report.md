# SHAP Explainability Report

This report explains model predictions for milk yield using SHAP values computed on the final trained model.

## Top features (by mean absolute SHAP)

1. **weight** — mean |SHAP|=0.7991, mean SHAP=0.0027 (positive)

2. **age** — mean |SHAP|=0.3435, mean SHAP=0.0219 (positive)

3. **age_weight_ratio** — mean |SHAP|=0.1317, mean SHAP=-0.0249 (negative)

4. **feed_thi_interaction** — mean |SHAP|=0.0298, mean SHAP=-0.0000 (negative)

5. **temperature** — mean |SHAP|=0.0078, mean SHAP=0.0005 (positive)

6. **temp_humidity** — mean |SHAP|=0.0075, mean SHAP=-0.0001 (negative)

7. **thi** — mean |SHAP|=0.0065, mean SHAP=-0.0002 (negative)

8. **humidity** — mean |SHAP|=0.0040, mean SHAP=-0.0000 (negative)

9. **feed** — mean |SHAP|=0.0036, mean SHAP=0.0000 (positive)

10. **thi_squared** — mean |SHAP|=0.0021, mean SHAP=0.0001 (positive)

11. **health_status** — mean |SHAP|=0.0015, mean SHAP=0.0001 (positive)

12. **feed_per_weight** — mean |SHAP|=0.0011, mean SHAP=-0.0001 (negative)

13. **feed_weight_ratio** — mean |SHAP|=0.0011, mean SHAP=-0.0000 (negative)

## Focused feature explanations

### thi
- Importance (mean |SHAP|): 0.0065
- Average contribution: -0.0002 (negative)
- Explanation: Temperature-Humidity Index captures combined heat stress — higher THI typically reduces milk yield; SHAP shows how THI shifts predictions for individual cows.

### age
- Importance (mean |SHAP|): 0.3435
- Average contribution: 0.0219 (positive)
- Explanation: Age affects production lifecycle; depending on parity/lactation stage, age can increase or decrease yield.

### weight
- Importance (mean |SHAP|): 0.7991
- Average contribution: 0.0027 (positive)
- Explanation: Body weight correlates with metabolic capacity and milk production; heavier cows often produce more, reflected in a positive SHAP sign when present.

### feed
- Importance (mean |SHAP|): 0.0036
- Average contribution: 0.0000 (positive)
- Explanation: Feed intake is a direct input; more feed generally supports higher yield, so SHAP often shows positive contributions for higher feed values.

## Engineered features

- **age_weight_ratio** — mean |SHAP|=0.1317, mean SHAP=-0.0249
- **feed_thi_interaction** — mean |SHAP|=0.0298, mean SHAP=-0.0000
- **thi** — mean |SHAP|=0.0065, mean SHAP=-0.0002
- **thi_squared** — mean |SHAP|=0.0021, mean SHAP=0.0001
- **feed_per_weight** — mean |SHAP|=0.0011, mean SHAP=-0.0001
- **feed_weight_ratio** — mean |SHAP|=0.0011, mean SHAP=-0.0000

## How to read these results
- Mean |SHAP| indicates feature importance averaged across the dataset.
- Mean SHAP (signed) indicates whether a feature tends to push predictions up (positive) or down (negative).

Generated files:
- shap/shap_summary.png
- shap/shap_bar.png
- shap/shap_feature_importance.csv
