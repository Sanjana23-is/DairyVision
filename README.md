# Smart Dairy Farm Digital Twin

A research-grade machine learning pipeline for predicting milk yield under
real-time ambient conditions, with a digital twin what-if simulation engine.

---

## Project structure

```
smart_dairy_twin/
├── config.py               Central config — all paths, hyperparameters, constants
├── weather.py              Open-Meteo API integration with robust fallback
├── data_loader.py          CSV loading, explicit-key merging, cleaning
├── feature_engineering.py  THI, feed/weight ratio, synthetic weather assignment
├── train.py                k-fold CV, Wilcoxon model selection, optional tuning
├── evaluate.py             Diagnostics, permutation importance, residual plots
├── simulate.py             Digital twin simulation with prediction intervals
├── run_pipeline.py         Master orchestrator — run everything in one command
│
├── datasets/               (not in repo — place your CSVs here)
│   ├── global_cattle_disease_detection_dataset.csv
│   └── global_cattle_milk_yield_prediction_dataset.csv
│
├── models/                 Saved trained model (auto-created)
├── outputs/                All plots, tables, reports (auto-created)
└── logs/                   Per-step log files (auto-created)
```

---

## Quick start

### 1. Install dependencies

```bash
pip install scikit-learn xgboost pandas numpy plotly scipy joblib requests kaleido
```

### 2. Place datasets

Copy your two CSV files into `datasets/`:

```
datasets/global_cattle_disease_detection_dataset.csv
datasets/global_cattle_milk_yield_prediction_dataset.csv
```

Both files must share a `Cattle_ID` column (the join key).

### 3. Run the full pipeline

```bash
python run_pipeline.py
```

This executes all six steps in order and prints a checklist of output files.

### 4. Run with hyperparameter tuning (recommended for publication)

```bash
python run_pipeline.py --tune
```

Adds ~3–5 minutes but searches for better XGBoost and Random Forest
parameters via RandomizedSearchCV (30 iterations each).

---

## Running individual steps

```bash
python train.py           # Train all models (fast defaults)
python train.py --tune    # Train with hyperparameter search
python evaluate.py        # Evaluation diagnostics + plots
python simulate.py        # Digital twin simulation
```

---

## Output files

| File | Description |
|------|-------------|
| `outputs/cv_results.csv` | Per-fold R², MAE, RMSE for every model |
| `outputs/paper_table_model_comparison.csv` | Mean ± std table for Methods section |
| `outputs/test_metrics.csv` | Hold-out test metrics (MAE, RMSE, R², MAPE) |
| `outputs/feature_importance.csv` | Permutation importance (primary) + MDI |
| `outputs/simulation_results.csv` | Full simulation grid with prediction intervals |
| `outputs/monotonicity_report.txt` | Biological validity audit of simulation |
| `outputs/cv_r2_boxplot.png` | CV R² distribution by model |
| `outputs/predicted_vs_actual.png` | Scatter with identity line |
| `outputs/residuals_vs_fitted.png` | Residual plot |
| `outputs/residual_histogram.png` | Residual distribution |
| `outputs/feature_importance.png` | Horizontal bar chart with error bars |
| `outputs/simulation_feedlines.png` | Feed × yield lines with PI bands |
| `outputs/simulation_heatmap.png` | Colour heatmap over temp × feed grid |
| `outputs/simulation_thi_impact.png` | THI vs yield at median feed |
| `models/best_milk_model.pkl` | Serialised best model |

---

## Research design decisions

### Target variable integrity
The target (`milk_output`, in L/day) is never modified.
Earlier versions subtracted a hand-coded stress formula from `y`, then
compared models trained on different targets — an invalid comparison.
Here, temperature and humidity appear only as **input features**; their
relationship with yield is learned entirely from data.

### Feature: Temperature-Humidity Index (THI)
THI is the standard physiological heat-stress composite used in dairy
science (NRC, 2001):

    THI = T − (0.31 − 0.31 × RH/100) × (T − 14.4) − 32

| THI | Stress level |
|-----|-------------|
| < 68 | None |
| 68–72 | Mild |
| 72–80 | Moderate |
| 80–88 | Severe |
| ≥ 88 | Emergency |

THI is added as a feature because it captures the nonlinear
temperature × humidity interaction that raw features cannot represent
independently, and because it is the standard reporting unit in the
veterinary literature.

### Model evaluation
- 5-fold cross-validation with `KFold(shuffle=True, random_state=42)`.
- A `DummyRegressor(strategy='mean')` is the mandatory naive baseline.
  Any model that does not exceed it cannot justify its complexity.
- Model selection uses mean CV R², confirmed with a Wilcoxon signed-rank
  test on fold-level R² values to establish statistical significance.

### Synthetic weather assignment
Source records lack timestamps, so exact historical weather cannot be
matched. Ambient conditions are approximated by Gaussian perturbation
around the real-time API baseline (σ_T = 2.5°C, σ_H = 7.5%).
This is declared as a limitation; future work should integrate IoT
sensor time-series.

### Digital twin prediction intervals
Prediction intervals (90%) use the "forest of trees" quantile method
(Meinshausen, 2006): individual tree outputs from a 500-tree Random
Forest give the 5th–95th percentile band. This is wider than a confidence
interval — it reflects both model uncertainty and data variability.

---

## References

- National Research Council (2001). *Nutrient Requirements of Dairy Cattle*.
  7th ed. National Academy Press, Washington, DC.
- Meinshausen, N. (2006). Quantile regression forests.
  *Journal of Machine Learning Research*, 7, 983–999.
- West, J. W. (2003). Effects of heat-stress on production in dairy cattle.
  *Journal of Dairy Science*, 86(6), 2131–2144.
- Bohmanova, J., Misztal, I., & Cole, J. B. (2007). Temperature-humidity
  indices as indicators of milk production losses due to heat stress.
  *Journal of Dairy Science*, 90(4), 1947–1956.

---

## Citing this work

If you use this pipeline in a published study, please cite the datasets
and acknowledge the Open-Meteo API for real-time weather data
(https://open-meteo.com).
