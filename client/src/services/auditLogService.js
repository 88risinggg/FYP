/**
 * auditLogService.js
 * Unified frontend service for module-filtered audit logs.
 * Uses GET /api/audit-logs?module=Invoice|Payroll|HR...
 */
import { apiRequest } from "./apiClient.js";

function toQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function fetchModuleAuditLogs(module, filters = {}) {
  return apiRequest(`/api/audit-logs${toQuery({ module, ...filters })}`);
}

export function fetchModuleAuditSummary(module) {
  return apiRequest(`/api/audit-logs/summary${toQuery({ module })}`);
}

export async function exportModuleAuditLogs(module, filters = {}) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
  const token = localStorage.getItem("authToken");
  const response = await fetch(
    `${API_BASE}/api/audit-logs/export${toQuery({ module, ...filters })}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Export failed");
  return response.blob();
}
