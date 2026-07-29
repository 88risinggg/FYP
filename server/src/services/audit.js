/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable audit business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
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
