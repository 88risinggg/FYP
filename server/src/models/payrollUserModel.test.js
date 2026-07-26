jest.mock("../config/db", () => ({
  pool: {
    query: jest.fn()
  }
}));
jest.mock("../services/auditService", () => ({ writeAuditLog: jest.fn() }));

const { pool } = require("../config/db");
const { runWithTenant } = require("../services/tenantContext");
const { listManagedUsers } = require("./payrollUserModel");
const listTenantUsers = () => runWithTenant(2, () => listManagedUsers());

beforeEach(() => jest.clearAllMocks());

test("combines linked accounts and unlinked staff without a UNION", async () => {
  pool.query
    .mockResolvedValueOnce([[{
      user_id: 2, name: "Zara", staff_name: "Zara", activation_status: "Approved",
      failed_login_attempts: 0, account_locked_at: null, account_lock_reason: null
    }]])
    .mockResolvedValueOnce([[{
      employee_id: 9, employee_code: "EMP-009", staff_name: "Aaron",
      staff_email: "aaron@example.com", employment_status: 1
    }]]);

  const users = await listTenantUsers();

  expect(pool.query).toHaveBeenCalledTimes(2);
  expect(pool.query.mock.calls[0][0]).not.toMatch(/UNION/i);
  expect(users.map((user) => user.staff_name)).toEqual(["Aaron", "Zara"]);
  expect(users[0]).toMatchObject({ user_id: null, activation_status: "No Account", employee_id: 9 });
});

test("sorts pending activation requests before names", async () => {
  pool.query
    .mockResolvedValueOnce([[
      { user_id: 1, staff_name: "Aaron", activation_status: "Approved" },
      { user_id: 2, staff_name: "Zara", activation_status: "Pending" }
    ]])
    .mockResolvedValueOnce([[]]);

  const users = await listTenantUsers();
  expect(users.map((user) => user.user_id)).toEqual([2, 1]);
});

test("returns an empty collection when both sources are empty", async () => {
  pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
  await expect(listTenantUsers()).resolves.toEqual([]);
});
