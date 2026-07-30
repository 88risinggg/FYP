/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Runs scheduled invoice Scheduler background processing.
 * LAYER: Background worker - performs scheduled processing outside a user request.
 * FIND RELATED CODE: Trace its imports to find the scheduler registration and services it runs.
 */
const { pool } = require("../config/db");
const { sendInvoiceEmail } = require("../services/invoiceDeliveryService");
const { writeAuditLog, STATUS_AUDIT_PREFIX } = require("../controllers/invoiceController");

const DEFAULT_INTERVAL_MS = Number(process.env.INVOICE_SCHEDULER_INTERVAL_MS || 60000); // default 1 minute
const DEFAULT_BATCH_SIZE = Number(process.env.INVOICE_SCHEDULER_BATCH_SIZE || 25);

async function loadDueScheduledInvoices(limit = DEFAULT_BATCH_SIZE) {
  const [rows] = await pool.query(
    `
      SELECT
        i.invoice_id,
        i.invoiceId,
        i.company_id,
        i.total_amount,
        i.due_date,
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

    const delivery = await sendInvoiceEmail(invoice);

    await connection.query(
      "UPDATE invoice SET status = 'Sent' WHERE invoice_id = ?",
      [invoice.invoice_id]
    );
    await writeAuditLog(
      connection,
      `${STATUS_AUDIT_PREFIX}Sent`,
      "invoice",
      invoice.invoice_id,
      null,
      {
        previousValue: lockedInvoice.status,
        newValue: "Sent"
      }
    );
    await writeAuditLog(
      connection,
      "scheduled_invoice_sent",
      "invoice",
      invoice.invoice_id,
      null,
      { newValue: JSON.stringify({ ...delivery, emailType: "Invoice Issued", scheduledAt: invoice.scheduled_at, triggerSource: "System" }) }
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    await writeAuditLog(
      connection,
      "invoice_email_failed",
      "invoice",
      invoice.invoice_id,
      null,
      { newValue: JSON.stringify({ emailType: "Invoice Issued", message: error.message, errorCode: error.code, scheduledAt: invoice.scheduled_at, triggerSource: "System" }) }
    );
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
        SELECT invoice_id, status
        FROM invoice
        WHERE status IN ('Sent', 'Viewed')
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
      const previousStatus = rows.find((row) => Number(row.invoice_id) === Number(invoiceId))?.status || "Sent";
      await writeAuditLog(connection, `${STATUS_AUDIT_PREFIX}Overdue`, "invoice", invoiceId, null, {
        previousValue: previousStatus,
        newValue: "Overdue"
      });
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

  const runSafely = async () => {
    try {
      await runInvoiceSchedulerOnce();
    } catch (error) {
      console.error("Invoice scheduler run failed:", error.message);
    }
  };

  setInterval(runSafely, DEFAULT_INTERVAL_MS);

  console.log(`Invoice scheduler running every ${DEFAULT_INTERVAL_MS / 1000}s.`);
  return true;
}

module.exports = {
  loadDueScheduledInvoices,
  markOverdueInvoices,
  runInvoiceSchedulerOnce,
  sendScheduledInvoice,
  startInvoiceScheduler
};
