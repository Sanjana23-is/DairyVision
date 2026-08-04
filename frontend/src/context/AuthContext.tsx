import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AuthState,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ForgotPasswordPayload,
} from "@/types/auth";
import api from "@/services/api";

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
  });

  useEffect(() => {
    const storedToken = localStorage.getItem("dairyvision_access_token");
    const storedUser = localStorage.getItem("dairyvision_user");

    if (storedToken && storedUser) {
      setAuthState({
        user: JSON.parse(storedUser) as AuthUser,
        accessToken: storedToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }

    setAuthState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await api.post("/auth/login", payload);
    const { access_token, user } = response.data;

    localStorage.setItem("dairyvision_access_token", access_token);
    localStorage.setItem("dairyvision_user", JSON.stringify(user));

    setAuthState({
      user,
      accessToken: access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const register = async (payload: RegisterPayload) => {
    const response = await api.post("/auth/register", payload);
    const { access_token, user } = response.data;

    localStorage.setItem("dairyvision_access_token", access_token);
    localStorage.setItem("dairyvision_user", JSON.stringify(user));

    setAuthState({
      user,
      accessToken: access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const forgotPassword = async (payload: ForgotPasswordPayload) => {
    await api.post("/auth/forgot-password", payload);
  };

  const logout = () => {
    localStorage.removeItem("dairyvision_access_token");
    localStorage.removeItem("dairyvision_user");
    setAuthState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
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
