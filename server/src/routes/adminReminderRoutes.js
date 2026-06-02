const express = require("express");

const {
  deleteReminder,
  getReminderLogs,
  getReminderSettings,
  patchReminderStatus,
  postReminderSetting,
  postTestReminder,
  putReminderSetting
} = require("../controllers/reminderController");
const { getAdminInvoicingDashboard } = require("../controllers/adminDashboardController");
const { getSettings, putSettings } = require("../controllers/invoiceSettingsController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("Admin"));

router.get("/dashboard", getAdminInvoicingDashboard);
router.get("/invoice-settings", getSettings);
router.put("/invoice-settings", putSettings);
router.get("/reminder-settings", getReminderSettings);
router.post("/reminder-settings", postReminderSetting);
router.put("/reminder-settings/:id", putReminderSetting);
router.patch("/reminder-settings/:id/status", patchReminderStatus);
router.delete("/reminder-settings/:id", deleteReminder);
router.get("/reminder-logs", getReminderLogs);
router.post("/reminders/test", postTestReminder);

module.exports = router;
