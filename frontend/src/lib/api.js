import axios from "axios";

const rawUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const BACKEND_URL = rawUrl.replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

// Determine WebSocket base URL
const wsProtocol = BACKEND_URL.startsWith("https") ? "wss" : "ws";
const hostPart = BACKEND_URL.replace(/^https?:\/\//, "");
export const WS_BASE_URL = `${wsProtocol}://${hostPart}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("san_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
