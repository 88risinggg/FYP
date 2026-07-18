/**
 * Overdue Detection Service
 *
 * Automatically marks invoices as Overdue when the due date has passed.
 * Runs as a cron job (daily at midnight) and on server startup.
 * Sends notifications to Finance AND overdue reminder emails to customers.
 */

const { pool } = require("../config/db");
const { notifyInvoiceOverdue } = require("./invoiceNotificationService");

/**
 * Check all unpaid invoices and mark overdue ones.
 * Updates status from Sent/Viewed to Overdue when current date > due_date.
 * Sends Finance notifications and customer overdue emails.
 *
 * @returns {number} Number of invoices marked overdue.
 */
async function checkAndMarkOverdue() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Find invoices that should be overdue
    const [overdueInvoices] = await connection.query(`
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.total_amount,
        i.due_date,
        i.payment_url,
        i.qr_code_url,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.status IN ('Sent', 'Viewed')
        AND i.due_date < CURDATE()
    `);

    if (overdueInvoices.length === 0) {
      await connection.commit();
      return 0;
    }

    const invoiceIds = overdueInvoices.map((inv) => inv.invoice_id);

    // Batch update status to Overdue and mark payment as expired
    await connection.query(
      "UPDATE invoice SET status = 'Overdue', payment_status = 'expired' WHERE invoice_id IN (?)",
      [invoiceIds]
    );

    // Write audit log entries
    const auditValues = invoiceIds.map((id) => [
      "invoice_status:Overdue",
      "invoice",
      id,
      null // system action
    ]);

    await connection.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES ?`,
      [auditValues]
    );

    await connection.commit();

    // Send Finance notifications (non-blocking)
    for (const inv of overdueInvoices) {
      notifyInvoiceOverdue(inv.invoiceId, inv.customer_name, inv.total_amount).catch(() => {});
    }

    // Send overdue reminder emails to customers (non-blocking)
    try {
      const { sendReminderForInvoice } = require("./invoiceReminderService");
      for (const inv of overdueInvoices) {
        sendReminderForInvoice(inv, "overdue_3d").catch(() => {});
      }
    } catch { /* invoiceReminderService may not be loaded yet */ }

    console.log(`[OVERDUE] Marked ${overdueInvoices.length} invoice(s) as overdue.`);
    return overdueInvoices.length;
  } catch (error) {
    await connection.rollback();
    console.error("[OVERDUE] Error during overdue check:", error.message);
    return 0;
  } finally {
    connection.release();
  }
}

module.exports = {
  checkAndMarkOverdue
};
