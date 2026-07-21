jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("../models/settingsModel", () => ({
  getUserPassword: jest.fn(),
  createAccountActionRequest: jest.fn(),
  notifyAdminsOfDeletionRequest: jest.fn(),
  createSettingsAuditLog: jest.fn(),
  listDeletionRequests: jest.fn(),
  reviewDeletionRequest: jest.fn()
}));

const bcrypt = require("bcrypt");
const settingsModel = require("../models/settingsModel");
const controller = require("./settingsController");

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  settingsModel.createSettingsAuditLog.mockResolvedValue();
  settingsModel.notifyAdminsOfDeletionRequest.mockResolvedValue(2);
});

test("account deletion creates an admin approval request instead of deleting immediately", async () => {
  settingsModel.getUserPassword.mockResolvedValue({ password: "hash" });
  bcrypt.compare.mockResolvedValue(true);
  settingsModel.createAccountActionRequest.mockResolvedValue({ request_id: 12, status: "pending", alreadyPending: false });
  const req = { user: { userId: 7 }, body: { password: "secret" }, ip: "127.0.0.1" };
  const res = response();

  await controller.deleteAccount(req, res);

  expect(settingsModel.createAccountActionRequest).toHaveBeenCalledWith(7, "account_deletion");
  expect(settingsModel.notifyAdminsOfDeletionRequest).toHaveBeenCalledWith(expect.objectContaining({ request_id: 12 }));
  expect(res.status).toHaveBeenCalledWith(202);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining("admin approval"),
    request: expect.objectContaining({ status: "pending" })
  }));
});

test("an administrator cannot approve their own deletion request", async () => {
  settingsModel.listDeletionRequests.mockResolvedValue([{ request_id: 3, user_id: 9, status: "pending" }]);
  const req = { user: { userId: 9 }, params: { id: "3" }, body: { decision: "approved" } };
  const res = response();

  await controller.reviewDeletionRequest(req, res);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(settingsModel.reviewDeletionRequest).not.toHaveBeenCalled();
});

test("an admin approval invokes the guarded deletion workflow", async () => {
  settingsModel.listDeletionRequests.mockResolvedValue([{ request_id: 3, user_id: 8, status: "pending" }]);
  settingsModel.reviewDeletionRequest.mockResolvedValue({ request_id: 3, user_id: 8, status: "approved" });
  const req = { user: { userId: 9 }, params: { id: "3" }, body: { decision: "approved" }, ip: "127.0.0.1" };
  const res = response();

  await controller.reviewDeletionRequest(req, res);

  expect(settingsModel.reviewDeletionRequest).toHaveBeenCalledWith(3, 9, "approved", "");
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Deletion request approved" }));
});
