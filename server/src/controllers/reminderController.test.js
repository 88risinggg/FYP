jest.mock("../models/reminderModel", () => ({
  createReminderSetting: jest.fn(),
  findReminderSettingById: jest.fn(),
  getReminderSummary: jest.fn(),
  listReminderLogs: jest.fn(),
  listReminderSettings: jest.fn(),
  updateReminderSetting: jest.fn(),
  updateReminderStatus: jest.fn()
}));
jest.mock("../models/auditLogModel", () => ({
  getClientIp: jest.fn(() => "127.0.0.1"),
  logAuditEvent: jest.fn()
}));
jest.mock("../services/emailService", () => ({
  sendTestReminderEmail: jest.fn()
}));
jest.mock("../services/invoiceNotificationService", () => ({
  createNotification: jest.fn()
}));
jest.mock("../utils/companyScope", () => ({
  requireCompanyId: jest.fn(() => 1)
}));

const {
  findReminderSettingById,
  updateReminderSetting
} = require("../models/reminderModel");
const { logAuditEvent } = require("../models/auditLogModel");
const { putReminderSetting } = require("./reminderController");

test("saving reminder settings records an Invoice audit event", async () => {
  findReminderSettingById.mockResolvedValue({ id: 1 });
  updateReminderSetting.mockResolvedValue({
    id: 1,
    ruleName: "Invoice reminder policy",
    firstReminderDays: 7,
    secondReminderDays: 10,
    finalReminderDays: 31
  });

  const req = {
    params: { id: "1" },
    body: {
      ruleName: "Invoice reminder policy",
      enabled: true,
      frequency: "Weekdays",
      reminderTime: "09:00",
      firstReminderDays: 7,
      secondReminderDays: 10,
      finalReminderDays: 31,
      templateName: "Overdue Invoice Reminder",
      emailSubject: "Payment reminder for {{invoice_number}}",
      emailBody: "{{client_name}} {{invoice_number}} {{amount_due}} {{due_date}}"
    },
    user: { userId: 12, email: "admin@example.com" },
    headers: {},
    socket: {}
  };
  const res = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis()
  };

  await putReminderSetting(req, res);

  expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
    module: "Invoice",
    activityType: "Reminder Settings",
    actionDescription: "Updated reminder rule Invoice reminder policy",
    status: "Success"
  }));
  expect(res.json).toHaveBeenCalledWith({
    setting: expect.objectContaining({ id: 1 })
  });
});
