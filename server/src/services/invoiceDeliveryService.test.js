const mockSendMail = jest.fn().mockResolvedValue({ messageId: "message-1" });

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}));

jest.mock("../models/invoiceSettingsModel", () => ({
  defaultSettings: {
    defaultCurrency: "SGD",
    emailSubjectTemplate: "Invoice {{invoice_number}} from {{company_name}}",
    emailBodyTemplate: "Dear {{customer_name}}",
    attachPdfInvoice: true
  },
  getInvoiceSettings: jest.fn().mockResolvedValue({
    companyName: "Example Co",
    senderName: "Example Finance",
    replyToEmail: "finance@example.com",
    supportEmail: "support@example.com",
    defaultCurrency: "SGD",
    emailSubjectTemplate: "Invoice {{invoice_number}} from {{company_name}}",
    emailBodyTemplate: "Dear {{customer_name}}",
    attachPdfInvoice: true
  })
}));

jest.mock("./pdfService", () => ({
  escapeHtml: (value) => String(value ?? ""),
  generateInvoicePDF: jest.fn().mockResolvedValue(Buffer.from("%PDF-test")),
  hydrateInvoice: jest.fn(async (invoice) => invoice)
}));

const invoiceSettingsModel = require("../models/invoiceSettingsModel");
const {
  formatEmailDate,
  sendInvoiceEmail,
  sendInvoiceSettingsTestEmail
} = require("./invoiceDeliveryService");

beforeAll(() => {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASS = "secret";
});

beforeEach(() => {
  mockSendMail.mockClear();
});

test("invoice email uses saved settings and attaches the generated PDF", async () => {
  await sendInvoiceEmail({
    invoiceId: "TAX-2026-0001",
    customer_name: "Customer",
    customer_email: "customer@example.com",
    total_amount: 100,
    due_date: "2026-08-19",
    items: []
  });

  expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
    replyTo: "finance@example.com",
    subject: "Invoice TAX-2026-0001 from Example Co",
    attachments: [expect.objectContaining({
      filename: "TAX-2026-0001.pdf",
      contentType: "application/pdf"
    })]
  }));
});

test("test email uses the current Admin template and company scope", async () => {
  await sendInvoiceSettingsTestEmail("admin@example.com", {
    companyId: 42,
    settings: {
      senderName: "Current Admin Template",
      replyToEmail: "reply@example.com",
      supportEmail: "support@example.com",
      emailSubjectTemplate: "Preview {{invoice_number}} for {{customer_name}}",
      emailBodyTemplate: "Due: {{due_date}}",
      attachPdfInvoice: false
    }
  });

  expect(invoiceSettingsModel.getInvoiceSettings).toHaveBeenCalledWith(42);
  expect(mockSendMail).toHaveBeenLastCalledWith(expect.objectContaining({
    to: "admin@example.com",
    subject: "Preview TEST-INVOICE for Test Recipient",
    attachments: []
  }));
});

test("invoice email blocks a malformed saved placeholder before delivery", async () => {
  await expect(sendInvoiceEmail({
    invoiceId: "TAX-2026-0002",
    customer_name: "Customer",
    customer_email: "customer@example.com",
    total_amount: 100,
    due_date: "2026-08-19",
    items: []
  }, {
    settingsOverride: {
      emailSubjectTemplate: "Invoice {{invoice_number}}",
      emailBodyTemplate: "Due on {due_date}}",
      attachPdfInvoice: false
    }
  })).rejects.toMatchObject({
    code: "INVALID_INVOICE_EMAIL_TEMPLATE",
    statusCode: 400
  });

  expect(mockSendMail).not.toHaveBeenCalled();
});

test("invoice email formats the due date for customers", async () => {
  expect(formatEmailDate("2026-08-19")).toBe("19 Aug 2026");
});
