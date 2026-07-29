/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Handles notification Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
const { pool } = require("../config/db");
const { notifyUser } = require("../services/payrollNotificationService");
const { currentCompanyId } = require("../services/tenantContext");

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
      `SELECT n.notification_id, n.type, n.title, n.message, n.is_read, n.created_at,
              n.action_path, n.actor_user_id, n.entity_type, n.entity_id, n.channel,
              n.metadata, n.delivery_status, n.sent_at, n.error_message, actor.name AS actor_name
       FROM notification n
       LEFT JOIN user actor ON actor.user_id = n.actor_user_id AND actor.company_id = n.company_id
       WHERE n.user_id = ? AND n.company_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId, currentCompanyId()]
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
      "UPDATE notification SET is_read = 1 WHERE notification_id = ? AND user_id = ? AND company_id = ?",
      [notificationId, req.user.userId, currentCompanyId()]
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
      "UPDATE notification SET is_read = 1 WHERE user_id = ? AND company_id = ? AND is_read = 0",
      [userId, currentCompanyId()]
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
    const companyId = currentCompanyId();
    const [[recipient]] = await pool.query("SELECT user_id FROM user WHERE user_id = ? AND company_id = ? LIMIT 1", [user_id, companyId]);
    if (!recipient) return res.status(404).json({ message: "Notification recipient not found in this company." });
    const [result] = await pool.query(
      "INSERT INTO notification (company_id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())",
      [companyId, user_id, type || "system", title, message || null]
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
    await notifyUser(userId, { type, title, message: message || "" });
  } catch (error) {
    console.error("Failed to create notification:", error.message);
  }
}

async function markAllMyNotificationsAsRead(req, res) {
  req.params.userId = String(req.user.userId);
  return markAllAsRead(req, res);
}

async function getMyNotifications(req, res) {
  req.params.userId = String(req.user.userId);
  return getNotificationsByUserId(req, res);
}

async function getUnreadCount(req, res) {
  try {
    const [[row]] = await pool.execute(
      "SELECT COUNT(*) AS count FROM notification WHERE user_id = ? AND company_id = ? AND is_read = 0",
      [req.user.userId, currentCompanyId()]
    );
    return res.json({ count: Number(row.count || 0) });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to load unread notification count" });
  }
}

module.exports = {
  getNotificationsByUserId,
  markAsRead,
  markAllAsRead,
  markAllMyNotificationsAsRead,
  createNotification,
  createNotificationInternal,
  getMyNotifications,
  getUnreadCount
};
