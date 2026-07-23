import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apiClient.js", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./apiClient.js";
import { getAdminPayrollInsights, getEffectivePayrollRules } from "./adminPayrollService.js";

describe("Admin payroll insights service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends dataset-aware date and granularity filters", () => {
    getAdminPayrollInsights({
      dataset: "audit_activity",
      from: "2026-07-01",
      to: "2026-07-24",
      granularity: "day"
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/api/payroll/admin/dashboard/insights?dataset=audit_activity&from=2026-07-01&to=2026-07-24&granularity=day"
    );
  });

  it("omits unused snapshot filters", () => {
    getAdminPayrollInsights({ dataset: "account_status", role: "HR", from: "", accountStatus: undefined });

    expect(apiRequest).toHaveBeenCalledWith(
      "/api/payroll/admin/dashboard/insights?dataset=account_status&role=HR"
    );
  });

  it("loads the Admin effective-rule catalogue", () => {
    getEffectivePayrollRules();
    expect(apiRequest).toHaveBeenCalledWith("/api/payroll/admin/effective-rules");
  });
});
