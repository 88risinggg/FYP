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
const {
  exportInvoicePerformance,
  getAdminInvoicingDashboard,
  getInvoicePerformance,
  getPaymentReminderSummary,
  getValidationErrors,
  getValidationSummary
} = require("../controllers/adminDashboardController");
const { getSettings, postInvoiceLogo, putSettings } = require("../controllers/invoiceSettingsController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("Admin"));

router.get("/dashboard", getAdminInvoicingDashboard);
router.get("/dashboard/invoice-performance", getInvoicePerformance);
router.get("/dashboard/invoice-performance/export", exportInvoicePerformance);
router.get("/dashboard/payment-reminder-summary", getPaymentReminderSummary);
router.get("/dashboard/validation-summary", getValidationSummary);
router.get("/dashboard/validation-errors", getValidationErrors);
router.get("/invoice-settings", getSettings);
router.put("/invoice-settings", putSettings);
router.post("/invoice-settings/logo", postInvoiceLogo);
router.get("/reminder-settings", getReminderSettings);
router.post("/reminder-settings", postReminderSetting);
router.put("/reminder-settings/:id", putReminderSetting);
router.patch("/reminder-settings/:id/status", patchReminderStatus);
router.delete("/reminder-settings/:id", deleteReminder);
router.get("/reminder-logs", getReminderLogs);
router.post("/reminders/test", postTestReminder);

module.exports = router;
