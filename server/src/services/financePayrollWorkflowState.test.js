const { buildFinanceWorkflowState } = require("./financePayrollWorkflowState");

describe("finance payroll workflow state", () => {
  const employee = { financeStatus: "Approved", complianceExceptions: [] };

  test("stops at payroll review for a newly created run", () => {
    const state = buildFinanceWorkflowState({ id: "1_2026", employees: [employee] });
    expect(state.currentStage).toBe("review");
    expect(state.stages.find((stage) => stage.key === "claims").status).toBe("completed");
  });

  test("marks payroll approval blocked while an employee is held", () => {
    const state = buildFinanceWorkflowState({ id: "1_2026", reviewedAt: "2026-01-01", employees: [{ ...employee, financeStatus: "Hold" }] });
    expect(state.stages.find((stage) => stage.key === "approval").status).toBe("blocked");
    expect(state.blockers[0].code).toBe("EMPLOYEES_ON_HOLD");
  });

  test("shows payment processing separately from confirmed payment", () => {
    const state = buildFinanceWorkflowState({ id: "1_2026", reviewedAt: "x", approvedAt: "x", paymentFileGeneratedAt: "x", paymentRecipientsConfigured: 1, paymentStatus: "Processing", employees: [employee] });
    expect(state.currentStage).toBe("payment");
    expect(state.stages.find((stage) => stage.key === "payment").status).toBe("processing");
  });

  test("exposes resumable partial Modern Treasury progress", () => {
    const paymentBatch = { status: "Partially Submitted", total: 3, succeeded: 2, failed: 1, remaining: 1 };
    const state = buildFinanceWorkflowState({ id: "1_2026", reviewedAt: "x", approvedAt: "x", paymentFileGeneratedAt: "x", paymentRecipientsConfigured: 1, paymentStatus: "Partially Submitted", paymentBatch, employees: [employee] });
    expect(state.currentStage).toBe("payment");
    expect(state.paymentProgress).toEqual(paymentBatch);
    expect(state.stages.find((stage) => stage.key === "payment").status).toBe("processing");
  });
});
