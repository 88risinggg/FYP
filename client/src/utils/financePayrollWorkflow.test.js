import { describe, expect, it } from "vitest";
import {
  canAdvanceFinancePayrollRun,
  getFinanceAutoAdvance,
  getFinanceWorkflowState
} from "./financePayrollWorkflow.js";

const timestamp = "2026-07-18T10:00:00.000Z";

describe("Finance payroll workflow", () => {
  it("allows only the next valid step", () => {
    const run = { employees: [{ financeStatus: "Approved" }] };

    expect(canAdvanceFinancePayrollRun(run, "reviewed", { allEmployeesApproved: true })).toBe(true);
    expect(canAdvanceFinancePayrollRun(run, "approved", { allEmployeesApproved: true })).toBe(false);

    run.reviewedAt = timestamp;
    expect(canAdvanceFinancePayrollRun(run, "approved", { allEmployeesApproved: true })).toBe(true);

    run.approvedAt = timestamp;
    expect(canAdvanceFinancePayrollRun(run, "paid", { allEmployeesApproved: true })).toBe(false);

    run.paymentFileGeneratedAt = timestamp;
    expect(canAdvanceFinancePayrollRun(run, "paid", { allEmployeesApproved: true })).toBe(true);
  });

  it("requires both deduction logs and payslips before ledger recording", () => {
    const run = {
      approvedAt: timestamp,
      paymentFileGeneratedAt: timestamp,
      paidAt: timestamp,
      payslipsSentAt: timestamp,
      cpfSubmissionLoggedAt: timestamp
    };

    expect(canAdvanceFinancePayrollRun(run, "ledgerRecorded")).toBe(false);
    expect(canAdvanceFinancePayrollRun(run, "statutoryLogged")).toBe(true);
    run.otherDeductionsLoggedAt = timestamp;
    expect(canAdvanceFinancePayrollRun(run, "statutoryLogged")).toBe(false);
    expect(canAdvanceFinancePayrollRun(run, "ledgerRecorded")).toBe(true);
  });

  it("does not mark payment complete without a generated payment file", () => {
    expect(getFinanceWorkflowState({ paidAt: timestamp }).paid).toBe(false);
  });
});

describe("Finance payroll automatic navigation", () => {
  it("waits until both payment preparation tasks are complete", () => {
    const run = { employees: [{}, {}], paymentFileGeneratedAt: timestamp, paymentRecipientsConfigured: 1 };
    expect(getFinanceAutoAdvance("payment-document", run)).toBeNull();
    expect(getFinanceAutoAdvance("save-recipients", { ...run, paymentRecipientsConfigured: 2 })?.path).toContain("payment-release");
  });

  it("keeps Finance on payment release after confirmation because HR owns payslip delivery", () => {
    expect(getFinanceAutoAdvance("submit-payment", {})).toBeNull();
    expect(getFinanceAutoAdvance("confirm-payment", {})).toBeNull();
    expect(getFinanceAutoAdvance("send-payslips", {})).toBeNull();
  });
});
