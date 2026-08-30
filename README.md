# 🥛 DairyVision AI — Smart Dairy Digital Twin Platform

**DairyVision AI** is an enterprise-grade AI operations and digital twin platform designed for modern dairy farm management. It integrates real-time ambient weather tracking, individual cow physiological monitoring, ML milk yield forecasting, genetic merit evaluation, SHAP explainability, automated health alerts, deduplicated actionable recommendations, and an interactive What-If scenario simulator.

---

## 🌟 Key Capabilities & System Features

- **🐄 Cow & Herd Management**: Complete digital profiles for individual cows, including lactation history, breed metadata, sire lineage, and real-time health conditions.
- **🥛 Milk Yield Prediction**: Machine learning engine leveraging historical observations, ration inputs, and real-time Temperature-Humidity Index (THI) ambient conditions.
- **🌐 Digital Twin Monitoring**: Live digital representation of individual cows and herd-wide thermal stress levels, yield deviations, and health flags.
- **🧬 Genetics & Sire Selection**: Pedigree tracking, sire ranking by genetic merit, predicted transmitting ability (PTA), and herd breeding strategy insights.
- **🧪 What-If Scenario Simulation**: Dual herd-level and individual-cow scenario simulation engines to model yield impacts based on feed adjustments, water availability, and cooling interventions.
- **💡 AI Explainability (SHAP)**: Granular feature attribution explaining why specific yield predictions or anomaly flags occurred.
- **📋 Deduplicated Recommendations**: Real-time actionable farm recommendations that update dynamically and consolidate duplicate issues per cow/farm.
- **🚨 Health & Anomaly Alerts**: Real-time detection of thermal stress, temperature spikes, abnormal milk drops, and feeding anomalies.

---

## 🏗 Project Structure

```
Smart_dairyvisionAI/
├── backend/                        # FastAPI Backend Application
│   ├── app/
│   │   ├── api/v1/                 # API Routes (Dairy, Digital Twin, What-If, Genetics, etc.)
│   │   ├── core/                   # Security, Auth, & DB Config
│   │   ├── models/                 # SQLAlchemy Database Models
│   │   ├── schemas/                # Pydantic Schemas & DTOs
│   │   ├── services/               # Core Business Logic & ML Services
│   │   └── tests/                  # Pytest Unit & Integration Test Suite
│   ├── alembic/                    # Database Migrations
│   ├── requirements.txt            # Python Dependencies
│   └── main.py                     # FastAPI Application Entrypoint
│
├── frontend/                       # React 18 + Vite + Tailwind Frontend Application
│   ├── src/
│   │   ├── components/             # Reusable UI Components & Charts
│   │   ├── pages/                  # Dashboard, Digital Twin, Simulation, Genetics, etc.
│   │   ├── services/               # Axios API Client Services
│   │   └── context/                # Auth & App State Contexts
│   └── package.json                # Frontend Package Configuration
│
└── requirements.txt                # Root Dependency Shortcut
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Launch local API development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The FastAPI backend will run at `http://localhost:8000`. API Swagger documentation is available at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The React frontend web application will run at `http://localhost:5173`.

---

## 🧪 Verification & Testing

### Backend Unit & Integration Tests

```bash
cd backend
PYTHONPATH=. pytest
```

### Frontend Production Build Test

```bash
cd frontend
npm run build
```

---

## 🛠 Technology Stack

- **Backend Framework**: FastAPI (Python 3.12)
- **Database & ORM**: PostgreSQL / SQLite with SQLAlchemy & Alembic
- **Machine Learning**: Scikit-Learn, XGBoost, SHAP, NumPy, Pandas
- **Frontend Framework**: React 18 (TypeScript), Vite, Tailwind CSS, Lucide Icons
- **Data Visualization**: Recharts, SVG Gauge overlays
- **Authentication**: JWT Bearer Auth with Farm Scoping Control
