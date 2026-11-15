import axios from "axios";

// In production (Docker/Nginx), the frontend is served from the same origin as the
// reverse-proxied API, so relative URLs work. In development, Vite's dev server
// must be started with the backend running on port 8000.
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api/v1" : "http://127.0.0.1:8000/api/v1");

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("campus_connect_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;