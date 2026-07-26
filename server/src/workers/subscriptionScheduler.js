/**
 * Subscription Billing Scheduler
 *
 * Runs daily (configurable interval). For each active subscription whose
 * next_billing_date <= today, it:
 *  1. Generates a new invoice (with fraud assessment).
 *  2. Sends email + PDF if auto_send is enabled.
 *  3. Advances the next_billing_date.
 *  4. Records notifications.
 *  5. Handles failures gracefully — one subscription failing won't block others.
 *
 * Duplicate prevention: checks if an invoice already exists for the subscription
 * with the same issue_date before creating a new one.
 */

const { pool } = require("../config/db");
const { createNotification } = require("../services/invoiceNotificationService");
const { assessInvoiceRisk } = require("../services/fraudDetectionService");
const { sendInvoiceEmail } = require("../services/invoiceDeliveryService");
const { createReminder, generateScheduledReminders } = require("../models/subscriptionReminderModel");
const {
  advanceNextBillingDate,
  toDateString,
} = require("../models/subscriptionModel");
const {
  getInvoiceSettings,
  previewNextInvoiceNumber,
  reserveNextInvoiceNumber,
  calculateDueDate,
} = require("../models/invoiceSettingsModel");
const { getSubscriptionSettings } = require("../models/subscriptionSettingsModel");

// Default: run once every 24 hours (86400000 ms). For dev, set via env var.
const DEFAULT_INTERVAL_MS = Number(process.env.SUBSCRIPTION_SCHEDULER_INTERVAL_MS || 86400000);
const BATCH_SIZE = Number(process.env.SUBSCRIPTION_SCHEDULER_BATCH_SIZE || 50);

/**
 * Find all active subscriptions due for billing today or earlier.
 */
async function loadDueSubscriptions(limit = BATCH_SIZE) {
  const [rows] = await pool.query(
    `SELECT
       s.subscription_id,
       s.customer_id,
       s.company_id,
       s.plan_name,
       s.description,
       s.amount,
       s.billing_frequency,
       s.next_billing_date,
       s.auto_send,
       s.auto_renew,
       s.end_date,
       c.name  AS customer_name,
       c.email AS customer_email
     FROM subscriptions s
     INNER JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Active'
       AND s.next_billing_date <= CURDATE()
     ORDER BY s.next_billing_date ASC, s.subscription_id ASC
     LIMIT ?`,
    [Math.max(limit * 5, limit)]
  );

  const settingsByCompany = new Map();
  await Promise.all(
    [...new Set(rows.map((row) => Number(row.company_id) || 0))].map(async (companyId) => {
      settingsByCompany.set(companyId, await getSubscriptionSettings(companyId));
    })
  );

  return rows
    .filter((row) => settingsByCompany.get(Number(row.company_id) || 0)?.automation.automaticInvoiceGeneration)
    .slice(0, limit);
}

/**
 * Check if an invoice already exists for this subscription + billing date.
 * Prevents duplicate invoice generation for the same billing cycle.
 */
async function invoiceAlreadyExists(connection, subscriptionId, issueDate) {
  const [rows] = await connection.query(
    `SELECT invoice_id FROM invoice
     WHERE subscription_id = ?
       AND issue_date = ?
     LIMIT 1`,
    [subscriptionId, issueDate]
  );
  return rows.length > 0;
}

/**
 * Generate a recurring invoice for a single subscription.
 * Uses a transaction with row locking to prevent race conditions.
 *
 * @param {object} subscription - Row from loadDueSubscriptions.
 * @returns {object} { success, invoiceId, sent }
 */
async function generateSubscriptionInvoice(subscription, options = {}) {
  const connection = await pool.getConnection();

  try {
    const adminSettings = await getSubscriptionSettings(subscription.company_id);
    const autoSendMode = adminSettings.automation.autoSendMode;
    const shouldAutoSend = autoSendMode === "always"
      ? true
      : autoSendMode === "never"
        ? false
        : Boolean(subscription.auto_send);

    await connection.beginTransaction();

    // Lock the subscription row to prevent concurrent processing
    const [lockedRows] = await connection.query(
      `SELECT subscription_id, status, next_billing_date, auto_send
       FROM subscriptions
       WHERE subscription_id = ?
       LIMIT 1
       FOR UPDATE`,
      [subscription.subscription_id]
    );

    const locked = lockedRows[0];
    if (!locked || locked.status !== "Active") {
      await connection.rollback();
      return { success: false, reason: "Not eligible" };
    }

    // For scheduled runs, enforce next_billing_date <= now.
    // For manual "Generate Invoice Now", skip the date check.
    if (!options.manual && new Date(locked.next_billing_date).getTime() > Date.now()) {
      await connection.rollback();
      return { success: false, reason: "Not eligible" };
    }

    // For manual generation, use today as issue date.
    // For scheduled runs, use the next_billing_date.
    const issueDate = options.manual
      ? toDateString(new Date())
      : toDateString(locked.next_billing_date);

    // Duplicate check
    if (await invoiceAlreadyExists(connection, subscription.subscription_id, issueDate)) {
      // Invoice already generated for this cycle — just advance the date
      await advanceNextBillingDate(
        subscription.subscription_id,
        subscription.billing_frequency,
        issueDate
      );
      await connection.commit();
      return { success: true, reason: "Already exists — date advanced", skipped: true };
    }

    // Reserve invoice number
    let invoiceNumber;
    try {
      const reserved = await reserveNextInvoiceNumber(
        connection,
        new Date(issueDate),
        subscription.company_id
      );
      invoiceNumber = reserved.invoiceId;
    } catch {
      // Fallback: generate from last used number
      const [lastRow] = await connection.query(
        "SELECT invoiceId FROM invoice ORDER BY invoice_id DESC LIMIT 1"
      );
      const lastId = lastRow[0]?.invoiceId || "INV-0000";
      const match = lastId.match(/(\d+)$/);
      const next = match ? Number(match[1]) + 1 : 1;
      invoiceNumber = `INV-${String(next).padStart(4, "0")}`;
    }

    // Calculate due date based on invoice settings (e.g. Net 30)
    let dueDate;
    try {
      const settings = await getInvoiceSettings(subscription.company_id);
      dueDate = calculateDueDate(settings, issueDate);
    } catch {
      // Fallback: 30 days from issue date
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      dueDate = toDateString(d);
    }

    // Determine invoice amount — use custom amount if provided (manual partial billing),
    // otherwise default to the subscription's per-period amount.
    const invoiceAmount = Number(options.amount || subscription.amount);

    // Build line items JSON
    const itemsJson = JSON.stringify([
      {
        description: `${subscription.plan_name}${subscription.description ? " — " + subscription.description : ""}`,
        quantity: 1,
        unit_price: invoiceAmount,
        amount: invoiceAmount,
      }
    ]);

    const initialStatus = shouldAutoSend ? "Sent" : "Draft";

    // Insert the invoice
    const [insertResult] = await connection.query(
      `INSERT INTO invoice
         (invoiceId, customer_id, company_id, subscription_id,
          issue_date, due_date, total_amount, status, items_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        invoiceNumber,
        subscription.customer_id,
        subscription.company_id || null,
        subscription.subscription_id,
        issueDate,
        dueDate,
        invoiceAmount,
        initialStatus,
        itemsJson,
      ]
    );

    const newInvoiceId = insertResult.insertId;

    // Fraud assessment (same as manual invoice creation)
    try {
      await assessInvoiceRisk(connection, newInvoiceId);
    } catch (fraudErr) {
      console.error(`[SUB-SCHEDULER] Fraud assessment failed for invoice ${newInvoiceId}:`, fraudErr.message);
    }

    await connection.commit();

    // ─── Post-commit operations (email, notifications) ─────────────────────
    let sent = false;

    if (shouldAutoSend) {
      try {
        await sendInvoiceEmail({
          invoice_id:     newInvoiceId,
          invoiceId:      invoiceNumber,
          total_amount:   subscription.amount,
          due_date:       dueDate,
          customer_name:  subscription.customer_name,
          customer_email: subscription.customer_email,
          company_id:     subscription.company_id,
        });

        sent = true;
      } catch (emailErr) {
        console.error(`[SUB-SCHEDULER] Email failed for invoice ${invoiceNumber}:`, emailErr.message);

        // Mark invoice back to Draft if send fails
        await pool.query("UPDATE invoice SET status = 'Draft' WHERE invoice_id = ?", [newInvoiceId]);

        if (adminSettings.automation.notifyFinanceOnFailure) {
          await createNotification({
            type:    "subscription_invoice_failed",
            title:   "Subscription Invoice Send Failed",
            message: `Failed to email invoice ${invoiceNumber} for subscription #${subscription.subscription_id} (${subscription.plan_name}). Error: ${emailErr.message}`,
          });
        }
      }
    }

    // Advance next billing date
    await advanceNextBillingDate(
      subscription.subscription_id,
      subscription.billing_frequency,
      issueDate
    );

    return { success: true, invoiceId: invoiceNumber, invoice_id: newInvoiceId, sent };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Single run of the subscription billing scheduler.
 * Processes all due subscriptions in a batch, logging results.
 */
async function runSubscriptionSchedulerOnce() {
  const dueSubscriptions = await loadDueSubscriptions();

  if (dueSubscriptions.length === 0) return 0;

  let successCount = 0;
  let failCount = 0;

  for (const sub of dueSubscriptions) {
    try {
      const result = await generateSubscriptionInvoice(sub);
      if (result.success) successCount++;
    } catch (error) {
      failCount++;
      console.error(
        `[SUB-SCHEDULER] Failed to process subscription #${sub.subscription_id} (${sub.plan_name}):`,
        error.message
      );

      // Create "invoice_generation_failed" reminder
      await createReminder({
        subscriptionId: sub.subscription_id,
        customerId:     sub.customer_id,
        companyId:      sub.company_id,
        customerName:   sub.customer_name,
        reminderType:   "invoice_generation_failed",
        notes:          `Error: ${error.message}`,
      }).catch(() => {});

      const adminSettings = await getSubscriptionSettings(sub.company_id).catch(() => null);
      if (adminSettings?.automation.notifyFinanceOnFailure !== false) {
        await createNotification({
          type:    "subscription_invoice_failed",
          title:   "Recurring Invoice Generation Failed",
          message: `Failed to generate invoice for subscription #${sub.subscription_id} (${sub.plan_name}) — ${sub.customer_name}. Error: ${error.message}`,
        }).catch(() => {});
      }
    }
  }

  if (successCount > 0 || failCount > 0) {
    console.log(`[SUB-SCHEDULER] Processed ${successCount} invoices, ${failCount} failures.`);
  }

  return successCount;
}

/**
 * Check for subscriptions renewing within 7 days and notify Finance.
 */
async function notifyUpcomingRenewals() {
  try {
    const [rows] = await pool.query(
      `SELECT
         s.subscription_id,
         s.plan_name,
         s.amount,
         s.next_billing_date,
         s.company_id,
         DATEDIFF(s.next_billing_date, CURDATE()) AS reminder_lead_days,
         c.name AS customer_name
       FROM subscriptions s
       INNER JOIN customer c ON c.customer_id = s.customer_id
       WHERE s.status = 'Active'
         AND s.next_billing_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)`
    );

    for (const sub of rows) {
      const adminSettings = await getSubscriptionSettings(sub.company_id);
      if (Number(sub.reminder_lead_days) !== adminSettings.automation.renewalReminderDays) {
        continue;
      }
      await createNotification({
        type:    "subscription_renewal_upcoming",
        title:   "Upcoming Subscription Renewal",
        message: `Subscription #${sub.subscription_id} (${sub.plan_name}) for ${sub.customer_name} renews on ${sub.next_billing_date}.`,
      });
    }
  } catch (error) {
    console.error("[SUB-SCHEDULER] Upcoming renewal notification failed:", error.message);
  }
}

/**
 * Check for expired subscriptions (end_date passed, auto_renew=false) and mark them.
 */
async function markExpiredSubscriptions() {
  try {
    const [result] = await pool.query(
      `UPDATE subscriptions
       SET status = 'Expired', updated_at = NOW()
       WHERE status = 'Active'
         AND end_date IS NOT NULL
         AND end_date < CURDATE()
         AND auto_renew = 0`
    );

    if (result.affectedRows > 0) {
      console.log(`[SUB-SCHEDULER] Marked ${result.affectedRows} subscription(s) as expired.`);

      // Notify Finance
      await createNotification({
        type:    "subscription_expired",
        title:   "Subscriptions Expired",
        message: `${result.affectedRows} subscription(s) expired today.`,
      });
    }
  } catch (error) {
    console.error("[SUB-SCHEDULER] Mark expired failed:", error.message);
  }
}

/**
 * Start the subscription scheduler with the configured interval.
 * Combines billing, expiry detection, and renewal notifications in one loop.
 */
function startSubscriptionScheduler() {
  if (process.env.SUBSCRIPTION_SCHEDULER_ENABLED === "false") {
    console.log("Subscription scheduler disabled.");
    return null;
  }

  const runSafely = async () => {
    try {
      await markExpiredSubscriptions();
      await notifyUpcomingRenewals();
      await runSubscriptionSchedulerOnce();
      // Generate subscription reminders based on current states
      await generateScheduledReminders(null).catch((err) => {
        console.error("[SUB-SCHEDULER] Reminder generation failed:", err.message);
      });
    } catch (error) {
      console.error("[SUB-SCHEDULER] Run failed:", error.message);
    }
  };

  // Run immediately on startup, then on interval
  runSafely();

  setInterval(runSafely, DEFAULT_INTERVAL_MS);
  console.log(`Subscription scheduler running every ${DEFAULT_INTERVAL_MS / 1000}s.`);
  return true;
}

module.exports = {
  loadDueSubscriptions,
  generateSubscriptionInvoice,
  runSubscriptionSchedulerOnce,
  markExpiredSubscriptions,
  notifyUpcomingRenewals,
  startSubscriptionScheduler,
};
