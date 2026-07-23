jest.mock("../config/db", () => ({ pool: { query: jest.fn() } }));

const { inferModule, writeAuditLog } = require("./auditService");

describe("central audit service", () => {
  test.each([
    ["Payroll Configuration", "Payroll"],
    ["User Management", "Settings"],
    ["Login", "Auth"],
    ["Invoice Payment", "Invoice"]
  ])("infers %s events as %s", (activityType, module) => {
    expect(inferModule(activityType)).toBe(module);
  });

  test("writes technical context through a transaction connection", async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ insertId: 1 }]) };
    await writeAuditLog({
      connection,
      module: "Payroll",
      activityType: "Payroll Configuration",
      action: "Updated CPF ceiling",
      entityType: "payroll_setting",
      entityId: "cpf_monthly_wage_ceiling",
      userId: 7,
      userName: "Admin User",
      status: "Success",
      ipAddress: "127.0.0.1",
      deviceInfo: "test-agent",
      previousValue: "7000",
      newValue: "8000"
    });

    const [, values] = connection.query.mock.calls[0];
    expect(values).toEqual([7, "Admin User", "Payroll", "Payroll Configuration", "Updated CPF ceiling",
      "cpf_monthly_wage_ceiling", "Success", "7000", "8000", "127.0.0.1", "test-agent", "payroll_setting"]);
  });
});
