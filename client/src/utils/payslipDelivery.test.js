import { describe, expect, it, vi } from "vitest";
import {
  getPayslipDeliveryFailureCount,
  getPayslipDeliveryStartedAt,
  isPayslipDeliveryAttemptComplete,
  readPayslipDeliveryResponse
} from "./payslipDelivery.js";

describe("payslip delivery client workflow", () => {
  it("reads JSON responses from the API", async () => {
    const json = vi.fn().mockResolvedValue({ code: "PAYSLIP_DELIVERY_STARTED" });
    const response = { ok: true, status: 202, headers: { get: () => "application/json; charset=utf-8" }, json };
    await expect(readPayslipDeliveryResponse(response)).resolves.toEqual({ code: "PAYSLIP_DELIVERY_STARTED" });
  });

  it("converts an HTML proxy error into a readable message", async () => {
    const response = { ok: false, status: 504, headers: { get: () => "text/html" } };
    await expect(readPayslipDeliveryResponse(response)).resolves.toEqual({
      message: "The server returned an unexpected 504 response. Please retry."
    });
  });

  it("normalizes invalid start times and recognizes only a completed current attempt", () => {
    expect(getPayslipDeliveryStartedAt("invalid", 1234)).toBe(1234);
    const startedAt = Date.parse("2026-07-27T06:00:00.000Z");
    expect(isPayslipDeliveryAttemptComplete({ run: { payslipDelivery: { attemptedAt: "2026-07-27T05:59:59.000Z" } } }, startedAt)).toBe(false);
    expect(isPayslipDeliveryAttemptComplete({ run: { payslipDelivery: { attemptedAt: "2026-07-27T06:00:01.000Z" } } }, startedAt)).toBe(true);
    expect(isPayslipDeliveryAttemptComplete({ run: { payslipsSentAt: "2026-07-27T06:00:02.000Z" } }, startedAt)).toBe(true);
  });

  it("returns the persisted failed-recipient count", () => {
    expect(getPayslipDeliveryFailureCount({ workflow: { payslipProgress: { failed: 1 } } })).toBe(1);
    expect(getPayslipDeliveryFailureCount({})).toBe(0);
  });
});
