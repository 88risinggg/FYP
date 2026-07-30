/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - ADMIN
 * PURPOSE: Provides reusable admin Payroll Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest } from "./apiClient.js";
import { downloadBlob } from "./apiClient.js";

// FUNCTION: Loads the complete Admin Payroll dashboard payload, including users,
// settings, payroll runs, layouts, audit activity and summary statistics.
export function getAdminPayrollDashboard() {
  return apiRequest("/api/payroll/admin/dashboard");
}

// FUNCTION: Loads chart-ready Admin insight data using optional date, dataset,
// role, status and grouping filters supplied through the URL query string.
export function getAdminPayrollInsights(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  return apiRequest(`/api/payroll/admin/dashboard/insights?${query.toString()}`);
}

// FUNCTION: Loads the human-readable catalogue of active payroll rules together
// with their effective dates, categories, sources and publication information.
export function getEffectivePayrollRules() {
  return apiRequest("/api/payroll/admin/effective-rules");
}

// FUNCTION: Loads the database-backed datasets used by the Admin report screen.
export function getAdminPayrollReports() {
  return apiRequest("/api/payroll/admin/reports");
}

// FUNCTION: Requests an Admin payroll report as an authenticated Excel file,
// converts the response to a Blob and starts a browser download.
export async function exportAdminPayrollReport(reportType, params = {}) {
  const query = new URLSearchParams({ reportType, format: "xlsx", ...Object.fromEntries(Object.entries(params).filter(([, value]) => value)) });
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/admin/reports/export?${query}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Excel export failed."); }
  const blob = await response.blob();
  downloadBlob(blob, `${reportType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.xlsx`);
}

// FUNCTION: Loads the normalized CPF, SDL, self-help-group, earnings, deduction
// and validation configuration used by payroll calculations.
export function getPayrollRuleConfig() {
  return apiRequest("/api/payroll/admin/config");
}

// FUNCTION: Sends a new payroll user's account, role and optional linked staff
// details to the protected Admin user-creation endpoint.
export function createUser(user) {
  return apiRequest("/api/payroll/admin/users", {
    method: "POST",
    body: JSON.stringify(user)
  });
}

// FUNCTION: Uploads a payslip-template file as multipart form data. The browser
// supplies the multipart boundary, so the shared API client must not force JSON.
export function addPayslipLayout(file) {
  const formData = new FormData();
  formData.append("layoutFile", file);
  return apiRequest("/api/payroll/admin/payslip-layouts", {
    method: "POST",
    headers: { "Content-Type": undefined },
    body: formData
  });
}

// FUNCTION: Selects one stored payslip layout as the company-wide default.
export function setDefaultPayslipLayout(layoutId) {
  return apiRequest(`/api/payroll/admin/payslip-layouts/${layoutId}/default`, {
    method: "PATCH"
  });
}

// FUNCTION: Downloads the rendered preview for a selected stored payslip layout
// and returns it as a Blob for display in the Admin interface.
export async function getPayslipLayoutPreview(layoutId) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/admin/payslip-layouts/${layoutId}/preview`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Payslip preview failed."); }
  return response.blob();
}

// FUNCTION: Generates and downloads a sample payslip using the current default
// layout, company branding and demonstration payroll values.
export async function getPayslipSamplePreview() {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/admin/payslip-layouts/sample/preview`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || "Sample payslip preview failed."); }
  return response.blob();
}

// FUNCTION: Activates or disables a payroll user through the shared payroll-user
// endpoint. The backend verifies Admin permission and records the action.
export function updateUserStatus(userId, status) {
  return apiRequest(`/api/payroll/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

// FUNCTION: Assigns a new role to a payroll user. `roleId` identifies the stored
// role/permission record rather than trusting a role name from the browser.
export function updateUserRole(userId, roleId) {
  return apiRequest(`/api/payroll/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleId })
  });
}

// FUNCTION: Starts the protected Admin password-reset process for one payroll user.
export function resetUserPassword(userId) {
  return apiRequest(`/api/payroll/users/${userId}/reset-password`, {
    method: "POST"
  });
}

// FUNCTION: Updates one payroll configuration key and sends its value, metadata,
// effective date or evidence fields in the JSON payload.
export function updatePayrollSetting(settingKey, payload) {
  return apiRequest(`/api/payroll/admin/settings/${settingKey}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

// FUNCTION: Sends Admin's prepared rule changes and publication reason to the
// transactional backend publication endpoint; returns the new version/catalogue.
export function publishPayrollRules(changes, changeReason) {
  return apiRequest("/api/payroll/admin/rules/publish", {
    method: "POST",
    body: JSON.stringify({ changes, changeReason })
  });
}
