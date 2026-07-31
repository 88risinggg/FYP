/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Defines the available admin Reminder Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
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
  getReceiptSettings,
  getSettings,
  postGstRate,
  postInvoiceLogo,
  postInvoicePreview,
  postTestReceiptEmail,
  postTestInvoiceEmail,
  putReceiptSettings,
  putGstRate,
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

// PRESENTATION NOTE:
// These routes are the backend entry points for admin-side invoicing pages.
// Frontend services call /api/admin/invoicing/... and app.js forwards them here.
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
router.put("/invoice-settings/gst-rates/:id", putGstRate);
router.get("/receipt-settings", getReceiptSettings);
router.put("/receipt-settings", putReceiptSettings);
router.post("/receipt-settings/test-email", postTestReceiptEmail);
router.post("/invoice-settings/logo", postInvoiceLogo);
router.post("/invoice-settings/preview", postInvoicePreview);
router.post("/invoice-settings/template-preview", getTemplatePreview);
router.post("/invoice-settings/test-email", postTestInvoiceEmail);
router.get("/subscription-settings", getAdminSubscriptionSettings);
router.put("/subscription-settings", putAdminSubscriptionSettings);

// PRESENTATION NOTE:
// Automatic Customer Reminder Policy routes.
// Frontend file:
// client/src/services/adminReminderService.js
// Controller file:
// server/src/controllers/reminderController.js
router.get("/reminder-settings", getReminderSettings);
router.post("/reminder-settings", postReminderSetting);
router.put("/reminder-settings/:id", putReminderSetting);
router.patch("/reminder-settings/:id/status", patchReminderStatus);
router.get("/reminder-logs", getReminderLogs);
router.post("/reminders/test", postTestReminder);

module.exports = router;
