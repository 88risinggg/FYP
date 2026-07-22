const { CLAIM_STATUSES, canActOnClaim, getClaimTransition } = require("./claimWorkflow");

describe("claim approval workflow", () => {
  test("HR can review only a newly submitted claim", () => {
    expect(canActOnClaim("HR", "approve", CLAIM_STATUSES.PENDING_HR)).toBe(true);
    expect(canActOnClaim("HR", "approve", CLAIM_STATUSES.HR_APPROVED)).toBe(false);
  });

  test("Finance can process only an HR-reviewed claim", () => {
    expect(canActOnClaim("Finance", "release", CLAIM_STATUSES.PENDING_HR)).toBe(false);
    expect(canActOnClaim("Finance", "release", CLAIM_STATUSES.HR_APPROVED)).toBe(true);
  });

  test("maps rejection to the correct role-specific status", () => {
    expect(getClaimTransition("HR", "reject").to).toBe(CLAIM_STATUSES.HR_REJECTED);
    expect(getClaimTransition("Finance", "reject").to).toBe(CLAIM_STATUSES.FINANCE_REJECTED);
  });

  test("rejects actions owned by another role", () => {
    expect(getClaimTransition("HR", "release")).toBeNull();
    expect(getClaimTransition("Staff", "approve")).toBeNull();
  });
});
