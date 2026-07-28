const mockSendMail = jest.fn();
const mockVerify = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail, verify: mockVerify }));

jest.mock("nodemailer", () => ({ createTransport: mockCreateTransport }));

const { createEmailTransport, publicClientUrl, sendEmail, verifyEmailTransport } = require("./emailTransportService");

const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

beforeEach(() => {
  jest.clearAllMocks();
  smtpKeys.forEach((key) => delete process.env[key]);
  mockSendMail.mockResolvedValue({ messageId: "mail-1", accepted: ["recipient@example.com"] });
  mockVerify.mockResolvedValue(true);
});

afterAll(() => smtpKeys.forEach((key) => delete process.env[key]));

function configureSmtp(port = "587") {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = port;
  process.env.SMTP_USER = "mailer@example.com";
  process.env.SMTP_PASS = "secret";
  process.env.SMTP_FROM = "noreply@example.com";
}

test("reports exactly which live SMTP settings are missing", () => {
  expect(() => createEmailTransport()).toThrow(/SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM/);
  try { createEmailTransport(); } catch (error) { expect(error.code).toBe("SMTP_NOT_CONFIGURED"); }
});

test("uses TLS mode for port 465 and verifies the configured transport", async () => {
  configureSmtp("465");
  await verifyEmailTransport();
  expect(mockCreateTransport).toHaveBeenCalledWith(expect.objectContaining({
    host: "smtp.example.com", port: 465, secure: true,
    auth: { user: "mailer@example.com", pass: "secret" }
  }));
  expect(mockVerify).toHaveBeenCalledTimes(1);
});

test("all shared messages use the configured sender and validate recipients", async () => {
  configureSmtp();
  await sendEmail({ to: "recipient@example.com", subject: "Test", text: "Hello" });
  expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
    from: "noreply@example.com", to: "recipient@example.com", subject: "Test"
  }));
  await expect(sendEmail({ to: "not-an-email", subject: "Test" })).rejects.toMatchObject({ code: "EMAIL_RECIPIENT_INVALID" });
});

test("uses the deployed app URL for links when CLIENT_URL is unavailable", () => {
  delete process.env.CLIENT_URL;
  process.env.APP_BASE_URL = "https://paynivo-fyp.discloud.app/";
  expect(publicClientUrl()).toBe("https://paynivo-fyp.discloud.app");
  delete process.env.APP_BASE_URL;
});
