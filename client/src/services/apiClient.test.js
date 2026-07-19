import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./apiClient.js";
import { getStoredSession, saveSession } from "./sessionService.js";

describe("apiRequest session handling", () => {
  beforeEach(() => {
    localStorage.clear();
    saveSession("valid-token", { role: "Finance" }, false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
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
});
