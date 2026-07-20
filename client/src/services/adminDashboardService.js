import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function authHeaders() {
  const session = getStoredSession();

  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

function toQueryString(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function fetchAdminInvoicingDashboard() {
  return apiRequest("/api/admin/invoicing/dashboard", {
    headers: authHeaders()
  });
}

export function fetchInvoicePerformance(range = "last-30-days", filters = {}, requestOptions = {}) {
  return apiRequest(`/api/admin/invoicing/dashboard/invoice-performance${toQueryString({ range, ...filters })}`, {
    ...requestOptions,
    headers: { ...authHeaders(), ...requestOptions.headers }
  });
}

export function fetchPaymentReminderSummary(range = "today") {
  return apiRequest(`/api/admin/invoicing/dashboard/payment-reminder-summary${toQueryString({ range })}`, {
    headers: authHeaders()
  });
}

export function fetchAdminEmailDelivery(filters = {}) {
  return apiRequest(`/api/admin/invoicing/dashboard/email-delivery${toQueryString(filters)}`, {
    headers: authHeaders()
  });
}

export function fetchAdminPaymentUpdates(filters = {}) {
  return apiRequest(`/api/admin/invoicing/dashboard/payment-updates${toQueryString(filters)}`, {
    headers: authHeaders()
  });
}

export function fetchInvoiceValidationSummary() {
  return apiRequest("/api/admin/invoicing/dashboard/validation-summary", {
    headers: authHeaders()
  });
}

export function fetchInvoiceValidationErrors() {
  return apiRequest("/api/admin/invoicing/dashboard/validation-errors", {
    headers: authHeaders()
  });
}

export async function exportInvoicePerformance(range = "last-30-days", filters = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/invoicing/dashboard/invoice-performance/export${toQueryString({ range, ...filters })}`,
    {
      headers: authHeaders()
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Unable to export invoice performance data.");
  }

  return response.blob();
}

