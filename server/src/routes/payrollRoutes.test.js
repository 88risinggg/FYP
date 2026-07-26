jest.mock("../config/db", () => ({
  pool: {
    query: jest.fn(),
    execute: jest.fn()
  }
}));
jest.mock("../middleware/authMiddleware", () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { userId: 1, email: "hr@example.com", role: "HR" };
    next();
  }
}));
jest.mock("../middleware/rolesMiddleware", () => ({
  allowRoles: () => (_req, _res, next) => next()
}));
jest.mock("../services/audit", () => ({
  addAudit: jest.fn()
}));
jest.mock("../services/payrollNotificationService", () => ({
  notifyRoles: jest.fn()
}));
jest.mock("../models/auditLogModel", () => ({
  logAuditEvent: jest.fn(),
  getClientIp: jest.fn(() => "127.0.0.1"),
  getDeviceInfo: jest.fn(() => ({ browser: "Test" }))
}));

const express = require("express");
const request = require("supertest");
const { pool } = require("../config/db");
const { notifyRoles } = require("../services/payrollNotificationService");
const payrollRoutes = require("./payrollRoutes");

const app = express();
app.use(express.json());
app.use("/api/payroll", payrollRoutes);

describe("payroll payslip routes", () => {
  beforeEach(() => {
    pool.query.mockReset();
    notifyRoles.mockReset();
  });

  test("HR can send a draft payslip to Finance through the registered endpoint", async () => {
    pool.query
      .mockResolvedValueOnce([[{
        payroll_id: 9,
        payslip_id: 9,
        payslip_status: "Draft",
        status: "Draft"
      }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app).put("/api/payroll/payslips/9/send-to-finance");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ message: "Payslip sent to Finance" });
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(notifyRoles).toHaveBeenCalledWith(
      "Finance",
      expect.objectContaining({
        type: "payslip_finance_review",
        entityType: "payslip",
        entityId: "9"
      }),
      expect.objectContaining({ excludeUserId: undefined })
    );
  });
});
