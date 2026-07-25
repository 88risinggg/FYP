import { describe, expect, it } from "vitest";
import { getMissingScheduleFields, shouldShowFinanceTracker } from "./financePayrollNavigation.js";

describe("Finance payroll navigation", () => {
  it.each([
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
  ])("shows the tracker on workflow route %s", (path) => {
    expect(shouldShowFinanceTracker(path)).toBe(true);
  });

  it.each([
    "/dashboard/payroll/finance/compliance-rules",
    "/dashboard/payroll/finance/activity-log",
    "/dashboard/payroll/finance/payroll-schedule",
    "/dashboard/payroll/finance/staff-records"
  ])("omits the tracker from reference/history route %s", (path) => {
    expect(shouldShowFinanceTracker(path)).toBe(false);
  });
});

describe("Finance schedule completeness", () => {
  it("does not require date fields while automatic scheduling is disabled", () => {
    expect(getMissingScheduleFields({ enabled: false })).toEqual([]);
  });

  it("names every missing enabled field for an instructional empty state", () => {
    expect(getMissingScheduleFields({ enabled: true, salaryReleaseDay: 25, salaryReleaseTime: "09:00" }))
      .toEqual(["claim cut-off day", "claim cut-off time"]);
  });

  it("accepts a complete enabled schedule", () => {
    expect(getMissingScheduleFields({ enabled: true, salaryReleaseDay: 31, salaryReleaseTime: "09:00", claimCutoffDay: 20, claimCutoffTime: "23:59" })).toEqual([]);
  });
});
