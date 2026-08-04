# Genetics Analytics Report

This independent genetics analytics module evaluates superior dairy cattle sires and predicts genetic milk production potential.

Generated: 2026-06-13T19:03:49.550392Z

## Dataset and target
- Dataset: Superior Dairy Cattle Sires
- Target: Total Milk Yield
- Features: Peak Yield, Days To Peak, Lactation Length, Corrected Milk Yield, Dry Days

## Cross-validation results

            Model  R2_Mean   R2_STD   MAE_Mean  RMSE_Mean
    Random Forest 0.952057 0.029048 139.550000 142.454498
Linear Regression 0.944465 0.043182  84.735133  98.226386
          XGBoost 0.614814 0.279447 267.022266 275.614796


## Test metrics

            Model       R2        MAE       RMSE
Linear Regression 0.909224 104.707323 132.567526
    Random Forest 0.521172 236.075000 304.468523
          XGBoost 0.819305 180.186035 187.036381


## Top predicted sire rankings

Sire_ID  mean_actual_total_milk_yield  mean_predicted_total_milk_yield  count_records
SIRE009                       12730.0                         12620.00              1
SIRE004                       12500.0                         12499.05              1
SIRE006                       12100.0                         12138.65              1
SIRE002                       11850.0                         11818.60              1
SIRE008                       11720.0                         11732.60              1
SIRE005                       11450.0                         11488.85              1
SIRE001                       11200.0                         11163.95              1
SIRE007                       10820.0                         10820.10              1
SIRE003                       10500.0                         10525.45              1
SIRE010                       10280.0                         10404.95              1


## Output artifacts
- genetics_cv_results.csv
- genetics_test_metrics.csv
- genetics_model_comparison.csv
- genetics_feature_importance.csv
- sire_ranking.csv
- top_sires.png
- predicted_vs_actual.png
- feature_importance.png
