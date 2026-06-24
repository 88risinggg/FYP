import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export function fetchReminderSettings() {
  return apiRequest("/api/admin/invoicing/reminder-settings", {
    headers: authHeaders()
  });
}

export function createReminderSetting(payload) {
  return apiRequest("/api/admin/invoicing/reminder-settings", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export function updateReminderSetting(id, payload) {
  return apiRequest(`/api/admin/invoicing/reminder-settings/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export function updateReminderStatus(id, enabled) {
  return apiRequest(`/api/admin/invoicing/reminder-settings/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ enabled })
  });
}

export function deleteReminderSetting(id) {
  return apiRequest(`/api/admin/invoicing/reminder-settings/${id}`, {
    method: "DELETE",
    headers: authHeaders()
  });
}

export function fetchReminderLogs() {
  return apiRequest("/api/admin/invoicing/reminder-logs", {
    headers: authHeaders()
  });
}

export function sendTestReminder(payload) {
  return apiRequest("/api/admin/invoicing/reminders/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}
