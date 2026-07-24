jest.mock("bcrypt", () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(() => "token"), verify: jest.fn() }));
jest.mock("../models/authModel", () => ({
  completeFirstLogin: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  recordFailedLogin: jest.fn(),
  resetFailedLogins: jest.fn()
}));
jest.mock("../services/payrollNotificationService", () => ({ notifyRoles: jest.fn() }));

const bcrypt = require("bcrypt");
const authModel = require("../models/authModel");
const { notifyRoles } = require("../services/payrollNotificationService");
const { login } = require("./authController");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

const activeUser = {
  user_id: 9,
  email: "staff@example.com",
  name: "Staff User",
  password: "hash",
  status: 1,
  role_name: "Staff",
  must_change_password: 0,
  account_locked_at: null
};

beforeEach(() => {
  jest.clearAllMocks();
  authModel.findUserByEmail.mockResolvedValue({ ...activeUser });
  authModel.resetFailedLogins.mockResolvedValue();
  notifyRoles.mockResolvedValue([]);
});

test("wrong passwords stay generic before the fifth failure", async () => {
  bcrypt.compare.mockResolvedValue(false);
  authModel.recordFailedLogin.mockResolvedValue({ attempts: 4, locked: false, newlyLocked: false });
  const res = response();
  await login({ body: { email: activeUser.email, password: "wrong" } }, res);
  expect(res.statusCode).toBe(401);
  expect(res.body).toEqual({ message: "Invalid email or password" });
  expect(notifyRoles).not.toHaveBeenCalled();
});

test("the fifth failure locks and notifies admins once", async () => {
  bcrypt.compare.mockResolvedValue(false);
  authModel.recordFailedLogin.mockResolvedValue({ attempts: 5, locked: true, newlyLocked: true });
  const res = response();
  await login({ body: { email: activeUser.email, password: "wrong" } }, res);
  expect(res.statusCode).toBe(423);
  expect(res.body.code).toBe("ACCOUNT_LOCKED");
  expect(notifyRoles).toHaveBeenCalledTimes(1);
});

test("locked accounts are rejected before password comparison", async () => {
  authModel.findUserByEmail.mockResolvedValue({ ...activeUser, account_locked_at: new Date() });
  const res = response();
  await login({ body: { email: activeUser.email, password: "anything" } }, res);
  expect(res.statusCode).toBe(423);
  expect(bcrypt.compare).not.toHaveBeenCalled();
});

test("successful login resets consecutive failures", async () => {
  bcrypt.compare.mockResolvedValue(true);
  const res = response();
  await login({ body: { email: activeUser.email, password: "correct" } }, res);
  expect(authModel.resetFailedLogins).toHaveBeenCalledWith(activeUser.user_id);
  expect(res.statusCode).toBe(200);
  expect(res.body.token).toBe("token");
});
