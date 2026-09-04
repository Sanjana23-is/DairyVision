import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
  headers: {
    'Content-Type': 'application/json'
  }
});

function isTokenExpired(token: string): boolean {
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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dairyvision_access_token');
  // Ensure headers object exists
  config.headers = config.headers ?? {};
  if (token) {
    if (isTokenExpired(token)) {
      localStorage.removeItem("dairyvision_access_token");
      localStorage.removeItem("dairyvision_user");
      localStorage.removeItem("current_farm_id");
      localStorage.removeItem("current_farm_name");
    } else {
      // Assign Authorization header defensively
      // Some axios typings use a Headers object; copying preserves existing headers
      try {
        (config.headers as any).Authorization = `Bearer ${token}`;
      } catch (e) {
        config.headers = { ...(config.headers as any), Authorization: `Bearer ${token}` };
      }
    }
  }
  return config;
});

// Add a response interceptor that handles 401 token expiration
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      const isLoginRequest = err.config && err.config.url && err.config.url.includes("/auth/login");
      if (!isLoginRequest) {
        localStorage.removeItem("dairyvision_access_token");
        localStorage.removeItem("dairyvision_user");
        localStorage.removeItem("current_farm_id");
        localStorage.removeItem("current_farm_name");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
