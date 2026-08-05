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
          <Route path="/cows" element={<CowListPage />} />
          <Route path="/cows/:id" element={<CowDetailsPage />} />
          <Route path="/observations" element={<ObservationListPage />} />
          <Route path="/observations/:id" element={<ObservationDetailsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
