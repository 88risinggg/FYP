/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Provides reusable payroll Rule Governance Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const crypto = require("crypto");
const { pool } = require("../config/db");
const { writeAuditLog } = require("./auditService");
const { currentCompanyId } = require("./tenantContext");
const {
  ensurePayrollConfigurationTable,
  getActivePayrollRules,
  getEffectivePayrollRules,
  upsertStoredPayrollSetting
} = require("./payrollRuleConfigService");

const GOVERNANCE_KEY = "published_rules";

function rulesHash(rules) {
  return crypto.createHash("sha256").update(JSON.stringify(rules)).digest("hex");
}

async function ensureRuleGovernanceSchema(connection = pool) {
  await ensurePayrollConfigurationTable(connection);
  for (const [column, definition] of [
    ["payroll_rules_ack_hash", "VARCHAR(64) NULL"],
    ["payroll_rules_ack_at", "DATETIME NULL"]
  ]) {
    const [rows] = await connection.execute(`SHOW COLUMNS FROM user LIKE '${column}'`);
    if (!rows.length) {
      try { await connection.execute(`ALTER TABLE user ADD COLUMN ${column} ${definition}`); }
      catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
    }
  }
}

async function getPublishedRuleState(connection = pool) {
  const companyId = currentCompanyId();
  await ensureRuleGovernanceSchema(connection);
  const [[row]] = await connection.execute(
    `SELECT pc.configuration_value, pc.updated_at, COALESCE(u.name, 'System') AS published_by
     FROM payroll_configuration pc LEFT JOIN user u ON u.user_id = pc.updated_by AND u.company_id = pc.company_id
     WHERE pc.configuration_type = 'governance' AND pc.configuration_key = ? AND pc.company_id = ? LIMIT 1`,
    [GOVERNANCE_KEY, companyId]
  );
  if (row) {
    try { return { ...JSON.parse(row.configuration_value), publishedAt: row.updated_at, publishedBy: row.published_by }; }
    catch (_error) { /* rebuild invalid legacy metadata */ }
  }
  const hash = rulesHash(await getActivePayrollRules(connection));
  return { version: 1, hash, publishedAt: null, publishedBy: "System", changeReason: "Initial payroll rule baseline", changes: [] };
}

function validateReference(change) {
  const statutory = /^(cpf_|sdl_|mbmf_|cdac_|sinda_|ecf_|iras_|ir21_|compliance_cpf|compliance_sdl)/i.test(change.settingKey);
  if (!statutory) return;
  if (!change.referenceTitle?.trim()) throw Object.assign(new Error(`A reference title is required for ${change.settingKey}.`), { code: "RULE_REFERENCE_REQUIRED" });
  let url;
  try { url = new URL(change.referenceUrl); } catch (_error) { throw Object.assign(new Error(`A valid HTTPS reference is required for ${change.settingKey}.`), { code: "RULE_REFERENCE_REQUIRED" }); }
  if (url.protocol !== "https:") throw Object.assign(new Error("Payroll rule references must use HTTPS."), { code: "INVALID_RULE_REFERENCE" });
}

async function publishPayrollRules({ changes, changeReason, userId }) {
  const companyId = currentCompanyId();
  if (!Array.isArray(changes) || !changes.length) throw Object.assign(new Error("At least one changed rule is required."), { code: "NO_RULE_CHANGES" });
  if (!String(changeReason || "").trim()) throw Object.assign(new Error("A change reason is required."), { code: "RULE_CHANGE_REASON_REQUIRED" });
  changes.forEach((change) => {
    if (!change.settingKey || change.settingValue === undefined || !change.effectiveFrom) throw Object.assign(new Error("Every changed rule needs a key, value, and effective date."), { code: "INVALID_RULE_CHANGE" });
    validateReference(change);
  });

  await ensureRuleGovernanceSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const previous = await getPublishedRuleState(connection);
    for (const change of changes) await upsertStoredPayrollSetting({ ...change, updatedBy: userId }, connection);
    const hash = rulesHash(await getActivePayrollRules(connection));
    const publication = {
      version: Number(previous.version || 0) + 1,
      hash,
      changeReason: String(changeReason).trim(),
      changes: changes.map((item) => ({
        settingKey: item.settingKey,
        before: item.beforeValue ?? null,
        after: String(item.settingValue),
        effectiveFrom: item.effectiveFrom,
        referenceTitle: item.referenceTitle || null,
        referenceUrl: item.referenceUrl || null
      }))
    };
    await connection.execute(
      `INSERT INTO payroll_configuration (company_id, configuration_type, configuration_key, configuration_value, description, updated_by)
       VALUES (?, 'governance', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE configuration_value=VALUES(configuration_value), description=VALUES(description), updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP`,
      [companyId, GOVERNANCE_KEY, JSON.stringify(publication), publication.changeReason, userId || null]
    );
    await writeAuditLog({ connection, module: "Payroll", activityType: "Compliance Rules", action: `Published payroll rules version ${publication.version}`, entityId: publication.hash, entityType: "payroll_rules", userId, status: "Success", newValue: JSON.stringify({ version: publication.version, changedKeys: publication.changes.map((item) => item.settingKey), reason: publication.changeReason }) });
    await connection.commit();
    return { publication: await getPublishedRuleState(pool), catalogue: await getEffectivePayrollRules(pool) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function getRuleAcknowledgement(userId) {
  const companyId = currentCompanyId();
  const publication = await getPublishedRuleState(pool);
  const [[user]] = await pool.execute("SELECT payroll_rules_ack_hash AS acknowledgedHash, payroll_rules_ack_at AS acknowledgedAt FROM user WHERE user_id = ? AND company_id = ?", [userId, companyId]);
  const [pendingRuns] = await pool.execute("SELECT payroll_run_id AS runId, status FROM payroll_run WHERE approved_at IS NULL AND company_id = ? ORDER BY updated_at DESC LIMIT 20", [companyId]);
  return { required: Boolean(publication.publishedAt) && (!user || user.acknowledgedHash !== publication.hash), acknowledgedHash: user?.acknowledgedHash || null, acknowledgedAt: user?.acknowledgedAt || null, publication, affectedRuns: pendingRuns };
}

async function acknowledgePayrollRules(userId) {
  const companyId = currentCompanyId();
  const publication = await getPublishedRuleState(pool);
  await pool.execute("UPDATE user SET payroll_rules_ack_hash = ?, payroll_rules_ack_at = CURRENT_TIMESTAMP WHERE user_id = ? AND company_id = ?", [publication.hash, userId, companyId]);
  await writeAuditLog({ module: "Payroll", activityType: "Compliance Rules", action: `Acknowledged payroll rules version ${publication.version}`, entityId: publication.hash, entityType: "payroll_rules", userId, status: "Success" });
  return getRuleAcknowledgement(userId);
}

async function recordCurrentRulesPublication({ userId, changeReason, changes = [] }) {
  const companyId = currentCompanyId();
  await ensureRuleGovernanceSchema(pool);
  const previous = await getPublishedRuleState(pool);
  const publication = { version: Number(previous.version || 0) + 1, hash: rulesHash(await getActivePayrollRules(pool)), changeReason: changeReason || "Payroll configuration updated", changes };
  await pool.execute(
    `INSERT INTO payroll_configuration (company_id, configuration_type, configuration_key, configuration_value, description, updated_by)
     VALUES (?, 'governance', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE configuration_value=VALUES(configuration_value), description=VALUES(description), updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP`,
    [companyId, GOVERNANCE_KEY, JSON.stringify(publication), publication.changeReason, userId || null]
  );
  return getPublishedRuleState(pool);
}

module.exports = { acknowledgePayrollRules, ensureRuleGovernanceSchema, getPublishedRuleState, getRuleAcknowledgement, publishPayrollRules, recordCurrentRulesPublication, rulesHash };
