import { describe, expect, it } from "vitest";
import { normalizeFinancePayrollRuns } from "./financePayrollData.js";

describe("finance payroll data normalization", () => {
  it("makes stale and malformed item data safe to render", () => {
    const [run] = normalizeFinancePayrollRuns([{ month: 7, year: 2026, employees: [{ earningItems: [{ amount: "10" }, null], deductionItems: [{}] }] }]);
    expect(run.id).toBe("7_2026");
    expect(run.employees[0].earningItems.map((item) => item.label)).toEqual(["Earning", "Earning"]);
    expect(run.employees[0].deductionItems[0].label.toLowerCase()).toBe("deduction");
  });

  it("normalizes API bank fields and absent arrays", () => {
    const [run] = normalizeFinancePayrollRuns([{ id: "7_2026", month: 7, year: 2026, employees: [{ bank: "DBS", accountNo: "123" }] }]);
    expect(run.employees[0]).toMatchObject({ bankType: "DBS", bankAccount: "123", complianceExceptions: [] });
  });

  it("preserves database payroll result amounts as numeric source-of-truth fields", () => {
    const [run] = normalizeFinancePayrollRuns([{ month: 1, year: 2026, employees: [{
      recordSource: "staff_db",
      storedGrossPay: "4500.25",
      storedTotalDeductions: "910.10",
      storedNetPay: "3590.15"
    }] }]);

    expect(run.employees[0]).toMatchObject({
      storedGrossPay: 4500.25,
      storedTotalDeductions: 910.1,
      storedNetPay: 3590.15
    });
  });
});
