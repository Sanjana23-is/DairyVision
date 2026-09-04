import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-100 font-sans select-none">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
          <svg
            className="h-6 w-6 text-emerald-400 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-slate-300 tracking-wide">
          Validating workspace session...
        </p>
      </div>
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, currentFarmId } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Enforce farm selection: If user is authenticated but no farm is selected, redirect to /select-farm
  if (!currentFarmId && location.pathname !== "/select-farm") {
    return <Navigate to="/select-farm" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, currentFarmId } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    if (currentFarmId) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/select-farm" replace />;
  }

  return <Outlet />;
}
