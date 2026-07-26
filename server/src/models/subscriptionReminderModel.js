/**
 * Subscription Reminder Model
 *
 * Data-access layer for the subscription_reminders table.
 * Provides CRUD operations and query helpers for the subscription
 * reminders feature used by Finance users.
 */

const { pool } = require("../config/db");

// ─── Reminder type → priority mapping (defaults) ──────────────────────────────

const REMINDER_PRIORITY_MAP = {
  renewal_due_7_days:         "Medium",
  expires_today:              "High",
  expired:                    "High",
  billing_today:              "Low",
  invoice_generation_failed:  "High",
  payment_failed:             "High",
  subscription_paused:        "Medium",
  auto_renew_disabled:        "Medium",
  incomplete_import:          "Low",
};

// ─── Reminder type → human-readable label ─────────────────────────────────────

const REMINDER_TYPE_LABELS = {
  renewal_due_7_days:         "Subscription renewal due within 7 days",
  expires_today:              "Subscription expires today",
  expired:                    "Subscription expired",
  billing_today:              "Next billing date is today",
  invoice_generation_failed:  "Automatic invoice generation failed",
  payment_failed:             "Payment failed",
  subscription_paused:        "Subscription is paused",
  auto_renew_disabled:        "Auto-renew is disabled",
  incomplete_import:          "Imported subscription requires review",
};

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch all reminders with optional filters.
 */
async function findAllReminders(companyId, filters = {}) {
  const conditions = [];
  const params = [];

  if (companyId) {
    conditions.push("sr.company_id = ?");
    params.push(companyId);
  }

  if (filters.status) {
    conditions.push("sr.status = ?");
    params.push(filters.status);
  } else {
    // Default to active reminders only
    conditions.push("sr.status = 'Active'");
  }

  if (filters.priority) {
    conditions.push("sr.priority = ?");
    params.push(filters.priority);
  }

  if (filters.reminderType) {
    conditions.push("sr.reminder_type = ?");
    params.push(filters.reminderType);
  }

  if (filters.search) {
    conditions.push("(sr.customer_name LIKE ? OR CAST(sr.subscription_id AS CHAR) LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT
       sr.reminder_id,
       sr.subscription_id,
       sr.customer_id,
       sr.company_id,
       sr.customer_name,
       sr.reminder_type,
       sr.priority,
       sr.reminder_date,
       sr.status,
       sr.resolved_at,
       sr.resolved_by,
       sr.notes,
       sr.created_at,
       sr.updated_at,
       s.plan_name,
       s.amount,
       s.billing_frequency,
       s.next_billing_date,
       s.status AS subscription_status
     FROM subscription_reminders sr
     LEFT JOIN subscriptions s ON s.subscription_id = sr.subscription_id
     ${where}
     ORDER BY
       FIELD(sr.priority, 'High', 'Medium', 'Low'),
       sr.reminder_date DESC
     LIMIT 200`,
    params
  );

  return rows;
}

/**
 * Fetch a single reminder by ID.
 */
async function findReminderById(reminderId) {
  const [rows] = await pool.query(
    `SELECT
       sr.*,
       s.plan_name,
       s.amount,
       s.billing_frequency,
       s.next_billing_date,
       s.status AS subscription_status
     FROM subscription_reminders sr
     LEFT JOIN subscriptions s ON s.subscription_id = sr.subscription_id
     WHERE sr.reminder_id = ?`,
    [reminderId]
  );
  return rows[0] || null;
}

/**
 * Get dashboard summary counts for subscription reminders.
 */
async function getReminderDashboardSummary(companyId) {
  const params = [];
  const companyFilter = companyId ? "AND sr.company_id = ?" : "";
  if (companyId) params.push(companyId);

  const today = new Date().toISOString().split("T")[0];

  // Renewals due today
  const [[renewalsTodayRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_reminders sr
     WHERE sr.status = 'Active'
       AND sr.reminder_type = 'renewal_due_7_days'
       AND sr.reminder_date = ?
       ${companyFilter}`,
    [today, ...params]
  );

  // Renewals due this week
  const [[renewalsWeekRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_reminders sr
     WHERE sr.status = 'Active'
       AND sr.reminder_type = 'renewal_due_7_days'
       ${companyFilter}`,
    params
  );

  // Expired subscriptions
  const [[expiredRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_reminders sr
     WHERE sr.status = 'Active'
       AND sr.reminder_type IN ('expired', 'expires_today')
       ${companyFilter}`,
    params
  );

  // Failed invoice generations
  const [[failedInvoiceRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_reminders sr
     WHERE sr.status = 'Active'
       AND sr.reminder_type = 'invoice_generation_failed'
       ${companyFilter}`,
    params
  );

  // Failed payments
  const [[failedPaymentRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_reminders sr
     WHERE sr.status = 'Active'
       AND sr.reminder_type = 'payment_failed'
       ${companyFilter}`,
    params
  );

  // Total active reminders
  const [[totalRow]] = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_reminders sr
     WHERE sr.status = 'Active'
       ${companyFilter}`,
    params
  );

  return {
    renewals_due_today:       Number(renewalsTodayRow?.count || 0),
    renewals_due_this_week:   Number(renewalsWeekRow?.count || 0),
    expired_subscriptions:    Number(expiredRow?.count || 0),
    failed_invoice_generations: Number(failedInvoiceRow?.count || 0),
    failed_payments:          Number(failedPaymentRow?.count || 0),
    total_active:             Number(totalRow?.count || 0),
  };
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Create a new subscription reminder.
 * Prevents duplicates: won't create if an active reminder of the same type
 * already exists for the same subscription.
 */
async function createReminder({ subscriptionId, customerId, companyId, customerName, reminderType, priority, reminderDate, notes }) {
  // Duplicate prevention
  const [existing] = await pool.query(
    `SELECT reminder_id FROM subscription_reminders
     WHERE subscription_id = ? AND company_id = ? AND reminder_type = ? AND status = 'Active'`,
    [subscriptionId, companyId, reminderType]
  );

  if (existing.length > 0) {
    return { id: existing[0].reminder_id, created: false };
  }

  const effectivePriority = priority || REMINDER_PRIORITY_MAP[reminderType] || "Medium";
  const effectiveDate = reminderDate || new Date().toISOString().split("T")[0];

  const [result] = await pool.query(
    `INSERT INTO subscription_reminders
       (subscription_id, customer_id, company_id, customer_name, reminder_type, priority, reminder_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [subscriptionId, customerId, companyId || null, customerName || null, reminderType, effectivePriority, effectiveDate, notes || null]
  );

  // Push a notification to all Finance users so it appears in the notification bell
  try {
    const label = REMINDER_TYPE_LABELS[reminderType] || reminderType;
    const title = `Subscription Reminder: ${label}`;
    const message = customerName
      ? `${customerName} — ${label} (Sub #${subscriptionId})`
      : `Subscription #${subscriptionId} — ${label}`;

    const [financeUsers] = await pool.query(
      "SELECT user_id FROM user WHERE company_id = ? AND role_name = 'Finance' AND status = 1", [companyId]
    );

    for (const { user_id } of financeUsers) {
      await pool.query(
        `INSERT INTO notification (company_id, user_id, type, title, message, is_read, created_at)
         VALUES (?, ?, 'subscription_reminder', ?, ?, 0, NOW())`,
        [companyId, user_id, title, message]
      ).catch(() => {}); // non-fatal if notification table doesn't exist
    }
  } catch (_) {
    // Non-fatal — reminders still work even if notifications fail
  }

  return { id: result.insertId, created: true };
}

/**
 * Mark a reminder as completed.
 */
async function completeReminder(reminderId, userId) {
  await pool.query(
    `UPDATE subscription_reminders
     SET status = 'Completed', resolved_at = NOW(), resolved_by = ?
     WHERE reminder_id = ? AND status = 'Active'`,
    [userId || null, reminderId]
  );
}

/**
 * Dismiss a reminder.
 */
async function dismissReminder(reminderId, userId) {
  await pool.query(
    `UPDATE subscription_reminders
     SET status = 'Dismissed', resolved_at = NOW(), resolved_by = ?
     WHERE reminder_id = ? AND status = 'Active'`,
    [userId || null, reminderId]
  );
}

/**
 * Auto-resolve reminders for a subscription when the underlying issue is fixed.
 * For example, when a paused subscription is resumed, resolve the "subscription_paused" reminder.
 */
async function autoResolveReminders(subscriptionId, reminderTypes) {
  if (!Array.isArray(reminderTypes) || reminderTypes.length === 0) return;

  const placeholders = reminderTypes.map(() => "?").join(",");
  await pool.query(
    `UPDATE subscription_reminders
     SET status = 'Completed', resolved_at = NOW(), notes = CONCAT(IFNULL(notes, ''), ' [Auto-resolved]')
     WHERE subscription_id = ? AND reminder_type IN (${placeholders}) AND status = 'Active'`,
    [subscriptionId, ...reminderTypes]
  );
}

/**
 * Generate reminders based on current subscription states.
 * Called by the subscription reminder scheduler (cron job).
 */
async function generateScheduledReminders(companyId) {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const weekAhead = sevenDaysFromNow.toISOString().split("T")[0];

  const companyFilter = companyId ? "AND s.company_id = ?" : "";
  const params = companyId ? [companyId] : [];

  let created = 0;

  // 1. Renewal due within 7 days (active subs with end_date approaching)
  const [renewalDue] = await pool.query(
    `SELECT s.subscription_id, s.customer_id, s.company_id, s.plan_name,
            c.name AS customer_name, s.end_date
     FROM subscriptions s
     LEFT JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Active'
       AND s.end_date IS NOT NULL
       AND s.end_date BETWEEN ? AND ?
       AND s.auto_renew = 1
       ${companyFilter}`,
    [today, weekAhead, ...params]
  );

  for (const sub of renewalDue) {
    const result = await createReminder({
      subscriptionId: sub.subscription_id,
      customerId:     sub.customer_id,
      companyId:      sub.company_id,
      customerName:   sub.customer_name,
      reminderType:   "renewal_due_7_days",
      reminderDate:   sub.end_date,
    });
    if (result.created) created++;
  }

  // 2. Expires today
  const [expiresToday] = await pool.query(
    `SELECT s.subscription_id, s.customer_id, s.company_id, s.plan_name,
            c.name AS customer_name
     FROM subscriptions s
     LEFT JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Active'
       AND s.end_date = ?
       AND s.auto_renew = 0
       ${companyFilter}`,
    [today, ...params]
  );

  for (const sub of expiresToday) {
    const result = await createReminder({
      subscriptionId: sub.subscription_id,
      customerId:     sub.customer_id,
      companyId:      sub.company_id,
      customerName:   sub.customer_name,
      reminderType:   "expires_today",
      reminderDate:   today,
    });
    if (result.created) created++;
  }

  // 3. Expired subscriptions (end_date passed, still marked Active)
  const [expired] = await pool.query(
    `SELECT s.subscription_id, s.customer_id, s.company_id, s.plan_name,
            c.name AS customer_name
     FROM subscriptions s
     LEFT JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Expired'
       AND s.end_date < ?
       ${companyFilter}`,
    [today, ...params]
  );

  for (const sub of expired) {
    const result = await createReminder({
      subscriptionId: sub.subscription_id,
      customerId:     sub.customer_id,
      companyId:      sub.company_id,
      customerName:   sub.customer_name,
      reminderType:   "expired",
      reminderDate:   today,
    });
    if (result.created) created++;
  }

  // 4. Billing today (next_billing_date = today)
  const [billingToday] = await pool.query(
    `SELECT s.subscription_id, s.customer_id, s.company_id, s.plan_name,
            c.name AS customer_name
     FROM subscriptions s
     LEFT JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Active'
       AND s.next_billing_date = ?
       ${companyFilter}`,
    [today, ...params]
  );

  for (const sub of billingToday) {
    const result = await createReminder({
      subscriptionId: sub.subscription_id,
      customerId:     sub.customer_id,
      companyId:      sub.company_id,
      customerName:   sub.customer_name,
      reminderType:   "billing_today",
      reminderDate:   today,
    });
    if (result.created) created++;
  }

  // 5. Auto-renew disabled (active subs with end_date and auto_renew = 0)
  const [autoRenewOff] = await pool.query(
    `SELECT s.subscription_id, s.customer_id, s.company_id, s.plan_name,
            c.name AS customer_name
     FROM subscriptions s
     LEFT JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Active'
       AND s.auto_renew = 0
       AND s.end_date IS NOT NULL
       AND s.end_date BETWEEN ? AND ?
       ${companyFilter}`,
    [today, weekAhead, ...params]
  );

  for (const sub of autoRenewOff) {
    const result = await createReminder({
      subscriptionId: sub.subscription_id,
      customerId:     sub.customer_id,
      companyId:      sub.company_id,
      customerName:   sub.customer_name,
      reminderType:   "auto_renew_disabled",
      reminderDate:   today,
    });
    if (result.created) created++;
  }

  // 6. Paused subscriptions
  const [paused] = await pool.query(
    `SELECT s.subscription_id, s.customer_id, s.company_id, s.plan_name,
            c.name AS customer_name
     FROM subscriptions s
     LEFT JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.status = 'Paused'
       ${companyFilter}`,
    params
  );

  for (const sub of paused) {
    const result = await createReminder({
      subscriptionId: sub.subscription_id,
      customerId:     sub.customer_id,
      companyId:      sub.company_id,
      customerName:   sub.customer_name,
      reminderType:   "subscription_paused",
      reminderDate:   today,
    });
    if (result.created) created++;
  }

  return { created };
}

module.exports = {
  REMINDER_PRIORITY_MAP,
  REMINDER_TYPE_LABELS,
  findAllReminders,
  findReminderById,
  getReminderDashboardSummary,
  createReminder,
  completeReminder,
  dismissReminder,
  autoResolveReminders,
  generateScheduledReminders,
};
