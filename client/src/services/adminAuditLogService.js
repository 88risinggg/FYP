import { apiRequest } from "./apiClient.js";
import { getStoredSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

/**
 * Fetch module-filtered audit logs.
 * Pass filters.module = "Invoice" | "Payroll" | "HR" etc.
 */
export function fetchAuditLogs(filters = {}) {
  return apiRequest(`/api/audit-logs${toQueryString(filters)}`, {
    headers: authHeaders()
  });
}

export function fetchAuditSummary(filters = {}) {
  return apiRequest(`/api/audit-logs/summary${toQueryString(filters)}`, {
    headers: authHeaders()
  });
}

export async function exportAuditLogs(filters = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/audit-logs/export${toQueryString(filters)}`,
    { headers: authHeaders() }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Unable to export audit logs.");
  }
  return response.blob();
}
