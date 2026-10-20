# DairyVision AI — Live Hackathon Demo & Judging Script

**Demo Farm:** Luna Smart Dairy Farm (Bengaluru, India)
**Documented Demo Account:** `demo.farmer@dairyvision.ai`
**Demo Password:** Use authorized demo credentials supplied separately.
**Presentation Time:** ~5–7 Minutes

---

## 1. Verified Startup Sequence

### Step 1: Backend API Server
```bash
cd backend
# Launch Uvicorn on port 8000
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Health Verification:** Open [http://localhost:8000/api/v1/health/system](http://localhost:8000/api/v1/health/system)
  *Expected Output:* `{"status":"ok", "database":"healthy", "ml_model_loaded":true, "active_herd_size":5}`

### Step 2: Frontend Web Client
```bash
cd frontend
# Launch Vite dev server on port 3000
npm run dev
```
- **Web Verification:** Open [http://localhost:3000](http://localhost:3000)

### Step 3: Run Deterministic Demo Data Seeding (If Needed)
```bash
cd backend
PYTHONPATH=. python -m app.seeds.demo_seed
```
*Instantly seeds/restores 5 cattle, 35 observations, 10 predictions, 10 SHAP results, 10 anomalies, 10 health alerts, and 10 recommendations.*

### Step 4: Run Automated Regression & E2E Smoke Tests
```bash
# Backend pytest suite (146 tests)
cd backend
PYTHONPATH=. pytest app/tests

# Frontend production build
cd frontend
npm run build

# Playwright E2E browser smoke test
cd frontend
npx playwright test
```

---

## 2. End-to-End Judge Demonstration Storyboard

### Scene 1: Executive Operations Dashboard (`/dashboard`)
- **Action:** Log in with `demo.farmer@dairyvision.ai` and open the Dashboard.
- **Talking Point:** *"DairyVision AI isn't just an IoT dashboard—it's a digital twin and decision intelligence platform. You're looking at Luna Farm in Bengaluru. We have 5 monitored indigenous and commercial cows. Today's actual production is 93.6 L against an AI-expected yield of 89.0 L."*
- **What Judges See:**
  - Real-time KPI cards: Total Milk Produced (L), Expected Milk Yield (L), Active Cows (5), Health Risk Flags (1 Critical, 4 Warning).
  - Production Trend Charts: 7-day milk history vs model expectation.
  - Active Health Alerts & Weather: Ambient temperature and humidity from Open-Meteo.

### Scene 2: The Herd Digital Twin (`/digital-twin`)
- **Action:** Click **Digital Twin** in the navigation bar.
- **Talking Point:** *"Every cow has a living digital twin synchronized with her recent milk history, feed intake, body temperature, and microclimate THI. Notice cow 'Ganga' has a 77.0 vitality score, while 'Lakshmi' has dropped to 27.0 Vitality (Critical)."*
- **What Judges See:**
  - Herd Vitality Overview: 65.0 Average Vitality Score, Health Status Distribution, Heat Stress Distribution.
  - Individual Cow Twin Cards: Real-time status, daily yield vs predicted yield, vital signs (Temperature, Rumination proxy, Feeding efficiency).

### Scene 3: Cow Profile & Deep Links (`/cows` -> Cow Details)
- **Action:** Navigate to Cows -> Select **Ganga** (`KA-01-G-101`).
- **Talking Point:** *"From Ganga's clinical profile, a farm manager can immediately dive into two core AI capabilities: SHAP feature explainability and What-If sandbox simulations. Notice the deep-link buttons directly below her production stats."*
- **What Judges See:**
  - Cow breed (Gir), lactation stage, weight (445 kg), 7-day milk history.
  - Quick-action buttons: **"Why This Prediction? (SHAP)"** and **"Simulate This Cow (What-If)"**.

### Scene 4: Genuine AI Milk Yield Prediction & SHAP Explainability (`/explainability`)
- **Action:** Click **"Why This Prediction? (SHAP)"** from Ganga's profile.
- **Talking Point:** *"Most hackathon projects display static numbers or call a generic LLM. DairyVision AI runs a real in-process XGBoost regressor trained with biological monotonicity constraints. Even more importantly for dairy farmers who need to trust AI: we run SHAP (TreeExplainer) on every single prediction."*
- **What Judges See:**
  - **Predicted Milk Yield:** Prominent forecast in L/day with model status indicators.
  - **Prediction Range Display:** Shows dynamic uncertainty interval bounds calculated from residual history (or explicit single-point forecast notice when historical calibration data is limited).
  - **SHAP Feature Impact Cards:**
    - Live positive feature contributions (e.g., Weight, Intake)
    - Live negative feature contributions (e.g., Ambient heat stress penalty)
    - Clear fallback notice: *"No positive/negative SHAP contributions recorded"* if contributions are 0.
  - **Plain-Language Farmer Narrative:** *"Daily feed intake is the strongest factor supporting predicted yield, while heat stress index lowers the prediction."*

### Scene 5: What-If Scenario Simulation with Economic ROI (`/simulation`)
- **Action:** Return to Ganga's profile and click **"Simulate This Cow (What-If)"**.
- **Talking Point:** *"Before spending money on feed supplements or cooling fans, a dairy farmer can simulate interventions. Ganga is automatically pre-selected from the deep link URL."*
- **Interact with Controls:**
  - Slide **Feed Adjustment**: +2.0 kg.
  - Toggle **Cooling Intervention**: Activated (-3°C effective temperature drop).
  - Click **Run Simulation**.
- **What Judges See:**
  - Simulated yield updates dynamically.
  - **Estimated Financial Impact Card:**
    - Additional Milk Revenue: Calculated at farm rate (e.g. ₹40/L).
    - Additional Feed Cost: Calculated at farm rate (e.g. ₹22/kg).
    - **Estimated Daily Net Benefit:** Explicitly framed as a decision-support prediction rather than a guaranteed outcome.
    - Clear decision classification: **"Positive Financial Impact"** (or "Near Break-Even" / "Negative Financial Impact").
    - **Transparency Note:** Cites specific pricing assumptions and 30-day projection horizon.

### Scene 6: Anomaly Detection & Herd Health Risk (`/health-alerts`)
- **Action:** Click **Health Alerts / Risk Center**.
- **Talking Point:** *"We distinguish anomaly detection from veterinary diagnosis. Our hybrid engine combines rule-based physiological triggers with an Isolation Forest outlier model. Look at cow 'Lakshmi': she suffered a 35% sudden milk drop coupled with a 39.8°C temperature spike."*
- **What Judges See:**
  - "Critical High Temperature Spike" alert on Lakshmi.
  - Deduplicated, actionable recommendations linked directly to the anomaly.

---

## 3. High-Value Judge-Facing Technical Talking Points

1. **Monotonicity Constraints in XGBoost:**
   *"We enforce monotonic constraints during training: yield must never decrease when feed increases or cow weight increases, ensuring biologically sound predictions even on edge-case inputs."*
2. **Thermal & Bioclimatic Modeling (Under Scientific Review):**
   *"We track temperature-humidity indices and heat-stress exposure; our formal audit comparing Thom (1959) vs NRC (2001) formulations and breed-specific thermal thresholds is documented in `docs/DEFERRED_SCIENTIFIC_AUDIT.md` for our next dedicated scientific phase."*
3. **Local Explainable AI (SHAP):**
   *"Instead of showing global dataset averages, our SHAP TreeExplainer evaluates the local feature attribution for that specific cow's observation on that specific day."*
4. **Data Isolation & Tenant Security:**
   *"Every query is scoped by ownership. Farm workers cannot view or modify cattle records belonging to another farm tenant."*
5. **No Synthetic Data Faking in Production:**
   *"If the weather API fails or coordinates are missing, we never pretend we have fresh sensor data; we surface an honest fallback and notify the user."*

---

## 4. Troubleshooting & Network Backup Plan

| Issue During Live Demo | Immediate Quick Fix |
| :--- | :--- |
| **No Internet / Wi-Fi Drops** | Open-Meteo requests will time out. The backend automatically switches to cached `WeatherLog` entries from the 7-day seeded history without interrupting the UI. Resilient offline JWT authentication allows local login using `demo.farmer@dairyvision.ai`. |
| **Accidental Data Reset or Cow Deletion** | Restore demo data only after reviewing the seed script and confirming the target database is safe to modify. |
| **Port Conflict on Port 8000** | Check `lsof -i :8000` and restart uvicorn. |
| **Session / Token Expired** | Log in with `demo.farmer@dairyvision.ai`. |
