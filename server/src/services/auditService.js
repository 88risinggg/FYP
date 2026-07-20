/**
 * auditService.js — Central Audit Logging Service
 *
 * All audit log writes go through this service.
 * Every record is tagged with a module so each module only shows its own logs.
 *
 * Modules: Invoice | Payroll | HR | Claims | Settings | Auth | System
 */

const { pool } = require("../config/db");

// ─── Module constants ─────────────────────────────────────────────────────────
const MODULE = {
  INVOICE:  "Invoice",
  PAYROLL:  "Payroll",
  HR:       "HR",
  CLAIMS:   "Claims",
  SETTINGS: "Settings",
  AUTH:     "Auth",
  SYSTEM:   "System",
};

// ─── Infer module from legacy activity_type strings (for backfill / fallback) ─
const INVOICE_PATTERNS  = /^(invoice|payment|fraud|vaniday|bulk_invoice|stripe)/i;
const PAYROLL_PATTERNS  = /^(payroll|salary|cpf|payslip)/i;
const HR_PATTERNS       = /^(hr|staff|leave|employee|public_holiday)/i;
const CLAIMS_PATTERNS   = /^(claim|loan|advance)/i;
const SETTINGS_PATTERNS = /^(settings|role|user_management|user|company|backup)/i;
const AUTH_PATTERNS     = /^(login|logout|auth|otp|password|2fa|session)/i;

function inferModule(activityType) {
  if (!activityType) return MODULE.SYSTEM;
  if (INVOICE_PATTERNS.test(activityType))  return MODULE.INVOICE;
  if (PAYROLL_PATTERNS.test(activityType))  return MODULE.PAYROLL;
  if (HR_PATTERNS.test(activityType))       return MODULE.HR;
  if (CLAIMS_PATTERNS.test(activityType))   return MODULE.CLAIMS;
  if (SETTINGS_PATTERNS.test(activityType)) return MODULE.SETTINGS;
  if (AUTH_PATTERNS.test(activityType))     return MODULE.AUTH;
  return MODULE.SYSTEM;
}

/**
 * writeAuditLog — primary write function used by all modules.
 *
 * @param {object|PoolConnection} connOrOpts  - DB connection OR options object
 * @param {string}  [action]                  - action description (legacy positional)
 * @param {string}  [activityType]            - activity_type (legacy positional)
 * @param {number}  [entityId]               - affected record id (legacy positional)
 * @param {number}  [userId]                 - user id (legacy positional)
 * @param {object}  [extra]                  - extra fields { previousValue, newValue, ipAddress, deviceInfo, module, entityType }
 *
 * Supports two call signatures:
 *   1. Legacy: writeAuditLog(connection, action, activityType, entityId, userId, extra)
 *   2. New:    writeAuditLog({ module, action, activityType, entityId, userId, extra, ... })
 */
async function writeAuditLog(connOrOpts, action, activityType, entityId, userId, extra = {}) {
  // Detect new object-signature call
  if (connOrOpts && typeof connOrOpts === "object" && !connOrOpts.query && connOrOpts.module !== undefined) {
    const opts = connOrOpts;
    return _insert(null, {
      module:          opts.module || inferModule(opts.activityType),
      action:          opts.action || opts.actionDescription || "",
      activityType:    opts.activityType || opts.action || "",
      entityId:        opts.entityId || opts.affectedRecord || null,
      userId:          opts.userId || null,
      userName:        opts.userName || null,
      previousValue:   opts.previousValue || opts.extra?.previousValue || null,
      newValue:        opts.newValue || opts.extra?.newValue || null,
      ipAddress:       opts.ipAddress || opts.extra?.ipAddress || null,
      deviceInfo:      opts.deviceInfo || opts.extra?.deviceInfo || null,
      entityType:      opts.entityType || null,
      status:          opts.status || "Success",
    });
  }

  // Legacy positional signature: writeAuditLog(connection, action, activityType, entityId, userId, extra)
  const connection = connOrOpts;
  const mod = extra.module || inferModule(activityType);
  return _insert(connection, {
    module:        mod,
    action:        action,
    activityType:  activityType,
    entityId:      entityId,
    userId:        userId,
    userName:      extra.userName || null,
    previousValue: extra.previousValue || null,
    newValue:      extra.newValue || null,
    ipAddress:     extra.ipAddress || null,
    deviceInfo:    extra.deviceInfo || null,
    entityType:    extra.entityType || null,
    status:        "Success",
  });
}

async function _insert(conn, opts) {
  const sql = `
    INSERT INTO audit_logs
      (user_id, user_name, module, activity_type, action_description, affected_record,
       status, created_at, previous_value, new_value, ip_address, device_info, entity_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
  `;
  const params = [
    opts.userId   || null,
    opts.userName || null,
    opts.module   || MODULE.SYSTEM,
    opts.activityType || "",
    opts.action   || "",
    opts.entityId != null ? String(opts.entityId) : null,
    opts.status   || "Success",
    opts.previousValue || null,
    opts.newValue      || null,
    opts.ipAddress     || null,
    opts.deviceInfo    || null,
    opts.entityType    || null,
  ];

  try {
    if (conn && typeof conn.query === "function") {
      await conn.query(sql, params);
    } else {
      await pool.query(sql, params);
    }
  } catch {
    // Non-critical — never block the main operation
  }
}

/**
 * listAuditLogs — read with module + other filters.
 *
 * @param {object} filters
 *   module, startDate, endDate, userId, activityType, keyword, page, limit
 */
async function listAuditLogs(filters = {}) {
  const where = [];
  const params = [];

  if (filters.module) {
    where.push("module = ?");
    params.push(filters.module);
  }

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
    const kw = `%${filters.keyword}%`;
    params.push(kw, kw, kw);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const page  = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       audit_log_id  AS id,
       user_id       AS userId,
       user_name     AS userName,
       module,
       activity_type AS activityType,
       action_description AS actionDescription,
       affected_record    AS affectedRecord,
       entity_type        AS entityType,
       status,
       ip_address    AS ipAddress,
       device_info   AS deviceInfo,
       previous_value AS previousValue,
       new_value      AS newValue,
       created_at    AS createdAt
     FROM audit_logs
     ${whereSql}
     ORDER BY created_at DESC, audit_log_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total: Number(total), page, limit };
}

/**
 * getAuditSummary — module-aware summary stats.
 */
async function getAuditSummary(module) {
  const moduleWhere = module ? "WHERE module = ?" : "";
  const moduleParams = module ? [module] : [];

  const [rows] = await pool.query(
    `SELECT activity_type, COUNT(*) AS cnt FROM audit_logs ${moduleWhere} GROUP BY activity_type ORDER BY cnt DESC`,
    moduleParams
  );

  const [todayRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM audit_logs WHERE DATE(created_at) = CURDATE() ${module ? "AND module = ?" : ""}`,
    module ? [module] : []
  );

  const [totalRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM audit_logs ${moduleWhere}`,
    moduleParams
  );

  return {
    totalLogs:       Number(totalRows[0]?.cnt || 0),
    totalEventsToday: Number(todayRows[0]?.cnt || 0),
    activityBreakdown: rows.map(r => ({ activityType: r.activity_type, count: Number(r.cnt) })),
    retentionMonths: 12,
  };
}

/**
 * getDistinctUsers — users who have created audit log entries (module-filtered).
 */
async function getDistinctUsers(module) {
  const where = module ? "WHERE module = ?" : "";
  const [rows] = await pool.query(
    `SELECT DISTINCT user_id AS userId, user_name AS name FROM audit_logs ${where} ORDER BY user_name`,
    module ? [module] : []
  );
  return rows.filter(r => r.userId);
}

/**
 * getDistinctActivityTypes — distinct activity_type values (module-filtered).
 */
async function getDistinctActivityTypes(module) {
  const where = module ? "WHERE module = ?" : "";
  const [rows] = await pool.query(
    `SELECT DISTINCT activity_type FROM audit_logs ${where} ORDER BY activity_type`,
    module ? [module] : []
  );
  return rows.map(r => r.activity_type).filter(Boolean);
}

module.exports = {
  MODULE,
  inferModule,
  writeAuditLog,
  listAuditLogs,
  getAuditSummary,
  getDistinctUsers,
  getDistinctActivityTypes,
};
