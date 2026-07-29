/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Defines the available finance Dashboard Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
/**
 * Finance Dashboard Routes
 *
 * Provides invoice-related dashboard, notifications, and metrics for Finance users.
 */

const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getFinanceDashboard,
  getFinanceNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
} = require("../controllers/financeDashboardController");

const router = express.Router();

router.use(authenticateToken);

router.get("/dashboard", getFinanceDashboard);
router.get("/notifications", getFinanceNotifications);
router.get("/notifications/unread-count", getUnreadCount);
router.put("/notifications/:id/read", markNotificationRead);
router.put("/notifications/read-all", markAllNotificationsRead);

module.exports = router;
