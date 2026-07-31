/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Provides reusable admin Reminder Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

// PRESENTATION NOTE:
// Frontend page calls this when Automatic Customer Reminder Policy opens.
// Backend route:
// server/src/routes/adminReminderRoutes.js -> router.get("/reminder-settings", getReminderSettings)
export function fetchReminderSettings() {
  return apiRequest("/api/admin/invoicing/reminder-settings", {
    headers: authHeaders()
  });
}

// PRESENTATION NOTE:
// Called when admin saves the first reminder policy.
// Backend route:
// POST /api/admin/invoicing/reminder-settings -> postReminderSetting()
export function createReminderSetting(payload) {
  return apiRequest("/api/admin/invoicing/reminder-settings", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

// PRESENTATION NOTE:
// Called when admin saves changes to an existing policy.
// Backend route:
// PUT /api/admin/invoicing/reminder-settings/:id -> putReminderSetting()
export function updateReminderSetting(id, payload) {
  return apiRequest(`/api/admin/invoicing/reminder-settings/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

// PRESENTATION NOTE:
// This toggles a policy on/off if a page uses that control.
// Backend route:
// PATCH /api/admin/invoicing/reminder-settings/:id/status -> patchReminderStatus()
export function updateReminderStatus(id, enabled) {
  return apiRequest(`/api/admin/invoicing/reminder-settings/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ enabled })
  });
}

// PRESENTATION NOTE:
// Loads reminder delivery history from the backend.
// Backend model reads the reminder_logs table.
export function fetchReminderLogs() {
  return apiRequest("/api/admin/invoicing/reminder-logs", {
    headers: authHeaders()
  });
}

// PRESENTATION NOTE:
// Called by the "Send Test Email" button.
// Backend route:
// POST /api/admin/invoicing/reminders/test -> postTestReminder()
export function sendTestReminder(payload) {
  return apiRequest("/api/admin/invoicing/reminders/test", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}
