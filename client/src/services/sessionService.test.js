import { beforeEach, describe, expect, it } from "vitest";

import { getPostAuthDestination, getStoredSession, saveSession } from "./sessionService.js";

describe("session routing", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each([
    ["HR", "/module-selection"],
    ["Staff", "/dashboard/payroll/staff"],
    ["Admin", "/module-selection"],
    ["Finance", "/module-selection"]
  ])("routes %s users to the expected destination", (role, destination) => {
    expect(getPostAuthDestination({ role })).toBe(destination);
  });

  it("adds payroll module access to legacy HR sessions", () => {
    saveSession("token", { userId: 4, role: "HR" });
    expect(getStoredSession().user.allowedModules).toEqual(["payroll"]);
  });

  it("stores authentication only for the current tab", () => {
    saveSession("tab-token", { userId: 7, role: "Admin" });

    expect(sessionStorage.getItem("authToken")).toBe("tab-token");
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(localStorage.getItem("authUser")).toBeNull();
  });
});
