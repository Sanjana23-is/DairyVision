import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AuthState,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ForgotPasswordPayload,
} from "@/types/auth";
import api from "@/services/api";
import { fetchFarms, Farm } from "@/services/farm";

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  forgotPassword: (payload: ForgotPasswordPayload) => Promise<void>;
  logout: () => void;
  setCurrentFarm: (farmId: string | null, farmName: string | null) => void;
  updateUserProfile: (fullName: string) => Promise<void>;
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

function clearAuthStorage() {
  localStorage.removeItem("dairyvision_access_token");
  localStorage.removeItem("dairyvision_user");
  localStorage.removeItem("current_farm_id");
  localStorage.removeItem("current_farm_name");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true, // Always start in loading state during session restoration
    currentFarmId: null,
    currentFarmName: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const storedToken = localStorage.getItem("dairyvision_access_token");
      const storedFarmId = localStorage.getItem("current_farm_id");
      const storedFarmName = localStorage.getItem("current_farm_name");

      if (!storedToken || isTokenExpired(storedToken)) {
        clearAuthStorage();
        delete api.defaults.headers.common["Authorization"];
        if (isMounted) {
          setAuthState({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            currentFarmId: null,
            currentFarmName: null,
          });
        }
        return;
      }

      api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;

      try {
        // Validate token against backend /api/v1/auth/me
        const meResponse = await api.get("/api/v1/auth/me");
        const currentUser: AuthUser = meResponse.data.user;

        localStorage.setItem("dairyvision_user", JSON.stringify(currentUser));

        // Validate stored farm ID against user's real farms
        let validFarmId: string | null = null;
        let validFarmName: string | null = null;

        try {
          const userFarms: Farm[] = await fetchFarms();
          if (storedFarmId) {
            const matched = userFarms.find((f) => f.id === storedFarmId);
            if (matched) {
              validFarmId = matched.id;
              validFarmName = matched.name ?? storedFarmName;
            }
          }
        } catch (e) {
          // Ignore farm fetch error during init
        }

        if (validFarmId) {
          localStorage.setItem("current_farm_id", validFarmId);
          if (validFarmName) localStorage.setItem("current_farm_name", validFarmName);
        } else {
          localStorage.removeItem("current_farm_id");
          localStorage.removeItem("current_farm_name");
        }

        if (isMounted) {
          setAuthState({
            user: currentUser,
            accessToken: storedToken,
            isAuthenticated: true,
            isLoading: false,
            currentFarmId: validFarmId,
            currentFarmName: validFarmName,
          });
        }
      } catch (err) {
        // Token invalid or backend rejected session
        clearAuthStorage();
        delete api.defaults.headers.common["Authorization"];
        if (isMounted) {
          setAuthState({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
            currentFarmId: null,
            currentFarmName: null,
          });
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync auth state across browser tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (
        e.key === "dairyvision_access_token" ||
        e.key === "dairyvision_user"
      ) {
        const storedToken = localStorage.getItem("dairyvision_access_token");
        const storedUser = localStorage.getItem("dairyvision_user");
        if (storedToken && storedUser && !isTokenExpired(storedToken)) {
          setAuthState((prev) => ({
            ...prev,
            accessToken: storedToken,
            user: JSON.parse(storedUser),
            isAuthenticated: true,
          }));
        } else {
          clearAuthStorage();
          delete api.defaults.headers.common["Authorization"];
          setAuthState((prev) => ({
            ...prev,
            accessToken: null,
            user: null,
            isAuthenticated: false,
            currentFarmId: null,
            currentFarmName: null,
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
    clearAuthStorage();
    delete api.defaults.headers.common["Authorization"];

    setAuthState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      currentFarmId: null,
      currentFarmName: null,
    });

    try {
      const response = await api.post("/api/v1/auth/login", payload);
      const { access_token, user } = response.data;

      localStorage.setItem("dairyvision_access_token", access_token);
      localStorage.setItem("dairyvision_user", JSON.stringify(user));
      api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

      setAuthState({
        user,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false,
        currentFarmId: null,
        currentFarmName: null,
      });
    } catch (err) {
      setAuthState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        currentFarmId: null,
        currentFarmName: null,
      });
      throw err;
    }
  };

  const register = async (payload: RegisterPayload) => {
    clearAuthStorage();
    delete api.defaults.headers.common["Authorization"];

    setAuthState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      currentFarmId: null,
      currentFarmName: null,
    });

    try {
      const response = await api.post("/api/v1/auth/signup", payload);
      const { access_token, user } = response.data;

      localStorage.setItem("dairyvision_access_token", access_token);
      localStorage.setItem("dairyvision_user", JSON.stringify(user));
      api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;

      setAuthState({
        user,
        accessToken: access_token,
        isAuthenticated: true,
        isLoading: false,
        currentFarmId: null,
        currentFarmName: null,
      });
    } catch (err) {
      setAuthState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        currentFarmId: null,
        currentFarmName: null,
      });
      throw err;
    }
  };

  const forgotPassword = async (payload: ForgotPasswordPayload) => {
    await api.post("/api/v1/auth/forgot-password", payload);
  };

  const logout = () => {
    clearAuthStorage();
    delete api.defaults.headers.common["Authorization"];
    setAuthState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      currentFarmId: null,
      currentFarmName: null,
    });
  };

  const updateUserProfile = async (fullName: string) => {
    const response = await api.put("/api/v1/auth/me", { full_name: fullName });
    const updatedUser = response.data.user;

    localStorage.setItem("dairyvision_user", JSON.stringify(updatedUser));
    setAuthState((prev) => ({
      ...prev,
      user: updatedUser,
    }));
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      login,
      register,
      forgotPassword,
      logout,
      setCurrentFarm,
      updateUserProfile,
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
