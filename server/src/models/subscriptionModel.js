/**
 * Subscription Model
 *
 * Data-access layer for the subscriptions table.
 * All queries are company-scoped for multi-tenant safety.
 * Never perform business logic here — keep it pure SQL.
 */

const { pool } = require("../config/db");

// ─── Billing frequency → interval helper ──────────────────────────────────────

const FREQUENCY_INTERVALS = {
  Weekly:    { unit: "week",  value: 1 },
  Monthly:   { unit: "month", value: 1 },
  Quarterly: { unit: "month", value: 3 },
  Yearly:    { unit: "year",  value: 1 },
};

/**
 * Calculate the next billing date from a given date + frequency.
 *
 * @param {Date|string} fromDate  - Reference date (usually current next_billing_date).
 * @param {string}      frequency - "Weekly" | "Monthly" | "Quarterly" | "Yearly"
 * @returns {Date} Next billing date as a JS Date.
 */
function calcNextBillingDate(fromDate, frequency) {
  const base = new Date(fromDate);
  const { unit, value } = FREQUENCY_INTERVALS[frequency] || FREQUENCY_INTERVALS.Monthly;

  if (unit === "week")  base.setDate(base.getDate() + value * 7);
  if (unit === "month") base.setMonth(base.getMonth() + value);
  if (unit === "year")  base.setFullYear(base.getFullYear() + value);

  return base;
}

/**
 * Format a JS Date to "YYYY-MM-DD" string for MySQL DATE columns.
 *
 * @param {Date|string} date
 * @returns {string}
 */
function toDateString(date) {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch all subscriptions for a company, joined with the customer name/email.
 *
 * @param {number|null} companyId
 * @param {object}      [filters]  - { status, customerId, frequency }
 * @returns {Promise<Array>}
 */
async function findAllSubscriptions(companyId, filters = {}) {
  const conditions = [];
  const params = [];

  if (companyId) {
    conditions.push("s.company_id = ?");
    params.push(companyId);
  }

  if (filters.status) {
    conditions.push("s.status = ?");
    params.push(filters.status);
  }

  if (filters.customerId) {
    conditions.push("s.customer_id = ?");
    params.push(Number(filters.customerId));
  }

  if (filters.frequency) {
    conditions.push("s.billing_frequency = ?");
    params.push(filters.frequency);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT
       s.subscription_id,
       s.customer_id,
       s.company_id,
       s.plan_name,
       s.description,
       s.amount,
       s.billing_frequency,
       s.start_date,
       s.next_billing_date,
       s.end_date,
       s.auto_renew,
       s.auto_send,
       s.status,
       s.cancelled_at,
       s.paused_at,
       s.created_by,
       s.created_at,
       s.updated_at,
       c.name  AS customer_name,
       c.email AS customer_email,
       c.address AS customer_address,
       (SELECT COUNT(*) FROM invoice i WHERE i.subscription_id = s.subscription_id) AS invoice_count
     FROM subscriptions s
     INNER JOIN customer c ON c.customer_id = s.customer_id
     ${where}
     ORDER BY s.created_at DESC`,
    params
  );

  return rows;
}

/**
 * Fetch a single subscription by ID (company-scoped).
 *
 * @param {number}      subscriptionId
 * @param {number|null} companyId
 * @returns {Promise<object|null>}
 */
async function findSubscriptionById(subscriptionId, companyId) {
  const [rows] = await pool.query(
    `SELECT
       s.*,
       c.name    AS customer_name,
       c.email   AS customer_email,
       c.address AS customer_address
     FROM subscriptions s
     INNER JOIN customer c ON c.customer_id = s.customer_id
     WHERE s.subscription_id = ?
       ${companyId ? "AND s.company_id = ?" : ""}
     LIMIT 1`,
    companyId ? [subscriptionId, companyId] : [subscriptionId]
  );

  return rows[0] || null;
}

/**
 * Fetch all invoices generated for a subscription.
 *
 * @param {number}      subscriptionId
 * @param {number|null} companyId
 * @returns {Promise<Array>}
 */
async function findSubscriptionInvoices(subscriptionId, companyId) {
  const [rows] = await pool.query(
    `SELECT
       i.invoice_id,
       i.invoiceId,
       i.issue_date,
       i.due_date,
       i.total_amount,
       i.status,
       i.created_at,
       c.name  AS customer_name,
       c.email AS customer_email
     FROM invoice i
     INNER JOIN customer c ON c.customer_id = i.customer_id
     WHERE i.subscription_id = ?
       ${companyId ? "AND i.company_id = ?" : ""}
     ORDER BY i.created_at DESC`,
    companyId ? [subscriptionId, companyId] : [subscriptionId]
  );

  return rows;
}

/**
 * Fetch all payment records for invoices linked to a subscription.
 *
 * @param {number}      subscriptionId
 * @param {number|null} companyId
 * @returns {Promise<Array>}
 */
async function findSubscriptionPayments(subscriptionId, companyId) {
  const [rows] = await pool.query(
    `SELECT
       p.payment_id,
       p.invoice_invoice_id AS invoice_id,
       i.invoiceId,
       p.amount,
       p.status,
       p.payment_method_name AS payment_method,
       p.transaction_id,
       p.created_at AS payment_date
     FROM payment p
     INNER JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
     WHERE i.subscription_id = ?
       ${companyId ? "AND i.company_id = ?" : ""}
     ORDER BY p.created_at DESC`,
    companyId ? [subscriptionId, companyId] : [subscriptionId]
  );

  return rows;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

/**
 * Insert a new subscription row.
 *
 * @param {object} data - Validated subscription payload.
 * @returns {Promise<number>} insertId
 */
async function createSubscription(data) {
  const [result] = await pool.query(
    `INSERT INTO subscriptions
       (customer_id, company_id, plan_name, description, amount,
        billing_frequency, start_date, next_billing_date, end_date,
        auto_renew, auto_send, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
    [
      data.customer_id,
      data.company_id   || null,
      data.plan_name,
      data.description  || null,
      data.amount,
      data.billing_frequency,
      data.start_date,
      data.next_billing_date,
      data.end_date     || null,
      data.auto_renew   ? 1 : 0,
      data.auto_send    ? 1 : 0,
      data.created_by   || null,
    ]
  );

  return result.insertId;
}

/**
 * Update mutable subscription fields.
 *
 * @param {number} subscriptionId
 * @param {object} data
 * @returns {Promise<void>}
 */
async function updateSubscription(subscriptionId, data) {
  await pool.query(
    `UPDATE subscriptions
     SET plan_name         = ?,
         description       = ?,
         amount            = ?,
         billing_frequency = ?,
         start_date        = ?,
         next_billing_date = ?,
         end_date          = ?,
         auto_renew        = ?,
         auto_send         = ?,
         updated_at        = NOW()
     WHERE subscription_id = ?`,
    [
      data.plan_name,
      data.description  || null,
      data.amount,
      data.billing_frequency,
      data.start_date,
      data.next_billing_date,
      data.end_date     || null,
      data.auto_renew   ? 1 : 0,
      data.auto_send    ? 1 : 0,
      subscriptionId,
    ]
  );
}

/**
 * Pause a subscription.
 *
 * @param {number} subscriptionId
 * @returns {Promise<void>}
 */
async function pauseSubscription(subscriptionId) {
  await pool.query(
    `UPDATE subscriptions
     SET status = 'Paused', paused_at = NOW(), updated_at = NOW()
     WHERE subscription_id = ? AND status = 'Active'`,
    [subscriptionId]
  );
}

/**
 * Resume a paused subscription.
 *
 * @param {number} subscriptionId
 * @returns {Promise<void>}
 */
async function resumeSubscription(subscriptionId) {
  await pool.query(
    `UPDATE subscriptions
     SET status = 'Active', paused_at = NULL, updated_at = NOW()
     WHERE subscription_id = ? AND status = 'Paused'`,
    [subscriptionId]
  );
}

/**
 * Cancel a subscription.
 *
 * @param {number} subscriptionId
 * @returns {Promise<void>}
 */
async function cancelSubscription(subscriptionId) {
  await pool.query(
    `UPDATE subscriptions
     SET status = 'Cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE subscription_id = ? AND status IN ('Active','Paused')`,
    [subscriptionId]
  );
}

/**
 * Advance next_billing_date after a successful invoice generation.
 * Automatically marks the subscription as Expired if end_date has passed
 * after advancing the date.
 *
 * @param {number} subscriptionId
 * @param {string} frequency
 * @param {string} currentNextBillingDate - "YYYY-MM-DD"
 * @returns {Promise<string>} The new next_billing_date string.
 */
async function advanceNextBillingDate(subscriptionId, frequency, currentNextBillingDate) {
  const next = calcNextBillingDate(currentNextBillingDate, frequency);
  const nextStr = toDateString(next);

  await pool.query(
    `UPDATE subscriptions
     SET next_billing_date = ?,
         updated_at = NOW()
     WHERE subscription_id = ?`,
    [nextStr, subscriptionId]
  );

  // If subscription has an end_date and next billing date exceeds it, expire it
  await pool.query(
    `UPDATE subscriptions
     SET status = 'Expired', updated_at = NOW()
     WHERE subscription_id = ?
       AND end_date IS NOT NULL
       AND next_billing_date > end_date
       AND status = 'Active'`,
    [subscriptionId]
  );

  return nextStr;
}

/**
 * Check for duplicate active subscriptions (same customer + plan).
 *
 * @param {number}      customerId
 * @param {string}      planName
 * @param {number|null} excludeId   - subscription_id to exclude from the check (for updates).
 * @param {number|null} companyId
 * @returns {Promise<boolean>} true if duplicate found.
 */
async function hasDuplicateActiveSubscription(customerId, planName, excludeId, companyId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM subscriptions
     WHERE customer_id = ?
       AND plan_name   = ?
       AND status      = 'Active'
       ${excludeId ? "AND subscription_id <> ?" : ""}
       ${companyId ? "AND company_id = ?"      : ""}`,
    [
      customerId,
      planName,
      ...(excludeId ? [excludeId] : []),
      ...(companyId ? [companyId] : []),
    ]
  );

  return Number(rows[0]?.count || 0) > 0;
}

// ─── Dashboard aggregate queries ──────────────────────────────────────────────

/**
 * Return metrics for the subscription dashboard.
 *
 * @param {number|null} companyId
 * @returns {Promise<object>}
 */
async function getSubscriptionDashboardMetrics(companyId) {
  const scope = companyId ? "AND s.company_id = ?" : "";
  const p     = companyId ? [companyId]            : [];

  const [[statusCounts]] = await pool.query(
    `SELECT
       SUM(s.status = 'Active')    AS active_count,
       SUM(s.status = 'Paused')    AS paused_count,
       SUM(s.status = 'Cancelled') AS cancelled_count,
       SUM(s.status = 'Expired')   AS expired_count
     FROM subscriptions s
     WHERE 1=1 ${scope}`,
    p
  );

  // MRR: sum of Active subscriptions normalised to monthly value
  const [[mrrRow]] = await pool.query(
    `SELECT
       SUM(
         CASE billing_frequency
           WHEN 'Weekly'    THEN amount * 4.33
           WHEN 'Monthly'   THEN amount
           WHEN 'Quarterly' THEN amount / 3
           WHEN 'Yearly'    THEN amount / 12
           ELSE 0
         END
       ) AS mrr
     FROM subscriptions
     WHERE status = 'Active' ${companyId ? "AND company_id = ?" : ""}`,
    p
  );

  // Upcoming renewals within 7 days
  const [[upcomingRow]] = await pool.query(
    `SELECT COUNT(*) AS upcoming
     FROM subscriptions
     WHERE status = 'Active'
       AND next_billing_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       ${companyId ? "AND company_id = ?" : ""}`,
    p
  );

  // Revenue by plan (top 10)
  const [byPlan] = await pool.query(
    `SELECT
       plan_name,
       COUNT(*)  AS subscription_count,
       SUM(CASE billing_frequency
         WHEN 'Weekly'    THEN amount * 4.33
         WHEN 'Monthly'   THEN amount
         WHEN 'Quarterly' THEN amount / 3
         WHEN 'Yearly'    THEN amount / 12
         ELSE 0 END)       AS monthly_revenue
     FROM subscriptions
     WHERE status = 'Active' ${companyId ? "AND company_id = ?" : ""}
     GROUP BY plan_name
     ORDER BY monthly_revenue DESC
     LIMIT 10`,
    p
  );

  // Overdue subscription invoices (draft invoices past due)
  const [[overdueRow]] = await pool.query(
    `SELECT COUNT(DISTINCT i.invoice_id) AS overdue_count
     FROM invoice i
     INNER JOIN subscriptions s ON s.subscription_id = i.subscription_id
     WHERE i.status = 'Overdue'
       ${companyId ? "AND i.company_id = ?" : ""}`,
    p
  );

  const mrr = Number(mrrRow?.mrr || 0);

  return {
    active_count:    Number(statusCounts?.active_count    || 0),
    paused_count:    Number(statusCounts?.paused_count    || 0),
    cancelled_count: Number(statusCounts?.cancelled_count || 0),
    expired_count:   Number(statusCounts?.expired_count   || 0),
    mrr:             mrr,
    arr:             mrr * 12,
    upcoming_renewals: Number(upcomingRow?.upcoming   || 0),
    overdue_invoices:  Number(overdueRow?.overdue_count || 0),
    revenue_by_plan:   byPlan,
  };
}

module.exports = {
  // Frequency / date utils
  calcNextBillingDate,
  toDateString,
  FREQUENCY_INTERVALS,

  // Read
  findAllSubscriptions,
  findSubscriptionById,
  findSubscriptionInvoices,
  findSubscriptionPayments,
  getSubscriptionDashboardMetrics,

  // Write
  createSubscription,
  updateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  advanceNextBillingDate,

  // Validation
  hasDuplicateActiveSubscription,
};
