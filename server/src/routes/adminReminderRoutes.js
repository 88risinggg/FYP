const express = require("express");

const {
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
  getEmailDelivery,
  getInvoicePerformance,
  getPaymentReminderSummary,
  getPaymentUpdates,
  getValidationErrors,
  getValidationUploadHistory,
  getValidationSummary
} = require("../controllers/adminDashboardController");
const {
  getGstRates,
  getNumberingActivity,
  getSettings,
  postGstRate,
  postInvoiceLogo,
  postInvoicePreview,
  postTestInvoiceEmail,
  putSettings
} = require("../controllers/invoiceSettingsController");
const { getTemplatePreview } = require("../controllers/invoicePreviewController");
const {
  getAdminSubscriptionSettings,
  putAdminSubscriptionSettings
} = require("../controllers/subscriptionSettingsController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("Admin"));

router.get("/dashboard", getAdminInvoicingDashboard);
router.get("/dashboard/invoice-performance", getInvoicePerformance);
router.get("/dashboard/invoice-performance/export", exportInvoicePerformance);
router.get("/dashboard/payment-reminder-summary", getPaymentReminderSummary);
router.get("/dashboard/email-delivery", getEmailDelivery);
router.get("/dashboard/payment-updates", getPaymentUpdates);
router.get("/dashboard/validation-summary", getValidationSummary);
router.get("/dashboard/validation-summary/uploads", getValidationUploadHistory);
router.get("/dashboard/validation-errors", getValidationErrors);
router.get("/invoice-settings", getSettings);
router.put("/invoice-settings", putSettings);
router.get("/invoice-settings/numbering-activity", getNumberingActivity);
router.get("/invoice-settings/gst-rates", getGstRates);
router.post("/invoice-settings/gst-rates", postGstRate);
router.post("/invoice-settings/logo", postInvoiceLogo);
router.post("/invoice-settings/preview", postInvoicePreview);
router.post("/invoice-settings/template-preview", getTemplatePreview);
router.post("/invoice-settings/test-email", postTestInvoiceEmail);
router.get("/subscription-settings", getAdminSubscriptionSettings);
router.put("/subscription-settings", putAdminSubscriptionSettings);
router.get("/reminder-settings", getReminderSettings);
router.post("/reminder-settings", postReminderSetting);
router.put("/reminder-settings/:id", putReminderSetting);
router.patch("/reminder-settings/:id/status", patchReminderStatus);
router.get("/reminder-logs", getReminderLogs);
router.post("/reminders/test", postTestReminder);

module.exports = router;
