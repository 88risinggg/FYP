import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apiClient.js", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./apiClient.js";
import { resendAccountSetup } from "./payrollUserService.js";

describe("payroll account setup email service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the stable user endpoint even when the record contains a stale activation request ID", () => {
    resendAccountSetup({ userId: 42, requestId: 999 });

    expect(apiRequest).toHaveBeenCalledWith(
      "/api/payroll/users/42/resend-setup",
      { method: "POST" }
    );
  });
});
