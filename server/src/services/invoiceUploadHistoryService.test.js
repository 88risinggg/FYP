jest.mock("../config/db", () => ({
  pool: { execute: jest.fn() }
}));

const { pool } = require("../config/db");
const { recordValidationAttempt, updateUploadOutcome } = require("./invoiceUploadHistoryService");

describe("invoice upload audit lifecycle", () => {
  beforeEach(() => pool.execute.mockReset());

  test("reuses a very recent identical validation request", async () => {
    pool.execute.mockResolvedValueOnce([[{ audit_log_id: 42 }]]);

    const uploadId = await recordValidationAttempt({
      file: { name: "invoice.xlsx", type: "application/vnd.ms-excel" },
      validation: { rows: [], validCount: 0, invalidCount: 0, message: "Empty" },
      user: { userId: 3, email: "admin@example.com" }
    });

    expect(uploadId).toBe(42);
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute.mock.calls[0][0]).toContain("INTERVAL 10 SECOND");
  });

  test("creates a stable unique batch id for a new validation", async () => {
    pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 55 }]);

    const uploadId = await recordValidationAttempt({
      file: { name: "invoice.xlsx" },
      validation: { rows: [{ row_number: 1, errors: [] }], validCount: 1, invalidCount: 0 },
      user: { userId: 3, email: "admin@example.com" }
    });

    expect(uploadId).toBe(55);
    expect(pool.execute.mock.calls[1][1][1]).toMatch(/^UPL-/);
  });

  test("promotes a successful outcome with invalid rows to partial_success", async () => {
    const connection = { execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    await updateUploadOutcome(connection, {
      uploadId: 6,
      status: "Successful",
      createdInvoices: 4
    });

    const [sql, params] = connection.execute.mock.calls[0];
    expect(sql).toContain("'Warning'");
    expect(sql).toContain("upload_invalid_rows");
    expect(params).toEqual(["Success", 4, 4, "Success", 4, null, "Success", 4, 4, "Successful", 6]);
  });
});
