# 🥛 DairyVision AI — Smart Dairy Digital Twin Platform

**DairyVision AI** is an enterprise-grade AI operations and digital twin platform designed for modern dairy farm management. It integrates real-time ambient weather tracking, individual cow physiological monitoring, ML milk yield forecasting, SHAP explainability, automated health alerts, deduplicated actionable recommendations, and an interactive What-If scenario simulator.

---

## 🌟 Key Capabilities & System Features

- **🐄 Cow & Herd Management**: Complete digital profiles for individual cows, including lactation history, breed metadata, and real-time health conditions.
- **🥛 Milk Yield Prediction**: Machine learning engine leveraging historical observations, ration inputs, and real-time Temperature-Humidity Index (THI) ambient conditions.
- **🌐 Digital Twin Monitoring**: Live digital representation of individual cows and herd-wide thermal stress levels, yield deviations, and health flags.
- **🚨 Herd Health & Risk Center**: Unified monitoring of thermal stress, temperature spikes, abnormal milk drops, and behavioral anomalies.
- **🧪 What-If Scenario Simulation**: Dual herd-level and individual-cow scenario simulation engines to model yield impacts based on feed adjustments, water availability, and cooling interventions.
- **💡 AI Explainability (SHAP)**: Granular feature attribution explaining why specific yield predictions or anomaly flags occurred.
- **📋 Deduplicated Recommendations**: Real-time actionable farm recommendations that update dynamically and consolidate duplicate issues per cow/farm.

---

## 🏗 Project Structure

```
Smart_dairyvisionAI/
├── backend/                        # FastAPI Backend Application
│   ├── app/
│   │   ├── api/v1/                 # API Routes (Auth, Dairy, Digital Twin, What-If, Health, etc.)
│   │   ├── core/                   # Config, Database Engine, & Supabase Client
│   │   ├── models/                 # SQLAlchemy Database Models
│   │   ├── schemas/                # Pydantic Schemas & DTOs
│   │   ├── services/               # Core Business Logic & ML Services
│   │   ├── seeds/                  # Seed Scripts (Breed Master & Demo Datasets)
│   │   └── tests/                  # Pytest Unit & Integration Test Suite (215 passed in latest verified run)
│   ├── alembic/                    # Database Migrations (22 versions)
│   ├── requirements.txt            # Python Dependencies
│   └── main.py                     # FastAPI Application Entrypoint
│
├── frontend/                       # React 19 + Vite Frontend Application
│   ├── src/
│   │   ├── components/             # Reusable UI Components, Dialogs & Visuals
│   │   ├── pages/                  # Dashboard, Digital Twin, Simulation, Health Risk, Auth, etc.
│   │   ├── services/               # Axios API Client Services (communicates with backend)
│   │   └── context/                # Auth, Theme, & Language State Contexts
│   └── package.json                # Frontend Package Configuration
│
└── requirements.txt                # Root Dependency Shortcut
```

---

## ⚙️ Supported Runtime Versions

| Component | Supported / Recommended Version | Notes |
| :--- | :--- | :--- |
| **Python** | **Python 3.12.x** (3.12.0 – 3.12.13) | Recommended. Required for pre-built C wheels (`shap`, `numba`, `scipy`, `xgboost`). Python 3.14+ may fail during package builds. |
| **Node.js** | **Node.js 20+ LTS** (Recommended: v20.x, v22.x) | Verified in this environment on Node v26.0.0 with npm 11.12.1. While other Node 20+ LTS versions are recommended, the full historical version matrix has not been individually tested. |
| **Database** | **PostgreSQL 15+** | Either local PostgreSQL or hosted Supabase Cloud PostgreSQL. |

---

## 🚀 Fresh-Machine Setup Guide

Follow these exact steps to clone this branch and run both applications from scratch.

### 1. Clone Repository & Checkout Branch

```bash
git clone <repository-url>
cd Smart_dairyvisionAI-antigravity
git checkout feature/milk-prediction-rework
```

---

### 2. Backend Setup & Configuration

#### A. Configure Backend Environment Variables
Copy the template to create `backend/.env`:

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and configure the settings. Below are the two standard options:

- **Option 1: Using Local PostgreSQL (Fastest for offline development)**:
  ```env
  APP_NAME="DairyVision AI Backend"
  APP_ENV=development
  APP_DEBUG=true
  APP_PORT=8000
  LOG_LEVEL=INFO

  CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:5173","http://localhost"]
  FRONTEND_URL=http://localhost:3000

  DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision
  ALEMBIC_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision
  SUPABASE_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision

  # Supabase Auth Integration
  SUPABASE_URL=https://[your-project-ref].supabase.co
  SUPABASE_PUBLISHABLE_KEY=[your-publishable-anon-key]
  SUPABASE_SECRET_KEY=[your-service-role-secret-key]
  SUPABASE_JWT_SECRET=[your-supabase-jwt-secret]
  ```

- **Option 2: Using Supabase Cloud Database**:
  ```env
  # Note: ALEMBIC_DATABASE_URL MUST connect to Port 5432 (Direct or Session Pooler),
  # because DDL migrations require session-level locks that Transaction Poolers (port 6543) do not allow.
  DATABASE_URL=postgresql+psycopg://postgres:[db-password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require
  ALEMBIC_DATABASE_URL=postgresql+psycopg://postgres:[db-password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require
  SUPABASE_DATABASE_URL=postgresql+psycopg://postgres:[db-password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require

  SUPABASE_URL=https://[project-ref].supabase.co
  SUPABASE_PUBLISHABLE_KEY=[your-publishable-anon-key]
  SUPABASE_SECRET_KEY=[your-service-role-secret-key]
  SUPABASE_JWT_SECRET=[your-supabase-jwt-secret]
  ```

#### B. Create Python Virtual Environment & Install Dependencies
From the `backend/` directory:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### C. Initialize Database (Migrations & Seed Data)
Make sure your PostgreSQL database exists, then run:

```bash
# 1. Apply all 22 database schema migrations
alembic upgrade head

# 2. Seed cattle breed master data (Gir, Sahiwal, Hallikar, Jersey, Holstein-Friesian, etc.)
python -m app.seeds.run_seed

# 3. (Optional) Seed demo farm, cows, historical observations, predictions, and anomalies
python -m app.seeds.demo_seed
```

#### D. Start the Backend API Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- The backend will run at **`http://localhost:8000`**.
- Interactive Swagger API docs are accessible at **`http://localhost:8000/docs`**.

---

### 3. Frontend Setup & Configuration

#### A. Configure Frontend Environment Variables
Open a new terminal tab and navigate to the `frontend/` directory:

```bash
cd frontend
cp .env.example .env
```

The `frontend/.env` file requires only:
```env
VITE_API_URL=http://localhost:8000
```
> **Security Note:** The frontend communicates strictly with the backend API via Axios. It does **not** initialize a Supabase client directly. Do not place any Supabase secret or service-role keys in `frontend/.env`.

#### B. Install Node Dependencies & Launch Frontend
```bash
npm install
npm run dev
```

- The React application will start at **`http://localhost:3000`** (or `http://localhost:5173`).
- Open your browser to the URL displayed in the terminal.

---

### 4. Registration, Email Verification, & Login Walkthrough

1. **Register a New Account**:
   - Navigate to `http://localhost:3000/register`.
   - Enter your **Full Name**, **Email Address**, and a **Password** (minimum 8 characters).
   - Click **Create account**.

2. **Email Verification Handling**:
   - **When `SUPABASE_SECRET_KEY` (service role) is set in `backend/.env`**:
     The backend automatically provisions and confirms the user via Supabase Admin API (`email_confirm: True`). Registration immediately logs the user in and redirects to farm selection.
   - **If Supabase Email Confirmation is strictly enforced or running without an admin key**:
     Supabase will send a confirmation email. Follow the link to verify, or manually confirm the user in the Supabase Dashboard (`Authentication -> Users -> Select User -> Confirm email`).
   - **Recommended Supabase Dashboard setting for development**:
     In your Supabase project under **Authentication -> Providers -> Email**, toggle **"Confirm email" to OFF**. This bypasses email link requirements during local development.

3. **Login**:
   - Navigate to `http://localhost:3000/login`.
   - Enter your registered email and password.
   - Upon successful authentication, you are navigated to `/select-farm` or `/dashboard`.

---

## ☁️ Supabase Team Workflow: Shared vs. Individual Projects

Teammates can either configure their own isolated Supabase project or connect to a shared instance.

### Approach 1: Individual Supabase Projects (Recommended)
Providing each developer with an individual Supabase project offers the highest reliability:
- **Prevents account collisions**: Teammates can register using identical test email addresses without conflicts (`test@farm.com`, `demo.farmer@dairyvision.ai`).
- **Prevents data clobbering**: Database resets or migration experiments will not disrupt other teammates.
- **Prevents inactive tenant pausing**: Free-tier Supabase projects automatically pause after 7 days of inactivity.

*Configuration reference:* Follow **Option 2** under [Backend Setup & Configuration](#2-backend-setup--configuration) using the keys found under your Supabase Dashboard (`Project Settings -> API` and `Project Settings -> Database`). Ensure **Confirm email** is toggled to `OFF` under `Authentication -> Providers -> Email`.

### Approach 2: Sharing an Existing Team Supabase Project
If the team chooses to use a shared central Supabase instance:
1. **Ensure Project is Active**:
   The project owner must verify that the project is not paused in the Supabase Dashboard.
2. **Distinct User Accounts**:
   Each teammate should register with their own unique email address.
3. **Do Not Run Destructive Migrations**:
   Never run `alembic downgrade` or drop tables on the shared database.
4. **Coordinate Demo Seeding**:
   The script `python -m app.seeds.demo_seed` deterministically attaches records to `demo.farmer@dairyvision.ai`. Avoid running `demo_seed` concurrently.

---

## 🧪 Verification & Testing

### Backend Test Suite (Pytest)
Run the full backend test suite covering authentication, predictions, baselines, anomalies, feature engineering, digital twin, health alerts, and recommendations:

```bash
cd backend
PYTHONPATH=. pytest app/tests
```
*Latest verified run: 215 passed (test count reflects current suite run, not a fixed constant).*

### Frontend Production Build
Validate TypeScript typings and build the production bundle:

```bash
cd frontend
npm run build
```
*Expected: Successful production build via Vite.*

---

## 🔒 Security Best Practices
- Local `.env`, `backend/.env`, and `frontend/.env` files are ignored by Git. Never remove them from `.gitignore`.
- Never commit `SUPABASE_SECRET_KEY` (service role) or database passwords.
- The frontend client only communicates with the FastAPI backend. Supabase admin credentials never touch the client bundle.
