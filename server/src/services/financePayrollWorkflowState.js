const STAGES = [
  ["claims", "Claim Requests"],
  ["review", "Payroll Run Review"],
  ["staff", "Staff Review & Adjustments"],
  ["approval", "Payroll Approval"],
  ["preparation", "Payment Preparation"],
  ["payment", "Payment Release"],
  ["payslips", "Payslip Delivery"],
  ["statutory", "Statutory & Ledger"],
  ["reconciliation", "Reconciliation & Reports"]
];

function buildFinanceWorkflowState(run) {
  const employees = Array.isArray(run?.employees) ? run.employees : [];
  const counts = {
    employees: employees.length,
    approved: employees.filter((item) => item.financeStatus === "Approved").length,
    held: employees.filter((item) => item.financeStatus === "Hold").length,
    exceptions: employees.reduce((sum, item) => sum + (item.complianceExceptions?.length || 0), 0),
    payslipsSent: employees.filter((item) => ["Sent", "sent_to_staff"].includes(item.financeStatus)).length
  };
  const workflow = {
    claims: true,
    review: Boolean(run?.reviewedAt),
    staff: Boolean(employees.length && counts.approved === employees.length && counts.exceptions === 0),
    approval: Boolean(run?.approvedAt),
    preparation: Boolean(run?.paymentFileGeneratedAt && Number(run?.paymentRecipientsConfigured || 0) >= employees.length),
    payment: Boolean(run?.paidAt),
    payslips: Boolean(run?.payslipsSentAt || (employees.length && counts.payslipsSent === employees.length)),
    statutory: Boolean(run?.cpfSubmissionLoggedAt && run?.otherDeductionsLoggedAt && (run?.ledgerRecordedAt || run?.xeroRecordedAt)),
    reconciliation: Boolean(run?.reconciledAt)
  };
  const processing = ["Submitting", "Processing", "Submitted", "Partially Submitted"].includes(run?.paymentStatus) ? "payment" : null;
  const failed = run?.paymentStatus === "Failed" ? "payment" : null;
  const firstIncomplete = STAGES.find(([key]) => !workflow[key])?.[0] || null;
  const stages = STAGES.map(([key, label]) => {
    let status = workflow[key] ? "completed" : key === firstIncomplete ? "current" : "upcoming";
    if (key === processing) status = "processing";
    if (key === failed) status = "failed";
    if (key === "approval" && (counts.held || counts.exceptions)) status = "blocked";
    return { key, label, status };
  });
  return {
    runId: run?.id,
    currentStage: processing || failed || firstIncomplete || "reconciliation",
    nextAction: stages.find((stage) => ["current", "blocked", "failed"].includes(stage.status))?.label || "Workflow complete",
    stages,
    counts,
    recipientProgress: {
      total: employees.length,
      configured: Number(run?.paymentRecipientsConfigured || 0),
      remaining: Math.max(0, employees.length - Number(run?.paymentRecipientsConfigured || 0))
    },
    paymentProgress: run?.paymentBatch || { total: employees.length, processed: 0, succeeded: 0, failed: 0, remaining: employees.length, status: "Not Started" },
    blockers: [
      ...(run?.rulesChanged ? [{ code: "RULES_CHANGED", message: "Recalculate using the latest Admin payroll rules." }] : []),
      ...(counts.exceptions ? [{ code: "COMPLIANCE_EXCEPTIONS", message: `${counts.exceptions} compliance exception(s) require review.` }] : []),
      ...(counts.held ? [{ code: "EMPLOYEES_ON_HOLD", message: `${counts.held} employee(s) remain on hold.` }] : [])
    ]
  };
}

module.exports = { STAGES, buildFinanceWorkflowState };
