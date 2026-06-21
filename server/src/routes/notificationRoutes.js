const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getNotificationsByUserId,
  markAsRead,
  markAllAsRead,
  createNotification
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/user/:userId", authenticateToken, getNotificationsByUserId);
router.put("/:notificationId/read", authenticateToken, markAsRead);
router.put("/user/:userId/read-all", authenticateToken, markAllAsRead);
router.post("/", authenticateToken, createNotification);

module.exports = router;
