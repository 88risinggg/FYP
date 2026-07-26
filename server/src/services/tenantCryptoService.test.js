const crypto = require("crypto");
const { _test } = require("./tenantCryptoService");

describe("tenant envelope encryption", () => {
  test("round-trips a payload with authenticated tenant context", () => {
    const key = crypto.randomBytes(32);
    const context = [2, "staff", 51, "sensitive_payload", 1];
    const encrypted = _test.seal({ salary: 4200, bank: "DBS" }, key, context);
    expect(encrypted).not.toContain("DBS");
    expect(_test.open(encrypted, key, context)).toEqual({ salary: 4200, bank: "DBS" });
  });

  test("rejects ciphertext moved to another tenant", () => {
    const key = crypto.randomBytes(32);
    const encrypted = _test.seal({ salary: 4200 }, key, [1, "staff", 1, "sensitive_payload", 1]);
    expect(() => _test.open(encrypted, key, [2, "staff", 1, "sensitive_payload", 1])).toThrow();
  });
});
