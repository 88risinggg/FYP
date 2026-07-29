/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Provides reusable finance Payroll Workflow business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
function isPresent(value) {
  return value !== undefined && value !== null && value !== "";
}

function validateFinancePayrollRun(run) {
  const errors = [];

  if (!run || typeof run !== "object" || Array.isArray(run)) {
    return ["Payroll run must be an object."];
  }

  if (typeof run.id !== "string" || !run.id.trim()) errors.push("Payroll run ID is required.");
  if (!Number.isInteger(Number(run.month)) || Number(run.month) < 1 || Number(run.month) > 12) {
    errors.push("Payroll month must be between 1 and 12.");
  }
  if (!Number.isInteger(Number(run.year)) || Number(run.year) < 2000) {
    errors.push("Payroll year must be 2000 or later.");
  }
  if (!Array.isArray(run.employees) || run.employees.length === 0) {
    errors.push("At least one employee is required for a payroll run.");
  }

  const has = (field) => isPresent(run[field]);
  const requireStep = (field, prerequisite, message) => {
    if (has(field) && !has(prerequisite)) errors.push(message);
  };

  requireStep("approvedAt", "reviewedAt", "Payroll must be reviewed before approval.");
  requireStep("paymentFileGeneratedAt", "approvedAt", "Payroll must be approved before generating a payment file.");
  requireStep("paidAt", "paymentFileGeneratedAt", "A payment file must be generated before payment confirmation.");
  requireStep("payslipsSentAt", "paidAt", "Payment must be confirmed before payslips are sent.");
  requireStep("cpfSubmissionLoggedAt", "paidAt", "Payment must be confirmed before CPF and MBMF are logged.");
  requireStep("otherDeductionsLoggedAt", "paidAt", "Payment must be confirmed before other deductions are logged.");

  if (has("ledgerRecordedAt") || has("xeroRecordedAt")) {
    if (!has("payslipsSentAt") || !has("cpfSubmissionLoggedAt") || !has("otherDeductionsLoggedAt")) {
      errors.push("Payslips and statutory deductions must be completed before ledger recording.");
    }
  }

  if (has("reconciledAt") && !has("ledgerRecordedAt") && !has("xeroRecordedAt")) {
    errors.push("Payroll must be recorded in the ledger before reconciliation.");
  }

  if (has("approvedAt") && Array.isArray(run.employees)) {
    const hasUnapprovedEmployee = run.employees.some(
      (employee) => employee?.financeStatus !== "Approved" || employee?.complianceExceptions?.length
    );
    if (hasUnapprovedEmployee) errors.push("Every employee must be approved before payroll approval.");
  }

  return errors;
}

module.exports = { validateFinancePayrollRun };
