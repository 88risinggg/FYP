import { apiRequest } from "./apiClient.js";

export function getAdminPayrollDashboard() {
  return apiRequest("/api/payroll/admin/dashboard");
}

export function getPayrollRuleConfig() {
  return apiRequest("/api/payroll/admin/config");
}

export function addPayslipLayout(layout) {
  return apiRequest("/api/payroll/admin/payslip-layouts", {
    method: "POST",
    body: JSON.stringify(layout)
  });
}

export function setDefaultPayslipLayout(layoutId) {
  return apiRequest(`/api/payroll/admin/payslip-layouts/${layoutId}/default`, {
    method: "PATCH"
  });
}

export function updateUserStatus(userId, status) {
  return apiRequest(`/api/payroll/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function updateUserRole(userId, roleId) {
  return apiRequest(`/api/payroll/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleId })
  });
}

export function resetUserPassword(userId) {
  return apiRequest(`/api/payroll/admin/users/${userId}/reset-password`, {
    method: "POST"
  });
}

export function updatePayrollSetting(settingKey, payload) {
  return apiRequest(`/api/payroll/admin/settings/${settingKey}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
