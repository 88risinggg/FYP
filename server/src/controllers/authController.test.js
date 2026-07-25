jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(() => "signed-jwt") }));
jest.mock("../models/authModel", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  recordFailedLogin: jest.fn(),
  resetFailedLogins: jest.fn()
}));
jest.mock("../services/authChallengeService", () => ({
  createChallenge: jest.fn(),
  resendChallenge: jest.fn(),
  verifyChallenge: jest.fn()
}));
jest.mock("../services/emailService", () => ({ sendAuthOtpEmail: jest.fn() }));
jest.mock("../services/payrollNotificationService", () => ({ notifyRoles: jest.fn() }));
jest.mock("../services/auditService", () => ({
  MODULE: { AUTH: "Auth" },
  writeAuditLog: jest.fn()
}));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");
const challengeService = require("../services/authChallengeService");
const { sendAuthOtpEmail } = require("../services/emailService");
const controller = require("./authController");

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

const activeUser = {
  user_id: 7,
  email: "finance@example.com",
  name: "Finance User",
  password: "password-hash",
  status: 1,
  role_name: "Finance",
  company_id: 3
};

beforeEach(() => {
  jest.clearAllMocks();
  authModel.findUserByEmail.mockResolvedValue(activeUser);
  authModel.recordFailedLogin.mockResolvedValue({ newlyLocked: false });
  authModel.resetFailedLogins.mockResolvedValue();
  challengeService.createChallenge.mockResolvedValue({
    challengeId: "login-challenge",
    otp: "123456",
    expiresAt: new Date("2026-07-25T10:00:00Z")
  });
  sendAuthOtpEmail.mockResolvedValue();
  bcrypt.compare.mockResolvedValue(true);
});

test("password login issues a JWT without requiring OTP", async () => {
  const req = { body: { email: activeUser.email, password: "Password@123" } };
  const res = response();

  await controller.login(req, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    token: "signed-jwt",
    user: expect.objectContaining({
      email: activeUser.email,
      role: "Finance",
      companyId: 3
    })
  }));
  expect(res.status).not.toHaveBeenCalled();
  expect(challengeService.createChallenge).not.toHaveBeenCalled();
  expect(sendAuthOtpEmail).not.toHaveBeenCalled();
  expect(jwt.sign).toHaveBeenCalledTimes(1);
});

test("invalid password does not issue a JWT", async () => {
  bcrypt.compare.mockResolvedValue(false);
  const req = { body: { email: activeUser.email, password: "wrong-password" } };
  const res = response();

  await controller.login(req, res);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(jwt.sign).not.toHaveBeenCalled();
});

test("OTP verification issues the final JWT", async () => {
  challengeService.verifyChallenge.mockResolvedValue({
    challenge: { userId: activeUser.user_id }
  });
  authModel.findUserById.mockResolvedValue(activeUser);
  const req = { body: { challengeId: "login-challenge", otp: "123456" } };
  const res = response();

  await controller.verifyLoginOtp(req, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    token: "signed-jwt",
    user: expect.objectContaining({
      email: activeUser.email,
      role: "Finance",
      companyId: 3
    })
  }));
  expect(jwt.sign).toHaveBeenCalledTimes(1);
});
