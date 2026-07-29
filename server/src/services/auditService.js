/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable audit Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * auditService.js — Central Audit Logging Service
 *
 * All audit log writes go through this service.
 * Every record is tagged with a module so each module only shows its own logs.
 *
 * Modules: Invoice | Payroll | HR | Claims | Settings | Auth | System
 */

const { pool } = require("../config/db");
const { currentCompanyId } = require("./tenantContext");

function tenantId(explicitCompanyId) {
  if (Number(explicitCompanyId) > 0) return Number(explicitCompanyId);
  try { return currentCompanyId(); } catch { return null; }
}

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
    return _insert(opts.connection || null, {
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
      companyId:       tenantId(opts.companyId),
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
    companyId:     tenantId(extra.companyId),
  });
}

async function _insert(conn, opts) {
  const sql = `
    INSERT INTO audit_logs
      (company_id, user_id, user_name, module, activity_type, action_description, affected_record,
       status, created_at, previous_value, new_value, ip_address, device_info, entity_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
  `;
  const params = [
    opts.companyId || null,
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
  const where = ["a.company_id = ?"];
  const params = [currentCompanyId()];

  if (filters.module) {
    where.push("a.module = ?");
    params.push(filters.module);
  }

  if (filters.startDate) {
    where.push("DATE(a.created_at) >= ?");
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    where.push("DATE(a.created_at) <= ?");
    params.push(filters.endDate);
  }

  if (filters.userId) {
    where.push("a.user_id = ?");
    params.push(Number(filters.userId));
  }

  if (filters.activityType) {
    where.push("a.activity_type = ?");
    params.push(filters.activityType);
  }

  if (filters.keyword) {
    where.push("(a.action_description LIKE ? OR a.affected_record LIKE ? OR COALESCE(u.name, a.user_name) LIKE ?)");
    const kw = `%${filters.keyword}%`;
    params.push(kw, kw, kw);
  }
  if (filters.status) {
    where.push("a.status = ?");
    params.push(filters.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const page  = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs a LEFT JOIN user u ON u.user_id = a.user_id ${whereSql}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       a.audit_log_id  AS id,
       a.user_id       AS userId,
       COALESCE(u.name, NULLIF(a.user_name, ''), 'System') AS userName,
       a.module,
       a.activity_type AS activityType,
       a.action_description AS actionDescription,
       a.affected_record    AS affectedRecord,
       a.entity_type        AS entityType,
       a.status,
       a.ip_address    AS ipAddress,
       a.device_info   AS deviceInfo,
       a.previous_value AS previousValue,
       a.new_value      AS newValue,
       a.created_at    AS createdAt
     FROM audit_logs a
     LEFT JOIN user u ON u.user_id = a.user_id
     ${whereSql}
     ORDER BY a.created_at DESC, a.audit_log_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total: Number(total), page, limit };
}

/**
 * getAuditSummary — module-aware summary stats.
 */
async function getAuditSummary(module) {
  const companyId = currentCompanyId();
  const moduleWhere = `WHERE company_id = ?${module ? " AND module = ?" : ""}`;
  const moduleParams = module ? [companyId, module] : [companyId];

  const [rows] = await pool.query(
    `SELECT activity_type, COUNT(*) AS cnt FROM audit_logs ${moduleWhere} GROUP BY activity_type ORDER BY cnt DESC`,
    moduleParams
  );

  const [todayRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM audit_logs WHERE company_id=? AND DATE(created_at) = CURDATE() ${module ? "AND module = ?" : ""}`,
    module ? [companyId, module] : [companyId]
  );

  const [totalRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM audit_logs ${moduleWhere}`,
    moduleParams
  );
  const [riskRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM audit_logs WHERE company_id=? AND LOWER(status) IN ('failed', 'failure', 'warning', 'error') ${module ? "AND module = ?" : ""}`,
    module ? [companyId, module] : [companyId]
  );
  const [actorRows] = await pool.query(
    `SELECT COUNT(DISTINCT user_id) AS cnt FROM audit_logs ${moduleWhere}`,
    moduleParams
  );

  return {
    totalLogs:       Number(totalRows[0]?.cnt || 0),
    totalEventsToday: Number(todayRows[0]?.cnt || 0),
    warningFailureEvents: Number(riskRows[0]?.cnt || 0),
    uniqueActors: Number(actorRows[0]?.cnt || 0),
    activityBreakdown: rows.map(r => ({ activityType: r.activity_type, count: Number(r.cnt) })),
    retentionMonths: 12,
  };
}

async function getDistinctModules() {
  const [rows] = await pool.query("SELECT DISTINCT module FROM audit_logs WHERE company_id=? AND module IS NOT NULL AND module <> '' ORDER BY module", [currentCompanyId()]);
  return rows.map((row) => row.module);
}

/**
 * getDistinctUsers — users who have created audit log entries (module-filtered).
 */
async function getDistinctUsers(module) {
  const where = `WHERE a.company_id=?${module ? " AND a.module = ?" : ""}`;
  const [rows] = await pool.query(
    `SELECT DISTINCT a.user_id AS userId, COALESCE(u.name, NULLIF(a.user_name, ''), 'System') AS name
     FROM audit_logs a LEFT JOIN user u ON u.user_id = a.user_id ${where} ORDER BY name`,
    module ? [currentCompanyId(), module] : [currentCompanyId()]
  );
  return rows.filter(r => r.userId);
}

/**
 * getDistinctActivityTypes — distinct activity_type values (module-filtered).
 */
async function getDistinctActivityTypes(module) {
  const where = `WHERE company_id=?${module ? " AND module = ?" : ""}`;
  const [rows] = await pool.query(
    `SELECT DISTINCT activity_type FROM audit_logs ${where} ORDER BY activity_type`,
    module ? [currentCompanyId(), module] : [currentCompanyId()]
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
  getDistinctModules,
};
