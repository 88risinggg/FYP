/**
 * WhatsApp Notification Routes
 *
 * All routes require authentication except the webhook endpoint.
 * Finance and Admin roles can manage WhatsApp notification settings,
 * send notifications, manage templates, and view logs.
 *
 * Endpoints:
 *   GET    /settings
 *   PUT    /settings
 *   POST   /send
 *   POST   /send-invoice/:invoiceId
 *   GET    /logs
 *   POST   /test
 *   POST   /test-connection
 *   GET    /dashboard
 *   GET    /history/:invoiceId
 *   POST   /webhook/status          (no auth - Twilio callback)
 *   GET    /templates
 *   GET    /templates/placeholders
 *   GET    /templates/:id
 *   POST   /templates
 *   PUT    /templates/:id
 *   PUT    /templates/:id/default
 *   DELETE /templates/:id
 *   GET    /customers/:id/whatsapp
 *   PUT    /customers/:id/whatsapp
 *   POST   /customers/:id/verify-whatsapp
 */

const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const {
  getSettings,
  updateSettings,
  sendNotification,
  getLogs,
  sendTest,
  getDashboard,
  updateCustomerWhatsApp,
  verifyCustomerWhatsApp,
  getCustomerWhatsApp,
  testConnection,
  sendInvoiceWhatsApp,
  getInvoiceCommunicationHistory,
  webhookStatusCallback,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  getTemplatePlaceholders
} = require("../controllers/whatsappNotificationController");

const router = express.Router();

// ─── Webhook (no authentication - Twilio sends callbacks here) ────────────────
router.post("/webhook/status", webhookStatusCallback);

// ─── All other routes require authentication ──────────────────────────────────
router.use(authenticateToken);

// Settings
router.get("/settings", getSettings);
router.put("/settings", requireRole("Admin", "Finance"), updateSettings);

// Manual send
router.post("/send", requireRole("Admin", "Finance"), sendNotification);
router.post("/send-invoice/:invoiceId", requireRole("Admin", "Finance"), sendInvoiceWhatsApp);

// Test
router.post("/test", requireRole("Admin", "Finance"), sendTest);
router.post("/test-connection", requireRole("Admin", "Finance"), testConnection);

// Logs & History
router.get("/logs", getLogs);
router.get("/history/:invoiceId", getInvoiceCommunicationHistory);

// Dashboard
router.get("/dashboard", getDashboard);

// Templates
router.get("/templates/placeholders", getTemplatePlaceholders);
router.get("/templates", getTemplates);
router.get("/templates/:id", getTemplateById);
router.post("/templates", requireRole("Admin", "Finance"), createTemplate);
router.put("/templates/:id", requireRole("Admin", "Finance"), updateTemplate);
router.put("/templates/:id/default", requireRole("Admin", "Finance"), setDefaultTemplate);
router.delete("/templates/:id", requireRole("Admin", "Finance"), deleteTemplate);

// Customer WhatsApp management
router.get("/customers/:id/whatsapp", getCustomerWhatsApp);
router.put("/customers/:id/whatsapp", requireRole("Admin", "Finance"), updateCustomerWhatsApp);
router.post("/customers/:id/verify-whatsapp", requireRole("Admin", "Finance"), verifyCustomerWhatsApp);

module.exports = router;
