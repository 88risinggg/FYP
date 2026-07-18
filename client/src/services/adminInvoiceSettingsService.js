import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export function getInvoiceSettings() {
  return apiRequest("/api/admin/invoicing/invoice-settings", {
    headers: authHeaders()
  });
}

export function updateInvoiceSettings(payload) {
  return apiRequest("/api/admin/invoicing/invoice-settings", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export function uploadInvoiceLogo(payload) {
  return apiRequest("/api/admin/invoicing/invoice-settings/logo", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
}

export async function getInvoiceConfigurationStatus() {
  const data = await getInvoiceSettings();
  return data.configurationStatus;
}

export const fetchInvoiceSettings = getInvoiceSettings;
export const saveInvoiceSettings = updateInvoiceSettings;

