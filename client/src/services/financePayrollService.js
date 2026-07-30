/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Provides reusable finance Payroll Service business or integration operations.
 * LAYER: Frontend service - calls backend APIs or manages browser-side application state.
 * FIND RELATED CODE: Search the API path in server/src/routes to continue into the backend.
 */
import { apiRequest, downloadBlob } from "./apiClient.js";

export function getFinancePayrollRuns() {
  return apiRequest("/api/payroll/finance/runs");
}

export async function exportFinancePayrollReport(runId, reportType) {
  const query = new URLSearchParams({ runId, reportType, format: "xlsx" });
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/payroll/finance/reports/export?${query}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("authToken") || ""}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw Object.assign(new Error(body.message || "Excel export failed."), { code: body.code }); }
  const blob = await response.blob();
  const slug = reportType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadBlob(blob, `${slug}-${runId}.xlsx`);
}

export function createFinancePayrollRunFromStaff(payload = {}) {
  return apiRequest("/api/payroll/finance/runs/from-staff", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function saveFinancePayrollRun(run) {
  return apiRequest(`/api/payroll/finance/runs/${run.id}`, {
    method: "PUT",
    body: JSON.stringify({ run })
  });
}

export function validateFinancePayrollRun(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/validate`, { method: "POST" });
}

export function getFinancePayrollWorkflow(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/workflow`);
}

export function getFinanceRuleAcknowledgement() {
  return apiRequest("/api/payroll/finance/rule-acknowledgement");
}

export function acknowledgeFinancePayrollRules() {
  return apiRequest("/api/payroll/finance/rule-acknowledgement", { method: "POST" });
}

// FUNCTION: Sends one named Finance workflow command to the backend. Approval uses
// its dedicated endpoint; all other transitions use the generic action endpoint.
export function performFinancePayrollWorkflowAction(runId, action, payload = {}) {
  const path = action === "approve-payroll"
    ? `/api/payroll/finance/runs/${runId}/approve`
    : `/api/payroll/finance/runs/${runId}/workflow/${action}`;
  return apiRequest(path, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// FUNCTION: Requests a fresh calculation for an unlocked run after rule/data changes.
export function recalculateFinancePayrollRun(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/recalculate`, { method: "POST" });
}

export function getFinancePayrollAdjustments(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/adjustments`);
}

// FUNCTION: Requests explainable adjustment suggestions for a Finance payroll run.
export function generateFinancePayrollAdjustments(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/adjustments/generate`, { method: "POST" });
}

// FUNCTION: Sends selected proposal IDs plus an approve/reject decision and reason.
export function reviewFinancePayrollAdjustments(runId, payload) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/adjustments/review`, {
    method: "POST", body: JSON.stringify(payload)
  });
}

export function getFinancePayrollActivity(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null));
  return apiRequest(`/api/payroll/finance/activity?${query.toString()}`);
}

export function getPayslipPeriodSummary(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null));
  return apiRequest(`/api/payroll/finance/payslip-period-summary?${query.toString()}`);
}

export function getFinancePayrollSchedule() {
  return apiRequest("/api/payroll/finance/schedule");
}

export function getFinancePayrollSchedulePreview(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== "" && value != null));
  return apiRequest(`/api/payroll/finance/schedule/preview?${query.toString()}`);
}

export function updateFinancePayrollSchedule(schedule) {
  return apiRequest("/api/payroll/finance/schedule", { method: "PUT", body: JSON.stringify(schedule) });
}

export function updateFinancePayrollRunSchedule(runId, schedule) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/schedule`, { method: "PUT", body: JSON.stringify(schedule) });
}

export function performFinancePayrollScheduleAction(runId, action) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/schedule/${action}`, { method: "POST" });
}
