jest.mock("../config/db", () => ({
  pool: { execute: jest.fn() }
}));

const { pool } = require("../config/db");
const {
  getInvoiceUploadHistory,
  getInvoiceValidationSummary,
  mapUpload
} = require("./invoiceValidationSummaryModel");

describe("invoice validation summary metrics", () => {
  beforeEach(() => pool.execute.mockReset());

  test("maps partial_success separately from successful and failed", () => {
    expect(mapUpload({ audit_log_id: 9, affected_record: "UPL-9", status: "Warning" })).toMatchObject({
      uploadId: 9,
      uploadBatchId: "UPL-9",
      status: "Partial Success"
    });
    expect(mapUpload({
      audit_log_id: 10,
      status: "Success",
      upload_valid_rows: 90,
      upload_invalid_rows: 10,
      upload_created_invoices: 90
    }).status).toBe("Partial Success");
  });

  test("returns all-time batch counts and only the five recent records", async () => {
    pool.execute
      .mockResolvedValueOnce([[{ totalUploads: 12, successfulUploads: 7, failedUploads: 3 }]])
      .mockResolvedValueOnce([[1, 2, 3, 4, 5].map((id) => ({ audit_log_id: id, status: "pending" }))])
      .mockResolvedValueOnce([[]]);

    const result = await getInvoiceValidationSummary();

    expect(result.summary).toEqual({ totalUploads: 12, successfulUploads: 7, failedUploads: 3 });
    expect(result.recentUploads).toHaveLength(5);
    expect(result).not.toHaveProperty("uploadHistory");
    expect(pool.execute.mock.calls[1][0]).toContain("ORDER BY created_at DESC, audit_log_id DESC LIMIT 5");
  });

  test("applies status filtering, sorting, and pagination to full history", async () => {
    pool.execute
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ audit_log_id: 8, status: "Failed" }]])
      .mockResolvedValueOnce([[{ user_name: "admin@example.com" }]]);

    const result = await getInvoiceUploadHistory({ status: "Failed", sort: "invalid-desc", page: "2" });
    const historyCall = pool.execute.mock.calls[1];

    expect(historyCall[0]).toContain("status = ?");
    expect(historyCall[0]).toContain("upload_invalid_rows DESC");
    expect(historyCall[0]).toContain("LIMIT 20 OFFSET 20");
    expect(historyCall[1]).toEqual(["Failed"]);
    expect(result.uploads[0].status).toBe("Failed");
  });
});
