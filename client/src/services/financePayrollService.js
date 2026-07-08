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
