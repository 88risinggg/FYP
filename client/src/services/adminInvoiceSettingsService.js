/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Provides reusable admin Invoice Settings Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
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

export function getNumberingSettingsHistory({ page = 1, pageSize = 20 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  return apiRequest(`/api/admin/invoicing/invoice-settings/numbering-activity?${query}`, {
    headers: authHeaders()
  });
}

export function getInvoiceGstRates(options = {}) {
  const query = new URLSearchParams();
  if (options.limit) query.set("limit", String(options.limit));
  if (options.order) query.set("order", options.order);
  if (options.asOf) query.set("asOf", String(options.asOf));
  const suffix = query.size ? `?${query}` : "";
  return apiRequest(`/api/admin/invoicing/invoice-settings/gst-rates${suffix}`, {
    headers: authHeaders()
  });
}

export function createInvoiceGstRate(payload, options = {}) {
  const query = new URLSearchParams();
  if (options.limit) query.set("limit", String(options.limit));
  if (options.order) query.set("order", options.order);
  const suffix = query.size ? `?${query}` : "";
  return apiRequest(`/api/admin/invoicing/invoice-settings/gst-rates${suffix}`, {
    method: "POST",
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

export function sendInvoiceSettingsTestEmail(recipient, settings) {
  return apiRequest("/api/admin/invoicing/invoice-settings/test-email", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ recipient, settings })
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
