jest.mock("../config/db", () => ({
  pool: { query: jest.fn(), execute: jest.fn() }
}));

const { buildInvoiceNumber, calculateDueDate } = require("./invoiceSettingsModel");

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
