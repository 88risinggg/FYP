/**
 * Audit Log Model
 *
 * Database queries for the audit trail system.
 * Tracks all significant actions across the application.
 */

const { pool } = require("../config/db");

/**
 * Insert an audit log entry.
 *
 * @param {Object} connection - MySQL connection.
 * @param {string} action - The action performed (e.g. "invoice_created", "invoice_status:Paid").
 * @param {string} entityType - The entity type (e.g. "invoice", "payment", "bulk_upload").
 * @param {number|null} entityId - The primary key of the affected entity.
 * @param {number|null} userId - The user who performed the action.
 */
async function insertAuditLog(connection, action, entityType, entityId, userId) {
  await connection.query(
    "INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)",
    [action, entityType, entityId, userId || null]
  );
}

/**
 * Fetch audit logs with optional filters, ordered by most recent first.
 *
 * @param {Object} filters - { action?, entityType?, entityId?, userId?, limit? }
 * @returns {Object[]} Array of audit log rows.
 */
async function findAuditLogs(filters = {}) {
  let sql = "SELECT log_id, action, entity_type, entity_id, user_user_id, timestamp FROM audit_log WHERE 1=1";
  const params = [];

  if (filters.action) {
    sql += " AND action LIKE ?";
    params.push(`%${filters.action}%`);
  }
  if (filters.entityType) {
    sql += " AND entity_type = ?";
    params.push(filters.entityType);
  }
  if (filters.entityId) {
    sql += " AND entity_id = ?";
    params.push(filters.entityId);
  }
  if (filters.userId) {
    sql += " AND user_user_id = ?";
    params.push(filters.userId);
  }

  sql += " ORDER BY timestamp DESC, log_id DESC";
  sql += ` LIMIT ${Number(filters.limit) || 100}`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = {
  findAuditLogs,
  insertAuditLog
};
