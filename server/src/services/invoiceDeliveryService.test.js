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

const { sendInvoiceEmail } = require("./invoiceDeliveryService");

beforeAll(() => {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_USER = "mailer@example.com";
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
