import { describe, expect, it } from "vitest";

import { resolveSettingsHomePath } from "./SettingsPage.jsx";

describe("Settings page dashboard destination", () => {
  it("returns to the Admin Invoicing dashboard when Settings was opened there", () => {
    expect(resolveSettingsHomePath("/dashboard/invoicing/admin/invoice-settings", { role: "Admin" }))
      .toBe("/dashboard/invoicing/admin");
  });

  it("returns to the Admin Payroll dashboard when Settings was opened there", () => {
    expect(resolveSettingsHomePath("/dashboard/payroll/admin/settings", { role: "Admin" }))
      .toBe("/dashboard/payroll/admin");
  });

  it("uses module selection when no originating module is available", () => {
    expect(resolveSettingsHomePath("", { role: "Admin", allowedModules: ["invoicing", "payroll"] }))
      .toBe("/module-selection");
  });
});
