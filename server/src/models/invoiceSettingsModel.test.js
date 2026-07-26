jest.mock("../config/db", () => ({
  pool: { query: jest.fn(), execute: jest.fn() }
}));

const { pool } = require("../config/db");
const {
  buildInvoiceNumber,
  calculateDueDate,
  listNumberingActivityPage,
  optionLists,
  resolveInvoiceSequence
} = require("./invoiceSettingsModel");

test("invoice settings offer English as the only language", () => {
  expect(optionLists.languages).toEqual([{ value: "en", label: "English" }]);
});

test("saved prefix and sequence produce a four-digit invoice number", () => {
  expect(buildInvoiceNumber({
    invoicePrefix: "TAX",
    invoiceYear: "2026",
    invoiceFormat: "{PREFIX}-{YYYY}-{NNNN}"
  }, new Date("2026-07-20"), 12)).toBe("TAX-2026-0012");
});

test("due date follows the configured due days", () => {
  expect(calculateDueDate({ dueDays: 30 }, new Date("2026-07-20T00:00:00Z"))).toBe("2026-08-19");
});

test("yearly reset starts the first sequence of a new year at one", () => {
  const settings = {
    invoicePrefix: "INV",
    invoiceYear: "2026",
    lastSequenceYear: "2026",
    invoiceFormat: "{PREFIX}-{YYYY}-{NNNN}",
    nextInvoiceNumber: 87,
    sequenceRules: { yearlyReset: true }
  };
  const resolved = resolveInvoiceSequence(settings, new Date("2027-01-01T00:00:00Z"));

  expect(resolved.didReset).toBe(true);
  expect(resolved.startNumber).toBe(1);
  expect(buildInvoiceNumber(resolved.effectiveSettings, new Date("2027-01-01T00:00:00Z"), 1))
    .toBe("INV-2027-0001");
});

test("yearly reset keeps advancing within the same year", () => {
  const resolved = resolveInvoiceSequence({
    invoiceYear: "2027",
    lastSequenceYear: "2027",
    nextInvoiceNumber: 42,
    sequenceRules: { yearlyReset: true }
  }, new Date("2027-08-01T00:00:00Z"));

  expect(resolved.didReset).toBe(false);
  expect(resolved.startNumber).toBe(42);
});

test("a backdated invoice never moves the tracked sequence year backwards", () => {
  const resolved = resolveInvoiceSequence({
    invoiceYear: "2027",
    lastSequenceYear: "2027",
    nextInvoiceNumber: 42,
    sequenceRules: { yearlyReset: true }
  }, new Date("2026-12-20T00:00:00Z"));

  expect(resolved.didReset).toBe(false);
  expect(resolved.nextTrackedYear).toBe("2027");
});

test("numbering history returns a company-scoped paginated newest-first page", async () => {
  pool.execute
    .mockResolvedValueOnce([[{ total: 23 }], []])
    .mockResolvedValueOnce([[
      {
        id: 23,
        action: "Updated Next Invoice Number",
        oldValue: "22",
        newValue: "23",
        changedBy: "admin@example.com",
        createdAt: "2026-07-26T12:00:00.000Z"
      }
    ], []]);

  const result = await listNumberingActivityPage({ page: 2, pageSize: 5 }, 7);

  expect(result.records).toHaveLength(1);
  expect(result.pagination).toEqual({
    page: 2,
    pageSize: 5,
    total: 23,
    totalPages: 5
  });
  expect(pool.execute.mock.calls[0][0]).toContain("company_id = ?");
  expect(pool.execute.mock.calls[1][0]).toContain("ORDER BY created_at DESC, audit_log_id DESC");
  expect(pool.execute.mock.calls[1][0]).toContain("LIMIT 5 OFFSET 5");
  expect(pool.execute.mock.calls[1][1]).toEqual([7]);
});
