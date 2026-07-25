export const FINANCE_WORKFLOW_TRACKER_PATHS = Object.freeze([
  "/dashboard/payroll/finance",
  "/dashboard/payroll/finance/employee-requests",
  "/dashboard/payroll/finance/payroll-runs",
  "/dashboard/payroll/finance/staff-payroll-details",
  "/dashboard/payroll/finance/payroll-approval",
  "/dashboard/payroll/finance/payment-preparation",
  "/dashboard/payroll/finance/payment-release",
  "/dashboard/payroll/finance/payslip-delivery",
  "/dashboard/payroll/finance/statutory-ledger",
  "/dashboard/payroll/finance/reconciliation-reports",
  "/dashboard/payroll/finance/payslips-approval",
  "/dashboard/payroll/finance/payroll-reports",
  "/dashboard/payroll/finance/payroll-summaries"
]);

export function shouldShowFinanceTracker(pathname) {
  return FINANCE_WORKFLOW_TRACKER_PATHS.includes(pathname);
}

export function getMissingScheduleFields(schedule = {}) {
  if (!schedule.enabled) return [];
  return [
    ["salaryReleaseDay", "salary release day"],
    ["salaryReleaseTime", "release time"],
    ["claimCutoffDay", "claim cut-off day"],
    ["claimCutoffTime", "claim cut-off time"]
  ].filter(([key]) => schedule[key] === "" || schedule[key] == null).map(([, label]) => label);
}
