import { describe, expect, it } from "vitest";
import { canRoleActOnClaim, getClaimWorkflowSteps } from "./claimWorkflow.js";

describe("claim approval workflow", () => {
  it("routes a submitted claim to HR before Finance", () => {
    expect(canRoleActOnClaim("HR", "pending_hr")).toBe(true);
    expect(canRoleActOnClaim("Finance", "pending_hr")).toBe(false);
  });

  it("allows Finance only after HR approval", () => {
    expect(canRoleActOnClaim("HR", "hr_approved")).toBe(false);
    expect(canRoleActOnClaim("Finance", "hr_approved")).toBe(true);
  });

  it("shows a completed path after reimbursement", () => {
    expect(getClaimWorkflowSteps("released").map((step) => step.state)).toEqual([
      "complete",
      "complete",
      "complete"
    ]);
  });

  it("shows which approval stage rejected the claim", () => {
    expect(getClaimWorkflowSteps("hr_rejected")[1].state).toBe("rejected");
    expect(getClaimWorkflowSteps("finance_rejected")[2].state).toBe("rejected");
  });
});
