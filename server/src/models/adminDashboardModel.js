const { pool } = require("../config/db");

function isMissingTableError(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";
}

async function safeQuery(query, params = [], fallback) {
  try {
    const [rows] = await pool.execute(query, params);
    return { rows, missing: false };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { rows: fallback, missing: true };
    }

    throw error;
  }
}

const dashboardInvoiceStatuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];

function normalizeInvoiceStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  const match = dashboardInvoiceStatuses.find((item) => item.toLowerCase() === normalized);

  return match || null;
}

function buildInvoiceStatusDistribution(rows) {
  const counts = dashboardInvoiceStatuses.reduce((items, status) => {
    items[status] = 0;
    return items;
  }, {});

  rows.forEach((row) => {
    const status = normalizeInvoiceStatus(row.status);
    if (status) {
      counts[status] += Number(row.count || 0);
    }
  });

  const total = dashboardInvoiceStatuses.reduce((sum, status) => sum + counts[status], 0);

  return dashboardInvoiceStatuses.map((status) => ({
    status,
    count: counts[status],
    percentage: total > 0 ? Math.round((counts[status] / total) * 100) : 0
  }));
}

async function getAdminDashboardData() {
  const missingTables = new Set();

  const totalUsersResult = await safeQuery(
    "SELECT COUNT(*) AS totalUsers FROM user",
    [],
    [{ totalUsers: 0 }]
  );
  if (totalUsersResult.missing) missingTables.add("user");

  const invoiceCountsResult = await safeQuery(
    `SELECT
      SUM(LOWER(status) IN ('draft', 'sent', 'viewed', 'overdue')) AS activeInvoices,
      SUM(LOWER(status) = 'overdue') AS overdueInvoices
     FROM invoice`,
    [],
    [{ activeInvoices: 0, overdueInvoices: 0 }]
  );
  if (invoiceCountsResult.missing) missingTables.add("invoice");

  const statusDistributionResult = await safeQuery(
    `SELECT status, COUNT(*) AS count
     FROM invoice
     GROUP BY status
     ORDER BY status`,
    [],
    []
  );
  if (statusDistributionResult.missing) missingTables.add("invoice");

  const reminderJobsResult = await safeQuery(
    "SELECT COUNT(*) AS reminderJobs FROM reminder_settings WHERE is_enabled = 1",
    [],
    [{ reminderJobs: 0 }]
  );
  if (reminderJobsResult.missing) missingTables.add("reminder_settings");

  const auditCountResult = await safeQuery(
    "SELECT COUNT(*) AS auditEventsToday FROM audit_log WHERE DATE(created_at) = CURDATE()",
    [],
    [{ auditEventsToday: 0 }]
  );
  if (auditCountResult.missing) missingTables.add("audit_log");

  const recentActivitiesResult = await safeQuery(
    `SELECT
      audit_log.log_id AS id,
      audit_log.action,
      audit_log.entity_type AS entityType,
      audit_log.entity_id AS entityId,
      audit_log.created_at AS createdAt,
      user.name AS actorName
     FROM audit_log
     LEFT JOIN user ON audit_log.user_user_id = user.user_id
     ORDER BY audit_log.created_at DESC, audit_log.log_id DESC
     LIMIT 8`,
    [],
    []
  );
  if (recentActivitiesResult.missing) missingTables.add("audit_log");

  const upcomingReminderResult = await safeQuery(
    `SELECT
      reminder_setting_id AS id,
      rule_name AS ruleName,
      frequency,
      reminder_time AS reminderTime,
      timezone,
      delivery_channel AS deliveryChannel,
      is_enabled AS enabled
     FROM reminder_settings
     WHERE is_enabled = 1
     ORDER BY reminder_time ASC, reminder_setting_id DESC
     LIMIT 6`,
    [],
    []
  );
  if (upcomingReminderResult.missing) missingTables.add("reminder_settings");

  const invoiceCounts = invoiceCountsResult.rows[0] || {};

  return {
    totalUsers: Number(totalUsersResult.rows[0]?.totalUsers || 0),
    activeInvoices: Number(invoiceCounts.activeInvoices || 0),
    overdueInvoices: Number(invoiceCounts.overdueInvoices || 0),
    reminderJobs: Number(reminderJobsResult.rows[0]?.reminderJobs || 0),
    auditEventsToday: Number(auditCountResult.rows[0]?.auditEventsToday || 0),
    invoiceStatusDistribution: buildInvoiceStatusDistribution(statusDistributionResult.rows),
    recentActivities: recentActivitiesResult.rows.map((row) => ({
      id: row.id,
      action: row.action || "System activity",
      entityType: row.entityType || "System",
      entityId: row.entityId,
      actorName: row.actorName || "System",
      createdAt: row.createdAt
    })),
    upcomingReminderSchedule: upcomingReminderResult.rows.map((row) => ({
      id: row.id,
      ruleName: row.ruleName,
      frequency: row.frequency,
      reminderTime: row.reminderTime,
      timezone: row.timezone,
      deliveryChannel: row.deliveryChannel,
      enabled: Boolean(row.enabled)
    })),
    missingTables: Array.from(missingTables)
  };
}

module.exports = {
  getAdminDashboardData
};
