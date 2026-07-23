const { pool } = require("../config/db");
const { inferModule, writeAuditLog } = require("../services/auditService");

function isMissingAuditTable(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

async function tableExists(tableName) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS tableCount
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );

  return Number(rows[0]?.tableCount || 0) > 0;
}

async function logAuditEvent({
  userId = null,
  userName = "System",
  module = null,
  activityType,
  actionDescription,
  affectedRecord = null,
  entityType = null,
  status = "Info",
  ipAddress = null,
  deviceInfo = null,
  previousValue = null,
  newValue = null
}) {
  return writeAuditLog({
    module: module || inferModule(activityType),
    activityType,
    action: actionDescription,
    entityId: affectedRecord,
    entityType: entityType || String(activityType || "system").trim().toLowerCase().replaceAll(" ", "_"),
    userId,
    userName,
    status,
    ipAddress,
    deviceInfo,
    previousValue,
    newValue
  });
}

function getDeviceInfo(req) {
  return String(req.headers["user-agent"] || "").slice(0, 500) || null;
}

function buildAuditFilters(filters) {
  const where = [];
  const params = [];

  if (filters.startDate) {
    where.push("DATE(created_at) >= ?");
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    where.push("DATE(created_at) <= ?");
    params.push(filters.endDate);
  }

  if (filters.userId) {
    where.push("user_id = ?");
    params.push(Number(filters.userId));
  }

  if (filters.activityType) {
    where.push("activity_type = ?");
    params.push(filters.activityType);
  }

  if (filters.keyword) {
    where.push("(action_description LIKE ? OR affected_record LIKE ? OR user_name LIKE ?)");
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
}

function buildLegacyAuditFilters(filters) {
  const where = [];
  const params = [];

  if (filters.startDate) {
    where.push("DATE(audit_log.created_at) >= ?");
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    where.push("DATE(audit_log.created_at) <= ?");
    params.push(filters.endDate);
  }

  if (filters.userId) {
    where.push("audit_log.user_user_id = ?");
    params.push(Number(filters.userId));
  }

  if (filters.activityType) {
    where.push("audit_log.entity_type = ?");
    params.push(filters.activityType);
  }

  if (filters.keyword) {
    where.push("(audit_log.action LIKE ? OR audit_log.entity_type LIKE ? OR user.name LIKE ?)");
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
}

async function listAuditLogs(filters = {}) {
  if (await tableExists("audit_logs")) {
    const { whereSql, params } = buildAuditFilters(filters);
    const [rows] = await pool.execute(
      `SELECT
        audit_log_id AS id,
        user_id AS userId,
        user_name AS userName,
        activity_type AS activityType,
        action_description AS actionDescription,
        affected_record AS affectedRecord,
        status,
        ip_address AS ipAddress,
        created_at AS createdAt
       FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC, audit_log_id DESC
       LIMIT 200`,
      params
    );

    return rows;
  }

  if (await tableExists("audit_log")) {
    const { whereSql, params } = buildLegacyAuditFilters(filters);
    const [rows] = await pool.execute(
      `SELECT
        audit_log.log_id AS id,
        audit_log.user_user_id AS userId,
        COALESCE(user.name, 'System') AS userName,
        COALESCE(audit_log.entity_type, 'System') AS activityType,
        COALESCE(audit_log.action, 'System activity') AS actionDescription,
        CAST(audit_log.entity_id AS CHAR) AS affectedRecord,
        'Info' AS status,
        NULL AS ipAddress,
        audit_log.created_at AS createdAt
       FROM audit_log
       LEFT JOIN user ON audit_log.user_user_id = user.user_id
       ${whereSql}
       ORDER BY audit_log.created_at DESC, audit_log.log_id DESC
       LIMIT 200`,
      params
    );

    return rows;
  }

  return [];
}

async function getAuditUsers() {
  try {
    const [rows] = await pool.execute(
      "SELECT user_id AS userId, name FROM user ORDER BY name"
    );
    return rows;
  } catch (error) {
    if (isMissingAuditTable(error)) return [];
    throw error;
  }
}

async function getActivityTypes() {
  if (await tableExists("audit_logs")) {
    const [rows] = await pool.execute(
      "SELECT DISTINCT activity_type AS activityType FROM audit_logs ORDER BY activity_type"
    );
    return rows.map((row) => row.activityType).filter(Boolean);
  }

  if (await tableExists("audit_log")) {
    const [rows] = await pool.execute(
      "SELECT DISTINCT entity_type AS activityType FROM audit_log ORDER BY entity_type"
    );
    return rows.map((row) => row.activityType).filter(Boolean);
  }

  return [];
}

async function getAuditSummary() {
  const logs = await listAuditLogs({});
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((log) => new Date(log.createdAt).toISOString().slice(0, 10) === today);

  const breakdown = logs.reduce((items, log) => {
    items[log.activityType] = (items[log.activityType] || 0) + 1;
    return items;
  }, {});

  return {
    totalLogs: logs.length,
    totalEventsToday: todayLogs.length,
    loginActivities: logs.filter((log) => log.activityType === "Login").length,
    invoiceUpdates: logs.filter((log) => log.activityType === "Invoice").length,
    userManagementActions: logs.filter((log) => log.activityType === "User Management").length,
    activityBreakdown: Object.entries(breakdown).map(([activityType, count]) => ({
      activityType,
      count
    })),
    retentionMonths: 12
  };
}

module.exports = {
  getActivityTypes,
  getAuditSummary,
  getAuditUsers,
  getClientIp,
  getDeviceInfo,
  listAuditLogs,
  logAuditEvent
};
