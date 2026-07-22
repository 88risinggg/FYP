jest.mock("../config/db", () => ({
  pool: { execute: jest.fn() }
}));

const { pool } = require("../config/db");
const { listUsers } = require("./adminUserModel");

describe("admin user search", () => {
  beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
  });

  test("matches a term against both name and email", async () => {
    await listUsers({ search: "aisha", roleId: "", status: "" });

    const [sql, params] = pool.execute.mock.calls[0];
    expect(sql).toContain("LOWER(user.name) LIKE LOWER(?) OR LOWER(user.email) LIKE LOWER(?)");
    expect(params).toEqual(["%aisha%", "%aisha%"]);
  });
});
