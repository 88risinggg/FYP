const cron = require("node-cron");

const { pool } = require("../config/db");
const { sendInvoiceEmail } = require("../services/invoiceDeliveryService");
const { writeAuditLog, STATUS_AUDIT_PREFIX } = require("../controllers/invoiceController");

const DEFAULT_CRON_EXPRESSION = process.env.INVOICE_SCHEDULER_CRON || "* * * * *";
const DEFAULT_BATCH_SIZE = Number(process.env.INVOICE_SCHEDULER_BATCH_SIZE || 25);

async function loadDueScheduledInvoices(limit = DEFAULT_BATCH_SIZE) {
  const [rows] = await pool.query(
    `
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.total_amount,
        i.scheduled_at,
        c.name AS customer_name,
        c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.status = 'Scheduled'
        AND i.scheduled_at IS NOT NULL
        AND i.scheduled_at <= NOW()
      ORDER BY i.scheduled_at ASC, i.invoice_id ASC
      LIMIT ?
    `,
    [limit]
  );

  return rows;
}

async function sendScheduledInvoice(invoice) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [lockedRows] = await connection.query(
      `
        SELECT invoice_id, status, scheduled_at
        FROM invoice
        WHERE invoice_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [invoice.invoice_id]
    );

    const lockedInvoice = lockedRows[0];
    if (
      !lockedInvoice ||
      lockedInvoice.status !== "Scheduled" ||
      !lockedInvoice.scheduled_at ||
      new Date(lockedInvoice.scheduled_at).getTime() > Date.now()
    ) {
      await connection.rollback();
      return false;
    }

    await sendInvoiceEmail(invoice);

    await connection.query(
      "UPDATE invoice SET status = 'Sent' WHERE invoice_id = ?",
      [invoice.invoice_id]
    );
    await writeAuditLog(
      connection,
      `${STATUS_AUDIT_PREFIX}Sent`,
      "invoice",
      invoice.invoice_id,
      null
    );
    await writeAuditLog(
      connection,
      "scheduled_invoice_sent",
      "invoice",
      invoice.invoice_id,
      null
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function runInvoiceSchedulerOnce() {
  const dueInvoices = await loadDueScheduledInvoices();

  for (const invoice of dueInvoices) {
    try {
      await sendScheduledInvoice(invoice);
    } catch (error) {
      console.error(`Failed to send scheduled invoice ${invoice.invoiceId}:`, error);
    }
  }

  const overdueCount = await markOverdueInvoices();

  return dueInvoices.length + overdueCount;
}

async function markOverdueInvoices() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT invoice_id
        FROM invoice
        WHERE status <> 'Paid'
          AND status <> 'Overdue'
          AND due_date < CURDATE()
        FOR UPDATE
      `
    );

    if (rows.length === 0) {
      await connection.commit();
      return 0;
    }

    const invoiceIds = rows.map((row) => row.invoice_id);
    await connection.query(
      "UPDATE invoice SET status = 'Overdue', scheduled_at = NULL WHERE invoice_id IN (?)",
      [invoiceIds]
    );

    for (const invoiceId of invoiceIds) {
      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Overdue`, "invoice", invoiceId, null);
      await writeAuditLog(connection, "invoice_marked_overdue", "invoice", invoiceId, null);
    }

    await connection.commit();
    return invoiceIds.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function startInvoiceScheduler() {
  if (process.env.INVOICE_SCHEDULER_ENABLED === "false") {
    console.log("Invoice scheduler disabled.");
    return null;
  }

  const task = cron.schedule(DEFAULT_CRON_EXPRESSION, runInvoiceSchedulerOnce, {
    timezone: process.env.INVOICE_SCHEDULER_TIMEZONE || "Asia/Singapore"
  });

  console.log(`Invoice scheduler running with cron expression "${DEFAULT_CRON_EXPRESSION}".`);
  return task;
}

module.exports = {
  loadDueScheduledInvoices,
  markOverdueInvoices,
  runInvoiceSchedulerOnce,
  sendScheduledInvoice,
  startInvoiceScheduler
};
