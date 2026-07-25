export const CLAIM_STATUS_LABELS = Object.freeze({
  pending_hr: "Pending HR review",
  hr_approved: "Awaiting Finance approval",
  hr_rejected: "Rejected by HR",
  released: "Paid externally",
  payroll_approved: "Approved for payroll",
  finance_rejected: "Rejected by Finance"
});

export const CLAIM_STATUS_STYLES = Object.freeze({
  pending_hr: "border-amber-400/40 bg-[#FDD9CD] text-amber-700",
  hr_approved: "border-[#2D7C83]/40 bg-[#FFF6F2] text-[#2D7C83]",
  hr_rejected: "border-red-400/40 bg-[#FDD9CD] text-red-700",
  released: "border-emerald-400/40 bg-[#FFF6F2] text-emerald-700",
  payroll_approved: "border-emerald-400/40 bg-[#FFF6F2] text-emerald-700",
  finance_rejected: "border-red-400/40 bg-[#FDD9CD] text-red-700"
});

export function canRoleActOnClaim(role, status) {
  if (role === "HR") return status === "pending_hr";
  if (role === "Finance") return status === "hr_approved";
  return false;
}

export function getClaimWorkflowSteps(status) {
  const hrComplete = ["hr_approved", "released", "payroll_approved", "finance_rejected"].includes(status);
  const financeCurrent = status === "hr_approved";

  return [
    { label: "Submitted", state: "complete" },
    {
      label: "HR review",
      state: status === "hr_rejected" ? "rejected" : hrComplete ? "complete" : "current"
    },
    {
      label: "Finance approval",
      state:
        status === "finance_rejected"
          ? "rejected"
          : ["released", "payroll_approved"].includes(status)
            ? "complete"
            : financeCurrent
              ? "current"
              : "pending"
    }
  ];
}
