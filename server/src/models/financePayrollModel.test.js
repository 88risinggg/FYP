const { _test } = require("./financePayrollModel");
const { pool } = require("../config/db");

afterAll(async () => {
  await pool.end();
});

describe("Finance payroll bulk data helpers", () => {
  test("groups unpaid leave totals by payroll period and employee", () => {
    const lookup = _test.buildUnpaidLeaveLookup([
      { staff_employee_id: 12, payroll_month: 7, payroll_year: 2026, total_unpaid_days: "1.5" },
      { staff_employee_id: 13, payroll_month: 7, payroll_year: 2026, total_unpaid_days: 2 },
      { staff_employee_id: 12, payroll_month: 6, payroll_year: 2026, total_unpaid_days: 1 }
    ]);

    expect(lookup.get("7_2026").get(12)).toBe(1.5);
    expect(lookup.get("7_2026").get(13)).toBe(2);
    expect(lookup.get("6_2026").get(12)).toBe(1);
  });

  test("normalizes empty and string totals", () => {
    const lookup = _test.buildUnpaidLeaveLookup([
      { staff_employee_id: "7", payroll_month: "1", payroll_year: "2026", total_unpaid_days: null }
    ]);

    expect(lookup.get("1_2026").get(7)).toBe(0);
  });
});
