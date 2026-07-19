const { pool } = require("../config/db");

/**
 * Ensures the notification table exists and has up-to-date schema.
 */
async function ensureNotificationTable() {
  // Disabled - notification table already exists in 11-table schema
}

/**
 * GET /api/notifications/user/:userId
 * Returns all notifications for a user, newest first.
 */
async function getNotificationsByUserId(req, res) {
  const { userId } = req.params;

  // Every role reads its own inbox; Admin may inspect another user's inbox.
  if (req.user.role !== "Admin" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT notification_id, type, title, message, is_read, created_at
       FROM notification
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json(rows);
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json([]);
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
}

/**
 * PUT /api/notifications/:notificationId/read
 * Mark a notification as read.
 */
async function markAsRead(req, res) {
  const { notificationId } = req.params;

  try {
    const [result] = await pool.query(
      "UPDATE notification SET is_read = 1 WHERE notification_id = ? AND user_id = ?",
      [notificationId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json({ message: "Marked as read" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update notification" });
  }
}

/**
 * PUT /api/notifications/user/:userId/read-all
 * Mark all notifications as read for a user.
 */
async function markAllAsRead(req, res) {
  const { userId } = req.params;

  if (req.user.role !== "Admin" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    await pool.query(
      "UPDATE notification SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update notifications" });
  }
}

/**
 * POST /api/notifications
 * Create a notification (internal use — called when payslip is sent to staff).
 * Only Admin/HR/Finance can create notifications.
 */
async function createNotification(req, res) {
  const role = req.user.role;
  if (role !== "Admin" && role !== "HR" && role !== "Finance") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { user_id, type, title, message } = req.body;

  if (!user_id || !title) {
    return res.status(400).json({ message: "user_id and title are required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO notification (user_id, type, title, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())",
      [user_id, type || "system", title, message || null]
    );

    return res.status(201).json({ notification_id: result.insertId, message: "Notification created" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create notification" });
  }
}

/**
 * Helper: create a notification directly (no HTTP, for internal use).
 */
async function createNotificationInternal(userId, type, title, message) {
  try {
    await pool.query(
      "INSERT INTO notification (user_id, type, title, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())",
      [userId, type, title, message || null]
    );
  } catch (error) {
    console.error("Failed to create notification:", error.message);
  }
}

module.exports = {
  getNotificationsByUserId,
  markAsRead,
  markAllAsRead,
  createNotification,
  createNotificationInternal
};
