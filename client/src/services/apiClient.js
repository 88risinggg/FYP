import { clearSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const TOKEN_KEY = "authToken";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  // Session expired or token invalid — clear session and redirect to login
  // Skip redirect if already on the login page (e.g. bad credentials during login)
  if (response.status === 401 || response.status === 403) {
    if (window.location.pathname !== "/login") {
      clearSession();
      window.location.href = "/login";
    }
    throw new Error(data.message || "Session expired. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
