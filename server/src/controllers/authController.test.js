jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(() => "signed-jwt") }));
jest.mock("../models/authModel", () => ({
  findUserByEmail: jest.fn(),
  recordFailedLogin: jest.fn(),
  resetFailedLogins: jest.fn()
}));
jest.mock("../services/payrollNotificationService", () => ({ notifyRoles: jest.fn() }));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authModel = require("../models/authModel");
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
  bcrypt.compare.mockResolvedValue(true);
});

test("password login issues the final JWT", async () => {
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
