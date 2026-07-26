jest.mock("../controllers/leaveController", () => ({
  applyLeave: jest.fn((_req, res) => res.status(201).json({ ok: true })),
  getMyApplications: jest.fn((_req, res) => res.json([])),
  getMyBalance: jest.fn((_req, res) => res.json([])),
  cancelLeave: jest.fn((_req, res) => res.json({ ok: true })),
  getPendingApplications: jest.fn((_req, res) => res.json([{ id: 1 }])),
  getAllApplications: jest.fn((_req, res) => res.json({ applications: [{ id: 2 }], total: 1, page: 1, pageSize: 50 })),
  updateLeaveStatus: jest.fn((_req, res) => res.json({ ok: true })),
  getAllBalances: jest.fn((_req, res) => res.json([])),
  getLeaveTypes: jest.fn((_req, res) => res.json([])),
  updateLeaveType: jest.fn((_req, res) => res.json({ ok: true })),
  runCarryForward: jest.fn((_req, res) => res.json({ processed: 3 }))
}));
jest.mock("../middleware/authMiddleware", () => ({
  authenticateToken: (_req, _res, next) => {
    next();
  }
}));
jest.mock("../middleware/rolesMiddleware", () => ({
  allowRoles: () => (_req, _res, next) => next()
}));

const express = require("express");
const request = require("supertest");
const leaveRoutes = require("./leaveRoutes");

const app = express();
app.use(express.json());
app.use("/api/leave", leaveRoutes);

describe("leave routes wiring", () => {
  test("exposes the paged all-applications endpoint", async () => {
    const response = await request(app).get("/api/leave/applications/all").query({ page: 2, pageSize: 50 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      applications: [{ id: 2 }],
      total: 1,
      page: 1,
      pageSize: 50
    });
  });
});
