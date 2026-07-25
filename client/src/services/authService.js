import { apiRequest } from "./apiClient.js";

export function login(email, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function verifyLoginOtp(challengeId, otp) {
  return apiRequest("/api/auth/login/verify-otp", {
    method: "POST",
    body: JSON.stringify({ challengeId, otp })
  });
}

export function resendLoginOtp(challengeId) {
  return apiRequest("/api/auth/login/resend-otp", {
    method: "POST",
    body: JSON.stringify({ challengeId })
  });
}

export function completeFirstLogin(setupToken, newPassword, termsAccepted, privacyAccepted) {
  return apiRequest("/api/auth/complete-first-login", {
    method: "POST",
    body: JSON.stringify({ setupToken, newPassword, termsAccepted, privacyAccepted })
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
