import { apiRequest } from "./apiClient.js";

export function login(email, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function completeFirstLogin(setupToken, newPassword) {
  return apiRequest("/api/auth/complete-first-login", {
    method: "POST",
    body: JSON.stringify({ setupToken, newPassword })
  });
}

