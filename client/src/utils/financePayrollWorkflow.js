/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - FINANCE
 * PURPOSE: Provides reusable finance Payroll Workflow helper functions.
 * LAYER: Frontend utility - provides reusable data transformation or helper logic.
 * FIND RELATED CODE: Use Find All References on its exports to locate connected features.
 */
export function getFinanceWorkflowState(run) {
  return {
    reviewed: Boolean(run?.reviewedAt || run?.approvedAt || run?.paidAt),
    approved: Boolean(run?.approvedAt || run?.paidAt),
    paymentFileGenerated: Boolean(run?.paymentFileGeneratedAt),
    paid: Boolean(run?.paymentFileGeneratedAt && run?.paidAt),
    payslipsSent: Boolean(run?.payslipsSentAt),
    cpfLogged: Boolean(run?.cpfSubmissionLoggedAt),
    otherDeductionsLogged: Boolean(run?.otherDeductionsLoggedAt),
    ledgerRecorded: Boolean(run?.ledgerRecordedAt || run?.xeroRecordedAt),
    reconciled: Boolean(run?.reconciledAt)
  };
}

export function canAdvanceFinancePayrollRun(run, step, options = {}) {
  const state = getFinanceWorkflowState(run);
  const allEmployeesApproved = Boolean(options.allEmployeesApproved);

  const rules = {
    reviewed: !state.reviewed,
    approved: state.reviewed && allEmployeesApproved && !state.approved,
    paid: state.approved && state.paymentFileGenerated && !state.paid,
    payslipsSent: state.paid && !state.payslipsSent,
    cpfLogged: state.paid && !state.cpfLogged,
    otherDeductionsLogged: state.paid && !state.otherDeductionsLogged,
    statutoryLogged: state.paid && (!state.cpfLogged || !state.otherDeductionsLogged),
    ledgerRecorded:
      state.payslipsSent &&
      state.cpfLogged &&
      state.otherDeductionsLogged &&
      !state.ledgerRecorded,
    reconciled: state.ledgerRecorded && !state.reconciled
  };

  return rules[step] === true;
}

export function getFinanceAutoAdvance(action, run = {}) {
  if (["payment-document", "save-recipients"].includes(action)) {
    return run.paymentFileGeneratedAt && Number(run.paymentRecipientsConfigured || 0) >= (run.employees?.length || 0)
      ? { path: "/dashboard/payroll/finance/payment-release", label: "Payment Release" }
      : null;
  }
  return ({
    "approve-payroll": { path: "/dashboard/payroll/finance/payment-preparation", label: "Payment Preparation" },
    "record-statutory-ledger": { path: "/dashboard/payroll/finance/reconciliation-reports", label: "Reconciliation & Reports" },
    reconcile: { path: "/dashboard/payroll/finance/payroll-completion", label: "Payroll Run Completion" }
  })[action] || null;
}
