import { apiRequest } from "./apiClient.js";

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
