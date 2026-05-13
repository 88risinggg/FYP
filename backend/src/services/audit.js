import { auditLogs } from "../data.js";

export function addAudit(actor, action, module) {
  auditLogs.unshift({ id: auditLogs.length + 1, actor, action, module, createdAt: new Date().toISOString() });
}
