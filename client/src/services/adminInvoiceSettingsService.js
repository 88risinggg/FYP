import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

export function sendInvoiceSettingsTestEmail(recipient) {
  return apiRequest("/api/admin/invoicing/invoice-settings/test-email", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ recipient })
  });
}

export async function previewInvoiceTemplate(settings) {
  const response = await fetch(`${API_BASE_URL}/api/admin/invoicing/invoice-settings/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(settings)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Unable to generate invoice preview.");
  }

  return response.blob();
}

export async function getInvoiceConfigurationStatus() {
  const data = await getInvoiceSettings();
  return data.configurationStatus;
}

export const fetchInvoiceSettings = getInvoiceSettings;
export const saveInvoiceSettings = updateInvoiceSettings;
