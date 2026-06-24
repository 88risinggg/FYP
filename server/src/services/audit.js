const { auditLogs } = require("./data");

function addAudit(actorEmail, message, category) {
  const entry = {
    id: auditLogs.length + 1,
    actorEmail: actorEmail || "system",
    message,
    category: category || "General",
    timestamp: new Date().toISOString()
  };
  auditLogs.push(entry);
  return entry;
}

module.exports = {
  addAudit
};
