/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Provides reusable subscription Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
/**
 * Subscription Service
 *
 * Frontend API calls for the Subscription Invoicing Module.
 * Finance users create and manage subscriptions directly.
 */

import { apiRequest } from "./apiClient.js";

// ─── Plan Templates (Admin-managed) ──────────────────────────────────────────

export function fetchPlanTemplates() {
  return apiRequest("/api/subscriptions/plan-templates");
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function fetchSubscriptionDashboard() {
  return apiRequest("/api/subscriptions/dashboard");
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createSubscription(payload) {
  return apiRequest("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

// ─── Update ───────────────────────────────────────────────────────────────────

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

// ─── Related data ────────────────────────────────────────────────────────────

export function fetchSubscriptionInvoices(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/invoices`);
}

export function fetchSubscriptionPayments(subscriptionId) {
  return apiRequest(`/api/subscriptions/${subscriptionId}/payments`);
}
