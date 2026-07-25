const { postPayrollRecoveries, _test } = require("./payrollRecoveryPostingService");

describe("Payroll recovery posting references", () => {
  test("uses the persisted source record identifier", () => {
    expect(_test.sourceRecordId({ sourceRecordId: 42, label: "Loan repayment 8" })).toBe("42");
  });

  test.each([
    ["Loan repayment 18", "18"],
    ["Salary advance ADV-27", "ADV-27"]
  ])("supports historical deduction label %s", (label, expected) => {
    expect(_test.sourceRecordId({ label })).toBe(expected);
  });

  test("does not guess an identifier from an unrelated deduction", () => {
    expect(_test.sourceRecordId({ label: "Insurance premium 12" })).toBeNull();
  });

  test("posts only the collected amount and preserves the deferred balance", async () => {
    const updates = [];
    const connection = { execute: jest.fn(async (sql, params) => {
      if (sql.includes("FROM payroll WHERE")) return [[{ payroll_id: 9, staff_employee_id: 7, deduction_breakdown: { otherDeductions: [{ sourceRecordId: "ADV-1", amount: 960, scheduledAmount: 1166.66, deferredAmount: 206.66 }] } }]];
      if (sql.includes("FROM claims_and_loans WHERE")) return [[{ record_id: "ADV-1", staff_employee_id: 7, monthly_installment: 1166.66, outstanding_balance: 2000 }]];
      if (sql.includes("UPDATE claims_and_loans")) { updates.push(params); return [{ affectedRows: 1 }]; }
      if (sql.includes("UPDATE payroll SET deduction_breakdown")) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }) };
    const postings = await postPayrollRecoveries({ connection, payrollRunId: 3, userId: 5 });
    expect(postings).toEqual([{ claimRecordId: "ADV-1", appliedAmount: 960, deferredAmount: 206.66, balanceAfter: 1040 }]);
    expect(updates[0]).toEqual([1040, 960, "ADV-1"]);
  });

  test("does not reduce the balance again when the run was already posted", async () => {
    const connection = { execute: jest.fn(async (sql) => {
      if (sql.includes("FROM payroll WHERE")) return [[{ payroll_id: 9, staff_employee_id: 7, deduction_breakdown: { otherDeductions: [{ sourceRecordId: "ADV-1", amount: 960, recoveryPostedAt: "2026-07-26T00:00:00.000Z" }] } }]];
      throw new Error("Balance update must not run for a duplicate posting.");
    }) };
    await expect(postPayrollRecoveries({ connection, payrollRunId: 3, userId: 5 })).resolves.toEqual([]);
  });
});
