/**
 * Finance Reminder Service
 *
 * Frontend API calls for the unified Finance Reminders module.
 * Supports filtering, search, complete, and dismiss operations.
 */

import { apiRequest } from "./apiClient.js";

export function fetchFinanceReminders(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return apiRequest(`/api/finance-reminders${query ? `?${query}` : ""}`);
}

export function fetchFinanceReminderSummary() {
  return apiRequest("/api/finance-reminders/summary");
}

export function completeReminder(reminderId) {
  return apiRequest(`/api/finance-reminders/${reminderId}/complete`, {
    method: "PATCH",
  });
}

export function dismissReminder(reminderId) {
  return apiRequest(`/api/finance-reminders/${reminderId}/dismiss`, {
    method: "PATCH",
  });
}
