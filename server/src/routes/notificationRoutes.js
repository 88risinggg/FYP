const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getNotificationsByUserId,
  markAsRead,
  markAllAsRead,
  markAllMyNotificationsAsRead,
  createNotification,
  getMyNotifications,
  getUnreadCount
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/user/:userId", authenticateToken, getNotificationsByUserId);
router.get("/", authenticateToken, getMyNotifications);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.put("/:notificationId/read", authenticateToken, markAsRead);
router.put("/read-all", authenticateToken, markAllMyNotificationsAsRead);
router.put("/user/:userId/read-all", authenticateToken, markAllAsRead);
router.post("/", authenticateToken, createNotification);

module.exports = router;
