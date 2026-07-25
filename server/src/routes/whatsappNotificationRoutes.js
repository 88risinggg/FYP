/**
 * WhatsApp Notification Routes
 *
 * All routes require authentication. Finance and Admin roles can manage
 * WhatsApp notification settings, send notifications, and view logs.
 *
 * Endpoints:
 *   GET    /api/whatsapp-notifications/settings
 *   PUT    /api/whatsapp-notifications/settings
 *   POST   /api/whatsapp-notifications/send
 *   GET    /api/whatsapp-notifications/logs
 *   POST   /api/whatsapp-notifications/test
 *   GET    /api/whatsapp-notifications/dashboard
 *   GET    /api/whatsapp-notifications/customers/:id/whatsapp
 *   PUT    /api/whatsapp-notifications/customers/:id/whatsapp
 *   POST   /api/whatsapp-notifications/customers/:id/verify-whatsapp
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
  getCustomerWhatsApp
} = require("../controllers/whatsappNotificationController");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Settings
router.get("/settings", getSettings);
router.put("/settings", requireRole("Admin"), updateSettings);

// Manual send
router.post("/send", requireRole("Admin", "Finance"), sendNotification);

// Test
router.post("/test", requireRole("Admin", "Finance"), sendTest);

// Logs
router.get("/logs", getLogs);

// Dashboard
router.get("/dashboard", getDashboard);

// Customer WhatsApp management
router.get("/customers/:id/whatsapp", getCustomerWhatsApp);
router.put("/customers/:id/whatsapp", requireRole("Admin", "Finance"), updateCustomerWhatsApp);
router.post("/customers/:id/verify-whatsapp", requireRole("Admin", "Finance"), verifyCustomerWhatsApp);

module.exports = router;
