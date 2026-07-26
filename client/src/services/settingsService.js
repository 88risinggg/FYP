/**
 * Settings Service
 *
 * Client-side API wrapper for all settings endpoints.
 */

import { apiRequest } from "./apiClient.js";

// ─── Profile ────────────────────────────────────────────────────────────────

export function fetchProfile() {
  return apiRequest("/api/settings/profile");
}

export function updateProfile(data) {
  return apiRequest("/api/settings/profile", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── Password & Security ────────────────────────────────────────────────────

export function changePassword(data) {
  return apiRequest("/api/settings/change-password", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function fetch2FA() {
  return apiRequest("/api/settings/2fa");
}

export function update2FA(data) {
  return apiRequest("/api/settings/2fa", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}


export function generateRecoveryCodes() {
  return apiRequest("/api/settings/2fa/recovery-codes", {
    method: "POST"
  });
}

// ─── OTP Verification ───────────────────────────────────────────────────────

export function sendOtp(type) {
  return apiRequest("/api/settings/send-otp", {
    method: "POST",
    body: JSON.stringify({ type })
  });
}

export function verifyOtp(otp, type) {
  return apiRequest("/api/settings/verify-otp", {
    method: "POST",
    body: JSON.stringify({ otp, type })
  });
}

// ─── Connected Accounts ─────────────────────────────────────────────────────

export function fetchConnectedAccounts() {
  return apiRequest("/api/settings/connected-accounts");
}

export function connectAccount(provider, data = {}) {
  return apiRequest(`/api/settings/connect/${provider}`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function disconnectAccount(provider) {
  return apiRequest(`/api/settings/disconnect/${provider}`, {
    method: "POST"
  });
}

// ─── Notification Settings ──────────────────────────────────────────────────

export function fetchNotificationSettings() {
  return apiRequest("/api/settings/notifications");
}

export function updateNotificationSettings(data) {
  return apiRequest("/api/settings/notifications", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── Invoice Settings ───────────────────────────────────────────────────────

export function fetchInvoiceSettings() {
  return apiRequest("/api/settings/invoice");
}

export function updateInvoiceSettings(data) {
  return apiRequest("/api/settings/invoice", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── Payroll Settings ───────────────────────────────────────────────────────

export function fetchPayrollSettings() {
  return apiRequest("/api/settings/payroll");
}

export function updatePayrollSettings(data) {
  return apiRequest("/api/settings/payroll", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── Company Settings ───────────────────────────────────────────────────────

export function fetchCompanySettings() {
  return apiRequest("/api/settings/company");
}

export function updateCompanySettings(data) {
  return apiRequest("/api/settings/company", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── Login Sessions ─────────────────────────────────────────────────────────

export function fetchSessions() {
  return apiRequest("/api/settings/sessions");
}

export function terminateSession(sessionId) {
  return apiRequest(`/api/settings/sessions/${sessionId}`, {
    method: "DELETE"
  });
}

export function logoutAllSessions() {
  return apiRequest("/api/settings/logout-all", {
    method: "POST"
  });
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export function fetchAuditLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/settings/audit-logs?${query}`);
}

// ─── Appearance & Language ──────────────────────────────────────────────────

export function fetchAppearance() {
  return apiRequest("/api/settings/appearance");
}

export function updateAppearance(data) {
  return apiRequest("/api/settings/appearance", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── API & Integrations ─────────────────────────────────────────────────────

export function fetchApiSettings() {
  return apiRequest("/api/settings/api-keys");
}

export function generateApiKey() {
  return apiRequest("/api/settings/api-keys/generate", {
    method: "POST"
  });
}

export function updateApiSettings(data) {
  return apiRequest("/api/settings/api-keys", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// ─── Danger Zone ────────────────────────────────────────────────────────────

export function deactivateAccount() {
  return apiRequest("/api/settings/deactivate", {
    method: "POST"
  });
}

export function deleteAccount(password) {
  return apiRequest("/api/settings/delete-account", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export function fetchPrivacySettings() {
  return apiRequest("/api/settings/privacy");
}

export function updatePrivacySettings(data) {
  return apiRequest("/api/settings/privacy", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export function exportPersonalData() {
  return apiRequest("/api/settings/privacy/export");
}

export function requestAccountData() {
  return apiRequest("/api/settings/privacy/data-request", { method: "POST" });
}

export function resetSettings() {
  return apiRequest("/api/settings/reset-settings", { method: "POST" });
}

export function fetchDeletionRequests() {
  return apiRequest("/api/settings/deletion-requests");
}

export function reviewDeletionRequest(requestId, decision, note = "") {
  return apiRequest(`/api/settings/deletion-requests/${requestId}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, note })
  });
}
