export const CLAIM_STATUS_LABELS = Object.freeze({
  pending_hr: "Pending HR review",
  hr_approved: "Awaiting Finance payment",
  hr_rejected: "Rejected by HR",
  released: "Reimbursed",
  finance_rejected: "Rejected by Finance"
});

export const CLAIM_STATUS_STYLES = Object.freeze({
  pending_hr: "border-amber-400/40 bg-amber-50 text-amber-700",
  hr_approved: "border-cyan-400/40 bg-cyan-50 text-cyan-700",
  hr_rejected: "border-red-400/40 bg-red-50 text-red-700",
  released: "border-emerald-400/40 bg-emerald-50 text-emerald-700",
  finance_rejected: "border-red-400/40 bg-red-50 text-red-700"
});

export function canRoleActOnClaim(role, status) {
  if (role === "HR") return status === "pending_hr";
  if (role === "Finance") return status === "hr_approved";
  return false;
}

export function getClaimWorkflowSteps(status) {
  const hrComplete = ["hr_approved", "released", "finance_rejected"].includes(status);
  const financeCurrent = status === "hr_approved";

  return [
    { label: "Submitted", state: "complete" },
    {
      label: "HR review",
      state: status === "hr_rejected" ? "rejected" : hrComplete ? "complete" : "current"
    },
    {
      label: "Finance payment",
      state:
        status === "finance_rejected"
          ? "rejected"
          : status === "released"
            ? "complete"
            : financeCurrent
              ? "current"
              : "pending"
    }
  ];
}
