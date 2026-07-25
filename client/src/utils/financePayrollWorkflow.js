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
    review: { path: "/dashboard/payroll/finance/staff-payroll-details", label: "Staff Review & Adjustments" },
    "approve-payroll": { path: "/dashboard/payroll/finance/payment-preparation", label: "Payment Preparation" },
    "confirm-payment": { path: "/dashboard/payroll/finance/payslip-delivery", label: "Payslip Delivery" },
    "send-payslips": { path: "/dashboard/payroll/finance/statutory-ledger", label: "Statutory & Ledger" },
    "record-statutory-ledger": { path: "/dashboard/payroll/finance/reconciliation-reports", label: "Reconciliation & Reports" }
  })[action] || null;
}
