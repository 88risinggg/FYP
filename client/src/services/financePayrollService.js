import { apiRequest } from "./apiClient.js";

export function getFinancePayrollRuns() {
  return apiRequest("/api/payroll/finance/runs");
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

export function recalculateFinancePayrollRun(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/recalculate`, { method: "POST" });
}

export function getFinancePayrollAdjustments(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/adjustments`);
}

export function generateFinancePayrollAdjustments(runId) {
  return apiRequest(`/api/payroll/finance/runs/${runId}/adjustments/generate`, { method: "POST" });
}

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
