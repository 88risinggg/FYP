import { beforeEach, describe, expect, it } from "vitest";

import { getPostAuthDestination, getStoredSession, saveSession } from "./sessionService.js";

describe("session routing", () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ["HR", "/dashboard/payroll/hr"],
    ["Staff", "/dashboard/payroll/staff"],
    ["Admin", "/module-selection"],
    ["Finance", "/module-selection"]
  ])("routes %s users to the expected destination", (role, destination) => {
    expect(getPostAuthDestination({ role })).toBe(destination);
  });

  it("adds payroll module access to legacy HR sessions", () => {
    saveSession("token", { userId: 4, role: "HR" }, true);
    expect(getStoredSession().user.allowedModules).toEqual(["payroll"]);
  });
});
