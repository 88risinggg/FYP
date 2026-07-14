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
  markNotificationRead,
  markAllNotificationsRead
} = require("../controllers/financeDashboardController");

const router = express.Router();

router.use(authenticateToken);

router.get("/dashboard", getFinanceDashboard);
router.get("/notifications", getFinanceNotifications);
router.put("/notifications/:id/read", markNotificationRead);
router.put("/notifications/read-all", markAllNotificationsRead);

module.exports = router;
