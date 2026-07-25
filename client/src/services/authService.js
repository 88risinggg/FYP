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

export function getRegistrationStatus() {
  return apiRequest("/api/auth/registration/status");
}

export function startRegistration(details) {
  return apiRequest("/api/auth/registration/start", {
    method: "POST",
    body: JSON.stringify(details)
  });
}

export function verifyRegistrationOtp(challengeId, otp) {
  return apiRequest("/api/auth/registration/verify-email", {
    method: "POST",
    body: JSON.stringify({ challengeId, otp })
  });
}

export function resendRegistrationOtp(challengeId) {
  return apiRequest("/api/auth/registration/resend-otp", {
    method: "POST",
    body: JSON.stringify({ challengeId })
  });
}
