import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dairyvision_access_token');
  // Ensure headers object exists
  config.headers = config.headers ?? {};
  if (token) {
    // Assign Authorization header defensively
    // Some axios typings use a Headers object; copying preserves existing headers
    try {
      (config.headers as any).Authorization = `Bearer ${token}`;
    } catch (e) {
      config.headers = { ...(config.headers as any), Authorization: `Bearer ${token}` };
    }
  }
  return config;
});

// Add a response interceptor that surfaces 401 without automatically muting auth.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // If backend returns 401, let callers handle it. Do not clear localStorage here.
    return Promise.reject(err);
  }
);

export default api;
