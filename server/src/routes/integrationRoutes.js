/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Defines the available integration Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
/**
 * Integration Routes
 *
 * Provides endpoints for:
 *   - Integration status panel (Stripe, SMTP, WhatsApp)
 *   - SMTP connection verification
 *   - Test email send (development only)
 *   - Test WhatsApp send (development only)
 *   - Email delivery logs
 *   - Retry failed emails
 *
 * All routes require authentication + Admin or Finance role.
 */

const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const {
  getIntegrationStatus,
  verifySMTP,
  sendTestEmail,
  sendTestWhatsApp,
  getEmailDeliveryLogs,
  retryFailedEmail
} = require("../controllers/integrationController");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Integration status — Admin and Finance
router.get("/status", requireRole("Admin", "Finance"), getIntegrationStatus);

// SMTP verification — Admin only
router.post("/smtp/verify", requireRole("Admin"), verifySMTP);

// Test endpoints — Admin and Finance (restricted in production)
router.post("/test/email", requireRole("Admin", "Finance"), sendTestEmail);
router.post("/test/whatsapp", requireRole("Admin", "Finance"), sendTestWhatsApp);

// Email delivery logs — Admin and Finance
router.get("/email-logs", requireRole("Admin", "Finance"), getEmailDeliveryLogs);

// Retry failed email — Admin and Finance
router.post("/email-logs/:logId/retry", requireRole("Admin", "Finance"), retryFailedEmail);

module.exports = router;
