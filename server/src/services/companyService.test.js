const { _test } = require("./companyService");
const { pool } = require("../config/db");

afterAll(async () => pool.end());

describe("company onboarding credentials", () => {
  test("generates unique strong temporary passwords", () => {
    const first = _test.generateTemporaryPassword();
    const second = _test.generateTemporaryPassword();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(12);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[0-9]/);
    expect(first).toMatch(/[^A-Za-z0-9]/);
  });
});
