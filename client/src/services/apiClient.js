import { clearSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
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

