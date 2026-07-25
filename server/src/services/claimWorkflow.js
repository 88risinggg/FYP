const CLAIM_STATUSES = Object.freeze({
  PENDING_HR: "pending_hr",
  HR_APPROVED: "hr_approved",
  HR_REJECTED: "hr_rejected",
  RELEASED: "released",
  FINANCE_REJECTED: "finance_rejected"
});

const TRANSITIONS = Object.freeze({
  HR: Object.freeze({
    approve: Object.freeze({ from: CLAIM_STATUSES.PENDING_HR, to: CLAIM_STATUSES.HR_APPROVED }),
    reject: Object.freeze({ from: CLAIM_STATUSES.PENDING_HR, to: CLAIM_STATUSES.HR_REJECTED })
  }),
  Finance: Object.freeze({
    release: Object.freeze({ from: CLAIM_STATUSES.HR_APPROVED, to: "payroll_approved" }),
    reject: Object.freeze({ from: CLAIM_STATUSES.HR_APPROVED, to: CLAIM_STATUSES.FINANCE_REJECTED })
  })
});

function getClaimTransition(role, action) {
  return TRANSITIONS[role]?.[action] || null;
}

function canActOnClaim(role, action, status) {
  const transition = getClaimTransition(role, action);
  return Boolean(transition && transition.from === status);
}

module.exports = { CLAIM_STATUSES, canActOnClaim, getClaimTransition };
