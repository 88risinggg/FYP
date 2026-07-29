/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable payslip Delivery helper functions.
 * LAYER: Frontend utility - provides reusable data transformation or helper logic.
 * FIND RELATED CODE: Use Find All References on its exports to locate connected features.
 */
export async function readPayslipDeliveryResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return {
    message: response.ok
      ? "Payslip delivery started."
      : `The server returned an unexpected ${response.status} response. Please retry.`
  };
}

export function getPayslipDeliveryStartedAt(value, fallback = Date.now()) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

export function isPayslipDeliveryAttemptComplete(workflowBody, startedAt) {
  if (workflowBody?.run?.payslipsSentAt) return true;
  const attemptedAt = Date.parse(workflowBody?.run?.payslipDelivery?.attemptedAt || "");
  return Number.isFinite(attemptedAt) && attemptedAt >= startedAt;
}

export function getPayslipDeliveryFailureCount(workflowBody) {
  return Number(workflowBody?.workflow?.payslipProgress?.failed || 0);
}
