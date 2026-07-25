/**
 * Subscription Service
 *
 * Frontend API calls for the Subscription Invoicing Module.
 * Mirrors the pattern used in invoiceService.js.
 *
 * NOTE: Manual subscription creation has been removed.
 * Subscriptions are imported from external systems via CSV/Excel upload.
 */

import { apiRequest } from "./apiClient.js";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function fetchSubscriptionDashboard() {
  return apiRequest("/api/subscriptions/dashboard");
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export function fetchSubscriptions(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return apiRequest(`/api/subscriptions${query ? `?${query}` : ""}`);
}

export function fetchSubscriptionById(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}`);
}

// ─── Update (edit imported subscription details) ──────────────────────────────

export function updateSubscription(subscriptionId, payload) {
  return apiRequest(`/api/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSubscription(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

// ─── Status transitions ──────────────────────────────────────────────────────

export function pauseSubscription(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/pause`, {
    method: "PATCH",
  });
}

export function resumeSubscription(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/resume`, {
    method: "PATCH",
  });
}

export function cancelSubscription(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/cancel`, {
    method: "PATCH",
  });
}

// ─── Manual invoice generation ────────────────────────────────────────────────

export function generateInvoiceNow(subscriptionId, amount = null) {
  const body = amount ? { amount: Number(amount) } : {};
  return apiRequest(`/api/subscriptions/${subscriptionId}/generate-invoice`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export function parseSubscriptionFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/api/subscriptions/import/parse", {
    method: "POST",
    body: formData,
    headers: { "Content-Type": undefined }, // Let browser set multipart boundary
  });
}

export function validateSubscriptionImport(rows, file) {
  return apiRequest("/api/subscriptions/import/validate", {
    method: "POST",
    body: JSON.stringify({ rows, file }),
  });
}

export function confirmSubscriptionImport(rows, file) {
  return apiRequest("/api/subscriptions/import/confirm", {
    method: "POST",
    body: JSON.stringify({ rows, file }),
  });
}

export function getSubscriptionTemplateUrl() {
  return "/api/subscriptions/import/template";
}

// ─── Related data ────────────────────────────────────────────────────────────

export function fetchSubscriptionInvoices(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/invoices`);
}

export function fetchSubscriptionPayments(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/payments`);
}
