import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./apiClient.js";
import { getStoredSession, saveSession } from "./sessionService.js";

describe("apiRequest session handling", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saveSession("valid-token", { role: "Finance" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("preserves the session for an ordinary permission denial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ code: "ACCESS_DENIED", message: "Forbidden" })
    }));

    await expect(apiRequest("/api/restricted")).rejects.toThrow("Forbidden");
    expect(getStoredSession()?.token).toBe("valid-token");
  });

  it("preserves the session during a temporary network outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiRequest("/api/payroll")).rejects.toThrow("Server is unavailable");
    expect(getStoredSession()?.token).toBe("valid-token");
  });

  it("turns a proxy HTML timeout into an actionable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      headers: { get: () => "text/html" }
    }));

    await expect(apiRequest("/api/payroll/finance/runs/7_2026/workflow/submit-payment"))
      .rejects.toThrow("The server returned an unexpected 504 response. Please retry.");
    expect(getStoredSession()?.token).toBe("valid-token");
  });
});
