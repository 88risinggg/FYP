/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Reads and writes whatsapp Config Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
/**
 * WhatsApp Config Model
 *
 * Data-access layer for the whatsapp_config table.
 * Handles AES-256-CBC encryption/decryption of Twilio credentials.
 * Only Admin users should invoke these functions via the controller.
 *
 * Credentials are NEVER returned in plaintext to the client —
 * the controller masks them before sending responses.
 */

const crypto = require("crypto");
const { pool } = require("../config/db");

// Encryption key derived from env or a default for dev (32 bytes for AES-256)
const ENCRYPTION_KEY = (process.env.WHATSAPP_ENCRYPTION_KEY || "wa_default_encryption_key_32byte").slice(0, 32).padEnd(32, "0");
const ALGORITHM = "aes-256-cbc";

// ─── Encryption Helpers ───────────────────────────────────────────────────────

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, iv: iv.toString("hex") };
}

function decrypt(encryptedHex, ivHex) {
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ─── Config CRUD ──────────────────────────────────────────────────────────────

/**
 * Get the current WhatsApp integration config (single row).
 * Decrypts credentials internally but does NOT expose plaintext outside this module
 * unless explicitly requested (e.g., for Twilio client init).
 *
 * @param {Object} [options]
 * @param {boolean} [options.decryptCredentials=false] — if true, returns plaintext SID/token
 * @returns {Object|null}
 */
async function getConfig(options = {}) {
  const [rows] = await pool.query("SELECT * FROM whatsapp_config LIMIT 1");
  if (!rows[0]) return null;

  const row = rows[0];
  const config = {
    id: row.id,
    whatsapp_number: row.whatsapp_number,
    webhook_url: row.webhook_url,
    is_enabled: Boolean(row.is_enabled),
    connection_status: row.connection_status,
    last_tested_at: row.last_tested_at,
    account_name: row.account_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    // Masked values for display
    account_sid_masked: maskValue(decryptSafe(row.account_sid_encrypted, row.encryption_iv)),
    auth_token_masked: "••••••••••••"
  };

  if (options.decryptCredentials) {
    config.account_sid = decryptSafe(row.account_sid_encrypted, row.encryption_iv);
    config.auth_token = decryptSafe(row.auth_token_encrypted, row.encryption_iv);
  }

  return config;
}

/**
 * Save or update WhatsApp config (upsert).
 * Encrypts credentials before storing.
 *
 * @param {Object} data
 * @param {string} data.account_sid
 * @param {string} data.auth_token
 * @param {string} data.whatsapp_number
 * @param {string} [data.webhook_url]
 * @param {boolean} [data.is_enabled]
 * @param {number} [data.updated_by]
 * @returns {Object} Updated config (masked)
 */
async function saveConfig(data) {
  const { account_sid, auth_token, whatsapp_number, webhook_url, is_enabled, updated_by } = data;

  const sidEncrypted = encrypt(account_sid);
  const tokenEncrypted = encrypt(auth_token);
  // Use same IV for both (simpler) — stored once
  const iv = sidEncrypted.iv;
  const tokenReEncrypted = encryptWithIv(auth_token, iv);

  const [existing] = await pool.query("SELECT id FROM whatsapp_config LIMIT 1");

  if (existing.length > 0) {
    await pool.query(
      `UPDATE whatsapp_config SET
        account_sid_encrypted = ?,
        auth_token_encrypted = ?,
        whatsapp_number = ?,
        webhook_url = ?,
        is_enabled = ?,
        encryption_iv = ?,
        updated_by = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        sidEncrypted.encrypted,
        tokenReEncrypted,
        whatsapp_number,
        webhook_url || null,
        is_enabled ? 1 : 0,
        iv,
        updated_by || null,
        existing[0].id
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO whatsapp_config
        (account_sid_encrypted, auth_token_encrypted, whatsapp_number, webhook_url, is_enabled, encryption_iv, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sidEncrypted.encrypted,
        tokenReEncrypted,
        whatsapp_number,
        webhook_url || null,
        is_enabled ? 1 : 0,
        iv,
        updated_by || null
      ]
    );
  }

  return getConfig();
}

/**
 * Update only the enabled status (toggle).
 * @param {boolean} enabled
 * @param {number} [updatedBy]
 * @returns {Object|null}
 */
async function setEnabled(enabled, updatedBy) {
  const [existing] = await pool.query("SELECT id FROM whatsapp_config LIMIT 1");
  if (existing.length === 0) return null;

  await pool.query(
    "UPDATE whatsapp_config SET is_enabled = ?, updated_by = ?, updated_at = NOW() WHERE id = ?",
    [enabled ? 1 : 0, updatedBy || null, existing[0].id]
  );
  return getConfig();
}

/**
 * Update connection status after a test.
 * @param {string} status — 'connected' | 'failed' | 'untested'
 * @param {string|null} accountName
 */
async function updateConnectionStatus(status, accountName) {
  await pool.query(
    `UPDATE whatsapp_config SET connection_status = ?, last_tested_at = NOW(), account_name = ? WHERE id = (SELECT id FROM (SELECT id FROM whatsapp_config LIMIT 1) AS t)`,
    [status, accountName || null]
  );
}

/**
 * Check if WhatsApp integration is enabled and configured.
 * Lightweight check for use in Finance operations.
 * @returns {{ enabled: boolean, configured: boolean }}
 */
async function getIntegrationStatus() {
  const [rows] = await pool.query(
    "SELECT is_enabled, connection_status, whatsapp_number FROM whatsapp_config LIMIT 1"
  );
  if (!rows[0]) return { enabled: false, configured: false };
  return {
    enabled: Boolean(rows[0].is_enabled),
    configured: rows[0].connection_status === "connected" && Boolean(rows[0].whatsapp_number)
  };
}

// ─── Integration Logs ─────────────────────────────────────────────────────────

/**
 * Write an audit log entry for WhatsApp configuration changes.
 * @param {string} action
 * @param {Object} [details]
 * @param {number} [performedBy]
 * @param {string} [ipAddress]
 */
async function createIntegrationLog(action, details, performedBy, ipAddress) {
  await pool.query(
    `INSERT INTO whatsapp_integration_logs (action, details, performed_by, ip_address) VALUES (?, ?, ?, ?)`,
    [action, details ? JSON.stringify(details) : null, performedBy || null, ipAddress || null]
  );
}

/**
 * Get integration logs with pagination.
 * @param {Object} [filters]
 * @returns {Object} { logs, total, page, limit }
 */
async function getIntegrationLogs(filters = {}) {
  const { page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;

  const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM whatsapp_integration_logs");
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT wil.*, u.name AS user_name
     FROM whatsapp_integration_logs wil
     LEFT JOIN user u ON u.user_id = wil.performed_by
     ORDER BY wil.created_at DESC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  );

  return { logs: rows, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
}

// ─── Notification Rules ───────────────────────────────────────────────────────

/**
 * Get all notification rules.
 * @returns {Array}
 */
async function getNotificationRules() {
  const [rows] = await pool.query("SELECT * FROM whatsapp_notification_rules ORDER BY id");
  return rows.map((row) => ({
    ...row,
    is_enabled: Boolean(row.is_enabled),
    send_pdf_attachment: Boolean(row.send_pdf_attachment),
    reminder_days_before: parseJson(row.reminder_days_before),
    overdue_reminder_days: parseJson(row.overdue_reminder_days)
  }));
}

/**
 * Update a notification rule.
 * @param {string} ruleType
 * @param {Object} updates
 * @returns {Object|null}
 */
async function updateNotificationRule(ruleType, updates) {
  const fields = [];
  const params = [];

  if (updates.is_enabled !== undefined) { fields.push("is_enabled = ?"); params.push(updates.is_enabled ? 1 : 0); }
  if (updates.reminder_days_before !== undefined) { fields.push("reminder_days_before = ?"); params.push(JSON.stringify(updates.reminder_days_before)); }
  if (updates.overdue_reminder_days !== undefined) { fields.push("overdue_reminder_days = ?"); params.push(JSON.stringify(updates.overdue_reminder_days)); }
  if (updates.send_pdf_attachment !== undefined) { fields.push("send_pdf_attachment = ?"); params.push(updates.send_pdf_attachment ? 1 : 0); }

  if (fields.length === 0) return null;

  params.push(ruleType);
  await pool.query(`UPDATE whatsapp_notification_rules SET ${fields.join(", ")} WHERE rule_type = ?`, params);

  const [rows] = await pool.query("SELECT * FROM whatsapp_notification_rules WHERE rule_type = ?", [ruleType]);
  return rows[0] || null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encryptWithIv(text, ivHex) {
  const iv = Buffer.from(ivHex, "hex");
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decryptSafe(encryptedHex, ivHex) {
  try {
    return decrypt(encryptedHex, ivHex);
  } catch {
    return "";
  }
}

function maskValue(value) {
  if (!value || value.length < 8) return "••••••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

module.exports = {
  getConfig,
  saveConfig,
  setEnabled,
  updateConnectionStatus,
  getIntegrationStatus,
  createIntegrationLog,
  getIntegrationLogs,
  getNotificationRules,
  updateNotificationRule,
  encrypt,
  decrypt
};
