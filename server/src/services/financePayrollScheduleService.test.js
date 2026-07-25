jest.mock("../config/db", () => ({ pool: {} }));
jest.mock("./modernTreasuryPaymentService", () => ({ submitModernTreasuryPayrollBatch: jest.fn() }));
jest.mock("./payrollNotificationService", () => ({ notifyRoles: jest.fn() }));
jest.mock("./auditService", () => ({ writeAuditLog: jest.fn(), MODULE: { PAYROLL: "Payroll" } }));
jest.mock("../models/financePayrollModel", () => ({ getPayrollRunComplianceErrors: jest.fn() }));

const { calculatePeriodSchedule, previousBusinessDate, targetPeriodForCutoff } = require("./financePayrollScheduleService");

describe("Finance payroll schedule date rules", () => {
  test("clamps an unavailable day to month end", () => {
    expect(previousBusinessDate(2026, 2, 31, [])).toBe("2026-02-27");
  });

  test("moves backward over weekends and active public holidays", () => {
    expect(previousBusinessDate(2026, 8, 10, ["2026-08-10"])).toBe("2026-08-07");
  });

  test("returns no effective dates while scheduling is disabled", () => {
    expect(calculatePeriodSchedule({ enabled: false }, 2026, 7, [])).toEqual({ claimCutoffAt: null, scheduledReleaseAt: null });
  });

  test("calculates fixed monthly cutoff and release timestamps in Singapore local time", () => {
    expect(calculatePeriodSchedule({
      enabled: true, salaryReleaseDay: 28, salaryReleaseTime: "09:00",
      claimCutoffDay: 20, claimCutoffTime: "23:59"
    }, 2026, 7, [])).toEqual({
      claimCutoffAt: "2026-07-20 23:59:00",
      scheduledReleaseAt: "2026-07-28 09:00:00"
    });
  });

  test("keeps a claim approved exactly at cutoff in the current payroll", () => {
    expect(targetPeriodForCutoff(2026, 7, "2026-07-20 23:59:00", "2026-07-20 23:59:00")).toEqual({ year: 2026, month: 7 });
  });

  test("rolls a claim approved after cutoff across a year boundary", () => {
    expect(targetPeriodForCutoff(2026, 12, "2026-12-21 00:00:00", "2026-12-20 23:59:00")).toEqual({ year: 2027, month: 1 });
  });
});
