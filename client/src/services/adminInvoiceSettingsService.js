import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export function fetchInvoiceSettings() {
  return apiRequest("/api/admin/invoicing/invoice-settings", {
    headers: authHeaders()
  });
}

export function saveInvoiceSettings(payload) {
  return apiRequest("/api/admin/invoicing/invoice-settings", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}
