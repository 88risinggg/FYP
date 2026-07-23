/**
 * auditLogController.js
 *
 * Serves module-filtered audit log endpoints.
 * GET /api/audit-logs?module=Invoice&page=1&limit=50&keyword=...
 * GET /api/audit-logs/summary?module=Invoice
 * GET /api/audit-logs/export?module=Invoice
 *
 * Also mounts at /api/admin/invoicing/audit-logs (legacy Admin Invoice path).
 */

const {
  listAuditLogs,
  getAuditSummary,
  getDistinctUsers,
  getDistinctActivityTypes,
  getDistinctModules,
} = require("../services/auditService");

function normalizeFilters(query) {
  return {
    module:       String(query.module       || "").trim(),
    startDate:    String(query.startDate    || "").trim(),
    endDate:      String(query.endDate      || "").trim(),
    userId:       String(query.userId       || "").trim(),
    activityType: String(query.activityType || "").trim(),
    status:       String(query.status       || "").trim(),
    keyword:      String(query.keyword      || "").trim(),
    page:         Number(query.page)  || 1,
    limit:        Number(query.limit) || 50,
  };
}

function toCsvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function getAuditLogs(req, res) {
  try {
    const filters = normalizeFilters(req.query);
    const [result, users, activityTypes, modules] = await Promise.all([
      listAuditLogs(filters),
      getDistinctUsers(filters.module || null),
      getDistinctActivityTypes(filters.module || null),
      getDistinctModules(),
    ]);

    res.json({
      logs:          result.rows,
      total:         result.total,
      page:          result.page,
      limit:         result.limit,
      users,
      activityTypes,
      modules,
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load audit logs.", detail: error.message });
  }
}

async function getAuditLogsSummary(req, res) {
  try {
    const module = String(req.query.module || "").trim() || null;
    const summary = await getAuditSummary(module);
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: "Unable to load audit log summary.", detail: error.message });
  }
}

async function exportAuditLogs(req, res) {
  try {
    const filters = normalizeFilters(req.query);
    const result = await listAuditLogs({ ...filters, limit: 10000, page: 1 });

    const headers = ["Timestamp", "Actor", "Module", "Event Type", "Action", "Entity Type", "Target Record", "Outcome", "Source IP", "Device", "Previous Value", "New Value"];
    const rows = result.rows.map(log => [
      log.createdAt,
      log.userName,
      log.module,
      log.activityType,
      log.actionDescription,
      log.entityType,
      log.affectedRecord,
      log.status,
      log.ipAddress,
      log.deviceInfo,
      log.previousValue,
      log.newValue,
    ]);

    const csv = [headers, ...rows].map(row => row.map(toCsvValue).join(",")).join("\n");
    const module = filters.module || "all";
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${module}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: "Unable to export audit logs.", detail: error.message });
  }
}

module.exports = { exportAuditLogs, getAuditLogs, getAuditLogsSummary };
