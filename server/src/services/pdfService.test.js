jest.mock("../config/db", () => ({
  pool: { query: jest.fn(), execute: jest.fn() }
}));

jest.mock("../models/invoiceSettingsModel", () => ({
  defaultSettings: {
    defaultCurrency: "SGD",
    companyName: "",
    paymentTerms: "Net 30",
    dueDays: 30
  },
  getInvoiceSettings: jest.fn()
}));

jest.mock("./qrCodeService", () => ({ generateQRCode: jest.fn() }));
jest.mock("puppeteer-core", () => ({ launch: jest.fn() }));

const { buildInvoiceHtml, escapeHtml } = require("./pdfService");

const invoice = {
  invoiceId: "TAX-2026-0001",
  status: "Draft",
  issue_date: "2026-07-20",
  due_date: "2026-08-19",
  total_amount: 125,
  amount_paid: 25,
  customer_name: "Customer <One>",
  items: [{ description: "Consulting & support", quantity: 1, unit_price: 125, amount: 125 }]
};

const settings = {
  companyName: "Example & Co",
  companyRegistrationNumber: "REG-123",
  companyAddress: "1 Example Street",
  registeredOfficeAddress: "2 Registered Street",
  financeEmail: "finance@example.com",
  defaultCurrency: "SGD",
  paymentTerms: "Net 30",
  dueDays: 30,
  bankAccountHolderName: "Example Co",
  bankName: "Example Bank",
  bankAccountNumber: "123456",
  bicSwift: "EXAMSGSG",
  paynowIdentifier: "UEN123",
  paymentReferenceInstruction: "Use invoice number",
  payoutStatement: "Payout within 10 days",
  computerGeneratedStatement: "No signature required"
};

test("fixed invoice template is A4 and contains approved sections", () => {
  const html = buildInvoiceHtml(invoice, settings);
  expect(html).toContain("@page { size: A4 portrait;");
  expect(html).toContain("INVOICE");
  expect(html).toContain("Less Amount Paid");
  expect(html).toContain("Amount Due SGD");
  expect(html).toContain("Registered Office:");
  expect(html).toContain("TAX-2026-0001");
  expect(html).toContain('<section class="summary">');
  expect(html).toContain('<div class="due-panel">');
  expect(html).not.toContain("approved new invoice.png");
});

test("dynamic invoice values are HTML escaped", () => {
  const html = buildInvoiceHtml(invoice, settings);
  expect(html).toContain("Customer &lt;One&gt;");
  expect(html).toContain("Example &amp; Co");
  expect(html).toContain("Consulting &amp; support");
  expect(html).not.toContain("undefined");
  expect(html).not.toContain("null");
  expect(escapeHtml('<script>alert("x")</script>')).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});
