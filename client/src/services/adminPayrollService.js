import { apiRequest } from "./apiClient.js";
import { downloadBlob } from "./apiClient.js";

export function getAdminPayrollDashboard() {
  return apiRequest("/api/payroll/admin/dashboard");
}

export function getAdminPayrollInsights(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  return apiRequest(`/api/payroll/admin/dashboard/insights?${query.toString()}`);
}

export function getEffectivePayrollRules() {
  return apiRequest("/api/payroll/admin/effective-rules");
}

export function getAdminPayrollReports() {
  return apiRequest("/api/payroll/admin/reports");
}
export async function exportAdminPayrollReport(reportType, params = {}) {
  const query = new URLSearchParams({ reportType, format: "xlsx", ...Object.fromEntries(Object.entries(params).filter(([, value]) => value)) });
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/admin/reports/export?${query}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Excel export failed."); }
  const blob = await response.blob();
  downloadBlob(blob, `${reportType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.xlsx`);
}

export function getPayrollRuleConfig() {
  return apiRequest("/api/payroll/admin/config");
}

export function createUser(user) {
  return apiRequest("/api/payroll/admin/users", {
    method: "POST",
    body: JSON.stringify(user)
  });
}

export function addPayslipLayout(file) {
  const formData = new FormData();
  formData.append("layoutFile", file);
  return apiRequest("/api/payroll/admin/payslip-layouts", {
    method: "POST",
    headers: { "Content-Type": undefined },
    body: formData
  });
}

export function setDefaultPayslipLayout(layoutId) {
  return apiRequest(`/api/payroll/admin/payslip-layouts/${layoutId}/default`, {
    method: "PATCH"
  });
}
export async function getPayslipLayoutPreview(layoutId) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/admin/payslip-layouts/${layoutId}/preview`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Payslip preview failed."); }
  return response.blob();
}
export async function getPayslipSamplePreview() {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/admin/payslip-layouts/sample/preview`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Sample payslip preview failed."); }
  return response.blob();
}

export function updateUserStatus(userId, status) {
  return apiRequest(`/api/payroll/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function updateUserRole(userId, roleId) {
  return apiRequest(`/api/payroll/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleId })
  });
}

export function resetUserPassword(userId) {
  return apiRequest(`/api/payroll/users/${userId}/reset-password`, {
    method: "POST"
  });
}

export function updatePayrollSetting(settingKey, payload) {
  return apiRequest(`/api/payroll/admin/settings/${settingKey}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function publishPayrollRules(changes, changeReason) {
  return apiRequest("/api/payroll/admin/rules/publish", {
    method: "POST",
    body: JSON.stringify({ changes, changeReason })
  });
}
