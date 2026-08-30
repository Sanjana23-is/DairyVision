import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import CowListPage from "@/pages/cows/CowListPage";
import CowDetailsPage from "@/pages/cows/CowDetailsPage";
import ObservationListPage from "@/pages/observations/ObservationListPage";
import ObservationDetailsPage from "@/pages/observations/ObservationDetailsPage";
import PredictionPage from "@/pages/predictions/PredictionPage";
import PredictionHistoryPage from "@/pages/predictions/PredictionHistoryPage";
import ExplainabilityPage from "@/pages/explainability/ExplainabilityPage";
import FarmListPage from "@/pages/farms/FarmListPage";
import HealthAlertsPage from "@/pages/HealthAlertsPage";
import AnomalyDetectionPage from "@/pages/AnomalyDetectionPage";
import RecommendationsPage from "@/pages/RecommendationsPage";
import DigitalTwinPage from "@/pages/DigitalTwinPage";
import GeneticsPage from "@/pages/GeneticsPage";

// Note: dashboard routes will use the DashboardLayout inside pages

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/farms" element={<FarmListPage />} />
          <Route path="/cows" element={<CowListPage />} />
          <Route path="/cows/:id" element={<CowDetailsPage />} />
          <Route path="/observations" element={<ObservationListPage />} />
          <Route
            path="/observations/:id"
            element={<ObservationDetailsPage />}
          />
          <Route path="/predictions" element={<PredictionPage />} />
          <Route
            path="/predictions/history"
            element={<PredictionHistoryPage />}
          />
          <Route path="/health-alerts" element={<HealthAlertsPage />} />
          <Route path="/anomalies" element={<AnomalyDetectionPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/digital-twin" element={<DigitalTwinPage />} />
          <Route path="/genetics" element={<GeneticsPage />} />
          <Route path="/explainability" element={<ExplainabilityPage />} />
        </Route>



        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
