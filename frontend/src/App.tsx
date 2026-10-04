import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/common/ProtectedRoute";
import PageLoadingFallback from "@/components/common/PageLoadingFallback";

// Route-level code-splitting with React.lazy
const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const CowListPage = lazy(() => import("@/pages/cows/CowListPage"));
const CowDetailsPage = lazy(() => import("@/pages/cows/CowDetailsPage"));
const ObservationListPage = lazy(() => import("@/pages/observations/ObservationListPage"));
const ObservationDetailsPage = lazy(() => import("@/pages/observations/ObservationDetailsPage"));
const PredictionPage = lazy(() => import("@/pages/predictions/PredictionPage"));
const PredictionHistoryPage = lazy(() => import("@/pages/predictions/PredictionHistoryPage"));
const ExplainabilityPage = lazy(() => import("@/pages/explainability/ExplainabilityPage"));
const FarmListPage = lazy(() => import("@/pages/farms/FarmListPage"));
const FarmWorkspacePage = lazy(() => import("@/pages/farms/FarmWorkspacePage"));
const SelectFarmPage = lazy(() => import("@/pages/farms/SelectFarmPage"));
const HealthAlertsPage = lazy(() => import("@/pages/HealthAlertsPage"));
const RecommendationsPage = lazy(() => import("@/pages/RecommendationsPage"));
const DigitalTwinPage = lazy(() => import("@/pages/DigitalTwinPage"));
const SimulationPage = lazy(() => import("@/pages/SimulationPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* PUBLIC ONLY ROUTES (Redirect to /dashboard or /select-farm if authenticated) */}
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>

              {/* PROTECTED APPLICATION ROUTES (Require valid authenticated session) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/select-farm" element={<SelectFarmPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/farms" element={<FarmListPage />} />
                <Route path="/farms/:farmId" element={<FarmWorkspacePage />} />
                <Route path="/cows" element={<CowListPage />} />
                <Route path="/cows/:id" element={<CowDetailsPage />} />
                <Route path="/observations" element={<ObservationListPage />} />
                <Route path="/observations/:id" element={<ObservationDetailsPage />} />
                <Route path="/predictions" element={<PredictionPage />} />
                <Route path="/predictions/history" element={<PredictionHistoryPage />} />
                <Route path="/health-alerts" element={<HealthAlertsPage />} />
                <Route path="/anomalies" element={<Navigate to="/health-alerts" replace />} />
                <Route path="/recommendations" element={<RecommendationsPage />} />
                <Route path="/digital-twin" element={<DigitalTwinPage />} />
                <Route path="/genetics" element={<Navigate to="/dashboard" replace />} />
                <Route path="/simulation" element={<SimulationPage />} />
                <Route path="/explainability" element={<ExplainabilityPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* CATCH ALL FALLBACK */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
