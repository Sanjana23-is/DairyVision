import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AuthState,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ForgotPasswordPayload,
} from "@/types/auth";
import api from "@/services/api";
import { fetchFarms } from "@/services/farm";

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  forgotPassword: (payload: ForgotPasswordPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
    currentFarmId: localStorage.getItem("current_farm_id"),
    currentFarmName: localStorage.getItem("current_farm_name"),
  });

  useEffect(() => {
    const storedToken = localStorage.getItem("dairyvision_access_token");
    const storedUser = localStorage.getItem("dairyvision_user");
    const storedFarmId = localStorage.getItem("current_farm_id");
    const storedFarmName = localStorage.getItem("current_farm_name");

    if (storedToken && storedUser) {
      setAuthState({
        user: JSON.parse(storedUser) as AuthUser,
        accessToken: storedToken,
        isAuthenticated: true,
        isLoading: false,
        currentFarmId: storedFarmId,
        currentFarmName: storedFarmName,
      });
      return;
    }

    setAuthState((prev) => ({
      ...prev,
      isLoading: false,
      currentFarmId: storedFarmId,
      currentFarmName: storedFarmName,
    }));
  }, []);

  const setCurrentFarm = (farmId: string | null, farmName: string | null) => {
    if (farmId) {
      localStorage.setItem("current_farm_id", farmId);
    } else {
      localStorage.removeItem("current_farm_id");
    }

    if (farmName) {
      localStorage.setItem("current_farm_name", farmName);
    } else {
      localStorage.removeItem("current_farm_name");
    }

    setAuthState((prev) => ({
      ...prev,
      currentFarmId: farmId,
      currentFarmName: farmName,
    }));
  };

  const login = async (payload: LoginPayload) => {
    const response = await api.post("/api/v1/auth/login", payload);
    const { access_token, user } = response.data;

    localStorage.setItem("dairyvision_access_token", access_token);
    localStorage.setItem("dairyvision_user", JSON.stringify(user));

    const farms = await fetchFarms();
    const selectedFarm = farms[0] ?? null;
    setCurrentFarm(selectedFarm?.id ?? null, selectedFarm?.name ?? null);

    setAuthState({
      user,
      accessToken: access_token,
      isAuthenticated: true,
      isLoading: false,
      currentFarmId: selectedFarm?.id ?? null,
      currentFarmName: selectedFarm?.name ?? null,
    });
  };

  const register = async (payload: RegisterPayload) => {
    const response = await api.post("/api/v1/auth/signup", payload);
    const { access_token, user } = response.data;

    localStorage.setItem("dairyvision_access_token", access_token);
    localStorage.setItem("dairyvision_user", JSON.stringify(user));

    const farms = await fetchFarms();
    const selectedFarm = farms[0] ?? null;
    setCurrentFarm(selectedFarm?.id ?? null, selectedFarm?.name ?? null);

    setAuthState({
      user,
      accessToken: access_token,
      isAuthenticated: true,
      isLoading: false,
      currentFarmId: selectedFarm?.id ?? null,
      currentFarmName: selectedFarm?.name ?? null,
    });
  };

  const forgotPassword = async (payload: ForgotPasswordPayload) => {
    await api.post("/api/v1/auth/forgot-password", payload);
  };

  const logout = () => {
    localStorage.removeItem("dairyvision_access_token");
    localStorage.removeItem("dairyvision_user");
    localStorage.removeItem("current_farm_id");
    localStorage.removeItem("current_farm_name");
    setAuthState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      currentFarmId: null,
      currentFarmName: null,
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({ ...authState, login, register, forgotPassword, logout }),
    [authState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
