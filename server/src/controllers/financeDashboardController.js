/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Handles finance Dashboard Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Finance Dashboard Controller
 *
 * Provides invoice-related metrics and activity data for the Finance dashboard.
 * Only displays invoice-related information (no payroll, HR, or admin data).
 *
 * Uses the existing `notification` table for Finance notifications.
 * Finance notifications are identified by type prefix 'finance_' or known invoice types.
 */

const { pool } = require("../config/db");
const { currentCompanyId } = require("../services/tenantContext");

// Types used for finance/invoice notifications
const FINANCE_NOTIFICATION_TYPES = [
  "finance_invoice_created",
  "finance_invoice_sent",
  "finance_customer_viewed",
  "finance_payment_success",
  "finance_payment_failed",
  "finance_invoice_overdue",
  "finance_reminder_sent",
  "finance_fraud_alert",
  "finance_stripe_payment",
  "finance_invoice_cancelled",
  "draft_saved",
  "invoice_sent",
  "customer_viewed",
  "customer_downloaded",
  "pay_now_clicked",
  "payment_success",
  "payment_failed",
  "invoice_overdue",
  "payment_refunded",
  "reminder_sent",
  "invoice_cancelled",
  "fraud_alert"
];

/**
 * GET /api/finance/dashboard
 *
 * Returns comprehensive dashboard metrics:
 * - Status counts (Draft, Scheduled, Sent, Viewed, Paid, Overdue, Pending Review)
 * - Today's invoices count
 * - Pending payment total (outstanding)
 * - Revenue (total paid)
 * - Fraud alerts count
 * - Validation errors count
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
      Draft: 0, Scheduled: 0, Sent: 0, Viewed: 0, Paid: 0,
      Overdue: 0, Cancelled: 0, Refunded: 0, "Pending Review": 0
    };
    statusRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) {
        statusCounts[row.status] = row.count;
      }
    });

    // Today's invoice count
    const [todayRows] = await pool.query(`
      SELECT COUNT(*) AS count FROM invoice
      WHERE DATE(created_at) = CURDATE()
    `);
    const todayCount = todayRows[0]?.count || 0;

    // Pending payment total (Sent + Viewed + Overdue + Pending Review)
    const [pendingRows] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM invoice
      WHERE status IN ('Sent', 'Viewed', 'Overdue', 'Pending Review')
    `);
    const outstandingAmount = Number(pendingRows[0]?.total || 0);

    // Total revenue (Paid invoices)
    const [revenueRows] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM invoice
      WHERE status = 'Paid'
    `);
    const revenue = Number(revenueRows[0]?.total || 0);

    // Fraud alerts (High risk, unresolved)
    let fraudAlerts = 0;
    try {
      const [fraudRows] = await pool.query(`
        SELECT COUNT(*) AS count FROM invoice
        WHERE risk_level = 'High' AND (review_status IS NULL OR review_status = 'Open')
      `);
      fraudAlerts = fraudRows[0]?.count || 0;
    } catch { /* columns may not exist */ }

    // Pending payment reviews (from payment table review_status column)
    let pendingReviews = 0;
    try {
      const [reviewRows] = await pool.query(`
        SELECT COUNT(*) AS count FROM payment
        WHERE review_status = 'Pending Review'
      `);
      pendingReviews = reviewRows[0]?.count || 0;
    } catch { /* column may not exist */ }

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
    let recentActivity = [];
    try {
      const [activityRows] = await pool.query(`
        SELECT
          al.log_id,
          al.action_description AS action,
          al.affected_record AS entity_id,
          al.activity_type AS entity_type,
          al.created_at AS timestamp,
          al.ip_address,
          al.device_info,
          u.email AS user_email
        FROM audit_logs al
        LEFT JOIN user u ON u.user_id = al.user_id
        WHERE al.activity_type IN ('invoice', 'payment', 'vaniday_import')
        ORDER BY al.created_at DESC
        LIMIT 10
      `);
      recentActivity = activityRows;
    } catch {
      // audit_logs table may have different schema
    }

    res.json({
      statusCounts,
      todayCount,
      outstandingAmount,
      revenue,
      fraudAlerts,
      pendingReviews,
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
 * Uses the existing `notification` table.
 * Only Finance role users can access this endpoint.
 */
async function getFinanceNotifications(req, res) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    // Only Finance users should receive finance notifications
    if (role !== "Finance") {
      return res.json({ notifications: [] });
    }

    const [rows] = await pool.query(`
      SELECT
        notification_id,
        type,
        title,
        message,
        is_read,
        created_at
      FROM notification
      WHERE user_id = ? AND company_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId, currentCompanyId()]);

    res.json({ notifications: rows });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ notifications: [] });
    }
    console.error("[FINANCE NOTIFICATIONS]", error.message);
    res.status(500).json({ message: "Failed to load notifications." });
  }
}

/**
 * GET /api/finance/notifications/unread-count
 *
 * Returns just the unread count for efficient polling.
 * Only Finance role users get a count; others get 0.
 */
async function getUnreadCount(req, res) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (role !== "Finance") {
      return res.json({ count: 0 });
    }

    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM notification WHERE user_id = ? AND company_id = ? AND is_read = 0",
      [userId, currentCompanyId()]
    );

    res.json({ count: Number(rows[0]?.count || 0) });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({ count: 0 });
    }
    res.status(500).json({ message: "Failed to get unread count." });
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
      "UPDATE notification SET is_read = 1 WHERE notification_id = ? AND user_id = ? AND company_id = ?",
      [notificationId, userId, currentCompanyId()]
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
      "UPDATE notification SET is_read = 1 WHERE user_id = ? AND company_id = ? AND is_read = 0",
      [userId, currentCompanyId()]
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
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
};
