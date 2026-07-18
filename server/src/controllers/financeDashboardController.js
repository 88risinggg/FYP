/**
 * Finance Dashboard Controller
 *
 * Provides invoice-related metrics and activity data for the Finance dashboard.
 * Only displays invoice-related information (no payroll, HR, or admin data).
 */

const { pool } = require("../config/db");

/**
 * GET /api/finance/dashboard
 *
 * Returns dashboard metrics:
 * - Status counts (Draft, Sent, Viewed, Paid, Overdue)
 * - Today's invoices count
 * - Pending payment total
 * - Recent invoices (10)
 * - Recent activity (10)
 */
async function getFinanceDashboard(req, res) {
  try {
    // Status counts
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM invoice
      GROUP BY status
    `);

    const statusCounts = {
      Draft: 0, Sent: 0, Viewed: 0, Paid: 0, Overdue: 0, Cancelled: 0, Refunded: 0
    };
    statusRows.forEach((row) => {
      if (statusCounts.hasOwnProperty(row.status)) {
        statusCounts[row.status] = row.count;
      }
    });

    // Today's invoice count
    const [todayRows] = await pool.query(`
      SELECT COUNT(*) AS count FROM invoice
      WHERE DATE(created_at) = CURDATE()
    `);
    const todayCount = todayRows[0]?.count || 0;

    // Pending payment total (Sent + Viewed + Overdue)
    const [pendingRows] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM invoice
      WHERE status IN ('Sent', 'Viewed', 'Overdue')
    `);
    const pendingTotal = Number(pendingRows[0]?.total || 0);

    // Recent invoices (last 10)
    const [recentInvoices] = await pool.query(`
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.status,
        i.issue_date,
        i.due_date,
        i.total_amount,
        i.created_at,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

    // Recent activity (last 10 audit log entries for invoices)
    const [recentActivity] = await pool.query(`
      SELECT
        al.log_id,
        al.action,
        al.entity_id,
        al.entity_type,
        al.created_at AS timestamp,
        u.email AS user_email
      FROM audit_log al
      LEFT JOIN user u ON u.user_id = al.user_user_id
      WHERE al.entity_type = 'invoice'
      ORDER BY al.log_id DESC
      LIMIT 10
    `);

    res.json({
      statusCounts,
      todayCount,
      pendingTotal,
      recentInvoices,
      recentActivity
    });
  } catch (error) {
    console.error("[FINANCE DASHBOARD]", error.message);
    res.status(500).json({ message: "Failed to load dashboard data." });
  }
}

/**
 * GET /api/finance/notifications
 *
 * Returns invoice-related notifications for the current Finance user.
 */
async function getFinanceNotifications(req, res) {
  try {
    const userId = req.user?.userId;

    const [rows] = await pool.query(`
      SELECT
        n.notification_id,
        n.type,
        n.title,
        n.message,
        n.is_read,
        n.invoice_id,
        n.created_at
      FROM invoice_notification n
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({ notifications: rows });
  } catch (error) {
    // Table may not exist yet — return empty array
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ notifications: [] });
    }
    console.error("[FINANCE NOTIFICATIONS]", error.message);
    res.status(500).json({ message: "Failed to load notifications." });
  }
}

/**
 * PUT /api/finance/notifications/:id/read
 *
 * Mark a notification as read.
 */
async function markNotificationRead(req, res) {
  try {
    const notificationId = Number(req.params.id);
    const userId = req.user?.userId;

    await pool.query(
      "UPDATE invoice_notification SET is_read = 1 WHERE notification_id = ? AND user_id = ?",
      [notificationId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ success: true });
    }
    res.status(500).json({ message: "Failed to update notification." });
  }
}

/**
 * PUT /api/finance/notifications/read-all
 *
 * Mark all notifications as read for the current user.
 */
async function markAllNotificationsRead(req, res) {
  try {
    const userId = req.user?.userId;

    await pool.query(
      "UPDATE invoice_notification SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ success: true });
    }
    res.status(500).json({ message: "Failed to update notifications." });
  }
}

module.exports = {
  getFinanceDashboard,
  getFinanceNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
