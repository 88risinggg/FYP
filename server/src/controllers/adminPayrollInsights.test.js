jest.mock("../config/db", () => ({ pool: {} }));

const { normalizeInsightQuery } = require("./adminPayrollController");
const { isReportableStatutorySetting } = require("../models/adminPayrollModel");

const now = new Date("2026-07-24T00:00:00Z");

describe("normalizeInsightQuery", () => {
  test("defaults audit activity to a daily 30-day period", () => {
    expect(normalizeInsightQuery({}, now)).toMatchObject({
      dataset: "audit_activity",
      from: "2026-06-25",
      to: "2026-07-24",
      granularity: "day"
    });
  });

  test("automatically selects weekly and monthly aggregation", () => {
    expect(normalizeInsightQuery({ dataset: "audit_activity", from: "2026-01-01", to: "2026-04-30" }, now).granularity).toBe("week");
    expect(normalizeInsightQuery({ dataset: "run_health", from: "2025-01-01", to: "2026-01-01" }, now).granularity).toBe("month");
    expect(normalizeInsightQuery({ dataset: "run_health", from: "2026-07-01", to: "2026-07-24" }, now).granularity).toBe("month");
  });

  test("accepts snapshot filters without inventing a historical period", () => {
    expect(normalizeInsightQuery({ dataset: "account_status", role: "Finance" }, now)).toMatchObject({
      snapshot: true,
      from: null,
      to: null,
      role: "Finance"
    });
  });

  test.each([
    [{ dataset: "salary_totals" }, "valid dashboard dataset"],
    [{ dataset: "audit_activity", from: "2026-07-30", to: "2026-07-01" }, "start date"],
    [{ dataset: "audit_activity", from: "2023-01-01", to: "2026-07-01" }, "731 days"],
    [{ dataset: "user_roles", accountStatus: "locked" }, "account status"],
    [{ dataset: "account_status", role: "Owner" }, "payroll role"]
  ])("rejects invalid insight query %#", (query, message) => {
    expect(normalizeInsightQuery(query, now).error).toContain(message);
  });
});

describe("Admin statutory report privacy", () => {
  test("includes calculation settings but excludes banking and accounting references", () => {
    expect(isReportableStatutorySetting({ setting_key: "cpf_monthly_wage_ceiling" })).toBe(true);
    expect(isReportableStatutorySetting({ setting_key: "mbmf_employee_rate_percent" })).toBe(true);
    expect(isReportableStatutorySetting({ setting_key: "cpf_employee_payable_account" })).toBe(false);
    expect(isReportableStatutorySetting({ setting_key: "mbmf_payment_bank_account" })).toBe(false);
  });
});
