import { apiRequest, downloadBlob } from "./apiClient.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const TOKEN_KEY = "authToken";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

// ─── HR Organizational Reports ───────────────────────────────────────────────

export function getPayrollReport(params = {}) {
  return apiRequest(`/api/hr/reports/payroll${buildQueryString(params)}`);
}

export function getLeaveReport(params = {}) {
  return apiRequest(`/api/hr/reports/leave${buildQueryString(params)}`);
}

export function getEmployeeReport(params = {}) {
  return apiRequest(`/api/hr/reports/employees${buildQueryString(params)}`);
}

export function getLoanReport(params = {}) {
  return apiRequest(`/api/hr/reports/loans${buildQueryString(params)}`);
}

export function getAdvanceReport(params = {}) {
  return apiRequest(`/api/hr/reports/advances${buildQueryString(params)}`);
}

// ─── Staff Personal Reports ──────────────────────────────────────────────────

export function getMyPayrollReport(params = {}) {
  return apiRequest(`/api/hr/reports/my/payroll${buildQueryString(params)}`);
}

export function getMyLeaveReport(params = {}) {
  return apiRequest(`/api/hr/reports/my/leave${buildQueryString(params)}`);
}

export function getMyLoanReport(params = {}) {
  return apiRequest(`/api/hr/reports/my/loans${buildQueryString(params)}`);
}

// ─── Export Helpers ──────────────────────────────────────────────────────────

export async function exportReport(reportType, params = {}, format = "excel") {
  const token = localStorage.getItem(TOKEN_KEY);
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.set(key, value);
    }
  });
  queryParams.set("format", format);

  const url = `${API_BASE_URL}/api/hr/reports/${reportType}/export?${queryParams}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Export failed");
  }

  const blob = await response.blob();
  const ext = format === "csv" ? "csv" : "xlsx";
  downloadBlob(blob, `${reportType}-report.${ext}`);
}

export async function exportMyReport(reportType, params = {}, format = "excel") {
  const token = localStorage.getItem(TOKEN_KEY);
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.set(key, value);
    }
  });
  queryParams.set("format", format);

  const url = `${API_BASE_URL}/api/hr/reports/my/${reportType}/export?${queryParams}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Export failed");
  }

  const blob = await response.blob();
  const ext = format === "csv" ? "csv" : "xlsx";
  downloadBlob(blob, `my-${reportType}-report.${ext}`);
}
