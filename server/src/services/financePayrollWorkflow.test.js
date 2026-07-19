const { validateFinancePayrollRun } = require("./financePayrollWorkflow");

const timestamp = "2026-07-18T10:00:00.000Z";

function validRun(overrides = {}) {
  return {
    id: "PAY-2026-07",
    month: 7,
    year: 2026,
    employees: [{ id: "EMP-001", financeStatus: "Approved" }],
    ...overrides
  };
}

describe("validateFinancePayrollRun", () => {
  test("accepts a correctly ordered completed workflow", () => {
    const errors = validateFinancePayrollRun(validRun({
      reviewedAt: timestamp,
      approvedAt: timestamp,
      paymentFileGeneratedAt: timestamp,
      paidAt: timestamp,
      payslipsSentAt: timestamp,
      cpfSubmissionLoggedAt: timestamp,
      otherDeductionsLoggedAt: timestamp,
      ledgerRecordedAt: timestamp,
      reconciledAt: timestamp
    }));

    expect(errors).toEqual([]);
  });

  test("rejects approval before review and unapproved employees", () => {
    const errors = validateFinancePayrollRun(validRun({
      approvedAt: timestamp,
      employees: [{ id: "EMP-001", financeStatus: "Hold" }]
    }));

    expect(errors).toContain("Payroll must be reviewed before approval.");
    expect(errors).toContain("Every employee must be approved before payroll approval.");
  });

  test("rejects approval when a persisted employee compliance exception remains", () => {
    const errors = validateFinancePayrollRun(validRun({
      reviewedAt: timestamp,
      approvedAt: timestamp,
      employees: [{
        id: "EMP-001",
        financeStatus: "Approved",
        complianceExceptions: ["Bank account details are incomplete"]
      }]
    }));
    expect(errors).toContain("Every employee must be approved before payroll approval.");
  });

  test("rejects ledger recording before prerequisite records", () => {
    const errors = validateFinancePayrollRun(validRun({ ledgerRecordedAt: timestamp }));

    expect(errors).toContain("Payslips and statutory deductions must be completed before ledger recording.");
  });
});
