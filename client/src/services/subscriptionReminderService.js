/**
 * Subscription Reminder Service
 *
 * Frontend API calls for the Subscription Reminders feature.
 */

import { apiRequest } from "./apiClient.js";

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export function fetchReminderSummary() {
  return apiRequest("/api/subscription-reminders/summary");
}

// ─── List Reminders (with filters) ───────────────────────────────────────────

export function fetchSubscriptionReminders(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return apiRequest(`/api/subscription-reminders${query ? `?${query}` : ""}`);
}

// ─── Single Reminder ─────────────────────────────────────────────────────────

export function fetchReminderById(reminderId) {
  return apiRequest(`/api/subscription-reminders/${reminderId}`);
}

// ─── Mark Complete ───────────────────────────────────────────────────────────

export function markReminderComplete(reminderId) {
  return apiRequest(`/api/subscription-reminders/${reminderId}/complete`, {
    method: "PATCH",
  });
}

// ─── Dismiss Reminder ────────────────────────────────────────────────────────

export function dismissReminder(reminderId) {
  return apiRequest(`/api/subscription-reminders/${reminderId}/dismiss`, {
    method: "PATCH",
  });
}

// ─── Manual Generation Trigger ───────────────────────────────────────────────

export function triggerReminderGeneration() {
  return apiRequest("/api/subscription-reminders/generate", {
    method: "POST",
  });
}
