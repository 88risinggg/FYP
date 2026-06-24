const {
  getActivityTypes,
  getAuditSummary,
  getAuditUsers,
  listAuditLogs
} = require("../models/auditLogModel");

function normalizeFilters(query) {
  return {
    startDate: String(query.startDate || "").trim(),
    endDate: String(query.endDate || "").trim(),
    userId: String(query.userId || "").trim(),
    activityType: String(query.activityType || "").trim(),
    keyword: String(query.keyword || "").trim()
  };
}

function toCsvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function getAuditLogs(req, res) {
  try {
    const filters = normalizeFilters(req.query);
    const [logs, users, activityTypes] = await Promise.all([
      listAuditLogs(filters),
      getAuditUsers(),
      getActivityTypes()
    ]);

    res.json({ logs, users, activityTypes });
  } catch (error) {
    res.status(500).json({ message: "Unable to load audit logs." });
  }
}

async function getAuditLogsSummary(req, res) {
  try {
    const summary = await getAuditSummary();
    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: "Unable to load audit log summary." });
  }
}

async function exportAuditLogs(req, res) {
  try {
    const filters = normalizeFilters(req.query);
    const logs = await listAuditLogs(filters);
    const rows = [
      [
        "Timestamp",
        "User",
        "Activity Type",
        "Affected Record",
        "Description",
        "Status",
        "IP Address"
      ],
      ...logs.map((log) => [
        log.createdAt,
        log.userName,
        log.activityType,
        log.affectedRecord,
        log.actionDescription,
        log.status,
        log.ipAddress
      ])
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="audit-logs.csv"');
    res.send(rows.map((row) => row.map(toCsvValue).join(",")).join("\n"));
  } catch (error) {
    res.status(500).json({ message: "Unable to export audit logs." });
  }
}

module.exports = {
  exportAuditLogs,
  getAuditLogs,
  getAuditLogsSummary
};
