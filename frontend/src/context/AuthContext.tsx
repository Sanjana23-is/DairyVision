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
  setCurrentFarm: (farmId: string | null, farmName: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = JSON.parse(window.atob(payloadBase64));
    const exp = decodedPayload.exp;
    if (typeof exp !== "number") return false;
    return Date.now() >= exp * 1000;
  } catch (e) {
    return true;
  }
}

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

    // (debug logs removed)

    if (storedToken && storedUser) {
      if (isTokenExpired(storedToken)) {
        localStorage.removeItem("dairyvision_access_token");
        localStorage.removeItem("dairyvision_user");
        localStorage.removeItem("current_farm_id");
        localStorage.removeItem("current_farm_name");
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }));
        return;
      }

      setAuthState({
        user: JSON.parse(storedUser) as AuthUser,
        accessToken: storedToken,
        isAuthenticated: true,
        isLoading: false,
        currentFarmId: storedFarmId,
        currentFarmName: storedFarmName,
      });
      // If no farm is stored, try to fetch farms and auto-select the first
      if (!storedFarmId) {
        (async () => {
          try {
            const farms = await fetchFarms();
            const selected = (farms && farms[0]) ?? null;
            if (selected) {
              setCurrentFarm(selected.id, selected.name ?? null);
            }
          } catch (e) {
            // ignore errors here; leave farm unselected
          }
        })();
      }
      return;
    }

    setAuthState((prev) => ({
      ...prev,
      isLoading: false,
      currentFarmId: storedFarmId,
      currentFarmName: storedFarmName,
    }));
  }, []);

  // If authenticated but no farm selected, try fetching farms and auto-select first
  useEffect(() => {
    if (!authState.isAuthenticated) return;
    if (authState.currentFarmId) return;

    (async () => {
      try {
        const farms = await fetchFarms();
        const selected = (farms && farms[0]) ?? null;
        if (selected) {
          setCurrentFarm(selected.id, selected.name ?? null);
        }
      } catch (e) {
        // ignore errors
      }
    })();
  }, [authState.isAuthenticated, authState.currentFarmId]);

  // Keep auth state in sync across tabs and window reloads
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (
        e.key === "dairyvision_access_token" ||
        e.key === "dairyvision_user"
      ) {
        const storedToken = localStorage.getItem("dairyvision_access_token");
        const storedUser = localStorage.getItem("dairyvision_user");
        if (storedToken && storedUser) {
          setAuthState((prev) => ({
            ...prev,
            accessToken: storedToken,
            user: JSON.parse(storedUser),
            isAuthenticated: true,
          }));
        } else {
          setAuthState((prev) => ({
            ...prev,
            accessToken: null,
            user: null,
            isAuthenticated: false,
          }));
        }
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
    localStorage.removeItem("dairyvision_access_token");
    localStorage.removeItem("dairyvision_user");
    setAuthState((prev) => ({
      ...prev,
      accessToken: null,
      user: null,
      isAuthenticated: false,
    }));

    const response = await api.post("/api/v1/auth/login", payload);
    const { access_token, user } = response.data;

    localStorage.setItem("dairyvision_access_token", access_token);
    localStorage.setItem("dairyvision_user", JSON.stringify(user));

    let selectedFarm = null;
    try {
      const farms = await fetchFarms();
      selectedFarm = farms[0] ?? null;
      setCurrentFarm(selectedFarm?.id ?? null, selectedFarm?.name ?? null);
    } catch (e) {
      // Gracefully handle farm fetch failure (e.g. empty DB or network issue)
    }

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
    localStorage.removeItem("dairyvision_access_token");
    localStorage.removeItem("dairyvision_user");
    setAuthState((prev) => ({
      ...prev,
      accessToken: null,
      user: null,
      isAuthenticated: false,
    }));

    const response = await api.post("/api/v1/auth/signup", payload);
    const { access_token, user } = response.data;

    localStorage.setItem("dairyvision_access_token", access_token);
    localStorage.setItem("dairyvision_user", JSON.stringify(user));

    let selectedFarm = null;
    try {
      const farms = await fetchFarms();
      selectedFarm = farms[0] ?? null;
      setCurrentFarm(selectedFarm?.id ?? null, selectedFarm?.name ?? null);
    } catch (e) {
      // Gracefully handle farm fetch failure
    }

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
    () => ({
      ...authState,
      login,
      register,
      forgotPassword,
      logout,
      setCurrentFarm,
    }),
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
