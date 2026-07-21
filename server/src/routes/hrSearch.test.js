jest.mock("../config/db", () => ({
  pool: {
    query: jest.fn(),
    execute: jest.fn()
  }
}));
jest.mock("../middleware/authMiddleware", () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { role: "HR", userId: 1 };
    next();
  }
}));
jest.mock("../middleware/rolesMiddleware", () => ({
  allowRoles: () => (_req, _res, next) => next()
}));

const express = require("express");
const request = require("supertest");
const { pool } = require("../config/db");
const hrRoutes = require("./hrRoutes");

const app = express();
app.use("/api/hr", hrRoutes);

describe("GET /api/hr/search", () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test("returns case-insensitive staff matches from the database", async () => {
    pool.query.mockResolvedValueOnce([[
      { employee_id: "STF-12", name: "Aisha Tan", email: "aisha@example.com", status: "Active" },
      { employee_id: "STF-13", name: "Benjamin Lee", email: "ben@example.com", status: "Active" }
    ]]);

    const response = await request(app).get("/api/hr/search").query({ q: "AISHA" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ employee_id: "STF-12", name: "Aisha Tan" });
  });

  test("returns no results without querying the database for a blank term", async () => {
    const response = await request(app).get("/api/hr/search").query({ q: "   " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
