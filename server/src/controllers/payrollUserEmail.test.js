const mockGetUserSetupContext = jest.fn();
const mockLogUserSetupEmailAudit = jest.fn();
const mockSendAccountSetupEmail = jest.fn();

jest.mock("../models/payrollUserModel", () => ({
  ROLE_NAMES: ["Admin", "Finance", "HR", "Staff"],
  createHireWithAccount: jest.fn(),
  getActivationSetupContext: jest.fn(),
  getUserSetupContext: mockGetUserSetupContext,
  listManagedUsers: jest.fn(),
  logSetupEmailAudit: jest.fn(),
  logUserSetupEmailAudit: mockLogUserSetupEmailAudit,
  reviewActivationRequest: jest.fn(),
  saveSetupEmailResult: jest.fn(),
  updatePendingRequest: jest.fn()
}));
jest.mock("../services/payrollNotificationService", () => ({ notifyRoles: jest.fn(), notifyUser: jest.fn() }));
jest.mock("../services/emailService", () => ({ sendAccountSetupEmail: mockSendAccountSetupEmail }));

const { resendUserSetupEmail } = require("./payrollUserController");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = "email-test-secret";
  process.env.CLIENT_URL = "https://paynivo.example";
  mockGetUserSetupContext.mockResolvedValue({
    request_id: null,
    status: "approved",
    user_id: 42,
    name: "Standalone User",
    account_email: "standalone@example.com",
    staff_email: null,
    account_status: 1,
    must_change_password: 1
  });
  mockSendAccountSetupEmail.mockResolvedValue({ messageId: "setup-1" });
});

test("resends setup to an active account without an activation request", async () => {
  const res = response();
  await resendUserSetupEmail({ params: { userId: "42" } }, res);

  expect(res.statusCode).toBe(200);
  expect(res.body.setupEmail).toMatchObject({ status: "Sent", recipient: "standalone@example.com" });
  expect(mockSendAccountSetupEmail).toHaveBeenCalledWith(expect.objectContaining({
    to: "standalone@example.com",
    setupUrl: expect.stringContaining("https://paynivo.example/login?setup_token=")
  }));
  expect(mockLogUserSetupEmailAudit).toHaveBeenCalledWith(42, expect.objectContaining({ status: "Sent" }));
});

test("returns the SMTP delivery error instead of activation-request not found", async () => {
  mockSendAccountSetupEmail.mockRejectedValue(Object.assign(new Error("Email delivery is not configured."), { code: "SMTP_NOT_CONFIGURED" }));
  const res = response();
  await resendUserSetupEmail({ params: { userId: "42" } }, res);

  expect(res.statusCode).toBe(422);
  expect(res.body.message).toBe("Email delivery is not configured.");
  expect(res.body.setupEmail.status).toBe("Failed");
});
