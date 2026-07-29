/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Defines the available whatsapp Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
/**
 * WhatsApp Integration Routes (Refactored)
 *
 * Route structure:
 *   /api/whatsapp/webhook/status       — Twilio callback (no auth)
 *   /api/whatsapp/admin/*              — Admin-only (config, templates, rules, logs)
 *   /api/whatsapp/finance/*            — Finance operations (send, history, status)
 *
 * Role enforcement:
 *   - Admin routes: requireRole("Admin")
 *   - Finance routes: requireRole("Admin", "Finance")
 *   - Webhook: no authentication
 */

const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const {
  // Admin
  getConfig,
  saveConfig,
  toggleEnabled,
  testConnection,
  sendTestMessage,
  getIntegrationLogs,
  getNotificationRules,
  updateNotificationRule,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  // Finance
  getFinanceStatus,
  sendInvoiceWhatsApp,
  sendReminderWhatsApp,
  sendOverdueWhatsApp,
  sendConfirmationWhatsApp,
  getInvoiceHistory,
  getMessages,
  getDashboard,
  resendFailedMessage,
  getDeliveryStatus,
  // Webhook
  webhookStatusCallback
} = require("../controllers/whatsappController");

const router = express.Router();

// ─── Webhook (no authentication — Twilio sends callbacks here) ────────────────
router.post("/webhook/status", webhookStatusCallback);

// ─── All other routes require authentication ──────────────────────────────────
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — Only Admin can configure WhatsApp integration
// ═══════════════════════════════════════════════════════════════════════════════

// Config
router.get("/admin/config", requireRole("Admin"), getConfig);
router.put("/admin/config", requireRole("Admin"), saveConfig);
router.put("/admin/toggle", requireRole("Admin"), toggleEnabled);

// Connection testing
router.post("/admin/test-connection", requireRole("Admin"), testConnection);
router.post("/admin/test-message", requireRole("Admin"), sendTestMessage);

// Integration logs
router.get("/admin/logs", requireRole("Admin"), getIntegrationLogs);

// Notification rules
router.get("/admin/notification-rules", requireRole("Admin"), getNotificationRules);
router.put("/admin/notification-rules/:ruleType", requireRole("Admin"), updateNotificationRule);

// Templates
router.get("/admin/templates", requireRole("Admin"), getTemplates);
router.get("/admin/templates/:id", requireRole("Admin"), getTemplateById);
router.post("/admin/templates", requireRole("Admin"), createTemplate);
router.put("/admin/templates/:id", requireRole("Admin"), updateTemplate);
router.delete("/admin/templates/:id", requireRole("Admin"), deleteTemplate);
router.put("/admin/templates/:id/default", requireRole("Admin"), setDefaultTemplate);

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCE ROUTES — Finance can use the configured integration
// ═══════════════════════════════════════════════════════════════════════════════

// Status check
router.get("/finance/status", requireRole("Admin", "Finance"), getFinanceStatus);

// Send operations
router.post("/finance/send-invoice/:invoiceId", requireRole("Admin", "Finance"), sendInvoiceWhatsApp);
router.post("/finance/send-reminder/:invoiceId", requireRole("Admin", "Finance"), sendReminderWhatsApp);
router.post("/finance/send-overdue/:invoiceId", requireRole("Admin", "Finance"), sendOverdueWhatsApp);
router.post("/finance/send-confirmation/:invoiceId", requireRole("Admin", "Finance"), sendConfirmationWhatsApp);

// Message history & status
router.get("/finance/history/:invoiceId", requireRole("Admin", "Finance"), getInvoiceHistory);
router.get("/finance/messages", requireRole("Admin", "Finance"), getMessages);
router.get("/finance/dashboard", requireRole("Admin", "Finance"), getDashboard);
router.get("/finance/delivery-status/:invoiceId", requireRole("Admin", "Finance"), getDeliveryStatus);

// Resend
router.post("/finance/resend/:messageId", requireRole("Admin", "Finance"), resendFailedMessage);

module.exports = router;
