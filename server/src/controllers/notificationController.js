const { pool } = require("../config/db");

/**
 * Ensures the notification table exists.
 */
async function ensureNotificationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('payslip_available', 'payslip_approved', 'profile_updated', 'system') DEFAULT 'system',
      title VARCHAR(255) NOT NULL,
      message TEXT,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
    )
  `);
}

/**
 * GET /api/notifications/user/:userId
 * Returns all notifications for a user, newest first.
 */
async function getNotificationsByUserId(req, res) {
  const { userId } = req.params;

  // Staff can only view their own notifications
  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    await ensureNotificationTable();

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

  if (req.user.role === "Staff" && String(req.user.userId) !== String(userId)) {
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
    await ensureNotificationTable();

    const [result] = await pool.query(
      "INSERT INTO notification (user_id, type, title, message) VALUES (?, ?, ?, ?)",
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
    await ensureNotificationTable();
    await pool.query(
      "INSERT INTO notification (user_id, type, title, message) VALUES (?, ?, ?, ?)",
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
