/**
 * Settings Model
 *
 * Database queries for all settings-related operations.
 * Covers profile, security, notifications, invoice/payroll/company settings,
 * connected accounts, login sessions, and audit logs.
 */

const { pool } = require("../config/db");

// ─── Profile ────────────────────────────────────────────────────────────────

async function getProfile(userId) {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.status, u.created_at,
            r.role_name,
            up.display_name, up.mobile, up.job_title, up.department,
            up.preferred_language, up.timezone, up.date_format, up.currency,
            up.profile_picture, up.employee_id, up.company_name
     FROM user u
     JOIN role r ON u.role_id = r.role_id
     LEFT JOIN user_profile up ON up.user_id = u.user_id
     WHERE u.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function upsertProfile(userId, data) {
  const fields = [
    "display_name", "mobile", "job_title", "department",
    "preferred_language", "timezone", "date_format", "currency",
    "profile_picture"
  ];
  const values = fields.map((f) => data[f] ?? null);

  await pool.query(
    `INSERT INTO user_profile (user_id, ${fields.join(", ")})
     VALUES (?, ${fields.map(() => "?").join(", ")})
     ON DUPLICATE KEY UPDATE ${fields.map((f) => `${f} = VALUES(${f})`).join(", ")}`,
    [userId, ...values]
  );

  // Update name in user table if provided
  if (data.name) {
    await pool.query("UPDATE user SET name = ? WHERE user_id = ?", [data.name, userId]);
  }
}

// ─── Password & Security ────────────────────────────────────────────────────

async function getUserPassword(userId) {
  const [rows] = await pool.query(
    "SELECT password, password_changed_at FROM user WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function updatePassword(userId, hashedPassword) {
  await pool.query(
    "UPDATE user SET password = ?, password_changed_at = NOW() WHERE user_id = ?",
    [hashedPassword, userId]
  );
}

// ─── Two-Factor Authentication ──────────────────────────────────────────────

async function get2FASettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM security_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsert2FASettings(userId, data) {
  await pool.query(
    `INSERT INTO security_settings (user_id, two_fa_enabled, two_fa_method, recovery_codes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE two_fa_enabled = VALUES(two_fa_enabled),
       two_fa_method = VALUES(two_fa_method), recovery_codes = VALUES(recovery_codes)`,
    [userId, data.two_fa_enabled ? 1 : 0, data.two_fa_method || null, data.recovery_codes || null]
  );
}

// ─── Connected Accounts ─────────────────────────────────────────────────────

async function getConnectedAccounts(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM connected_account WHERE user_id = ? ORDER BY provider ASC",
    [userId]
  );
  return rows;
}

async function upsertConnectedAccount(userId, provider, data) {
  await pool.query(
    `INSERT INTO connected_account (user_id, provider, account_email, status, connected_at, last_sync)
     VALUES (?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE account_email = VALUES(account_email),
       status = VALUES(status), last_sync = NOW()`,
    [userId, provider, data.account_email || null, data.status || "connected"]
  );
}

async function disconnectAccount(userId, provider) {
  await pool.query(
    "DELETE FROM connected_account WHERE user_id = ? AND provider = ?",
    [userId, provider]
  );
}

// ─── Notification Settings ──────────────────────────────────────────────────

async function getNotificationSettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM notification_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertNotificationSettings(userId, data) {
  const json = JSON.stringify(data);
  await pool.query(
    `INSERT INTO notification_settings (user_id, preferences)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)`,
    [userId, json]
  );
}

// ─── Invoice Settings ───────────────────────────────────────────────────────

async function getInvoiceSettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM invoice_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertInvoiceSettings(userId, data) {
  const fields = [
    "invoice_prefix", "next_invoice_number", "default_due_days",
    "default_currency", "tax_rate", "payment_terms", "auto_generate_pdf",
    "auto_email_invoice", "late_payment_reminder", "invoice_footer",
    "invoice_notes", "company_logo", "invoice_template"
  ];
  const values = fields.map((f) => data[f] ?? null);

  await pool.query(
    `INSERT INTO invoice_settings (user_id, ${fields.join(", ")})
     VALUES (?, ${fields.map(() => "?").join(", ")})
     ON DUPLICATE KEY UPDATE ${fields.map((f) => `${f} = VALUES(${f})`).join(", ")}`,
    [userId, ...values]
  );
}

// ─── Payroll Settings ───────────────────────────────────────────────────────

async function getPayrollSettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM payroll_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertPayrollSettings(userId, data) {
  const fields = [
    "payroll_frequency", "salary_payment_day", "cpf_contribution",
    "tax_settings", "working_hours", "overtime_enabled",
    "payroll_approval_required", "payslip_template", "payroll_lock"
  ];
  const values = fields.map((f) => data[f] ?? null);

  await pool.query(
    `INSERT INTO payroll_settings (user_id, ${fields.join(", ")})
     VALUES (?, ${fields.map(() => "?").join(", ")})
     ON DUPLICATE KEY UPDATE ${fields.map((f) => `${f} = VALUES(${f})`).join(", ")}`,
    [userId, ...values]
  );
}

// ─── Company Settings ───────────────────────────────────────────────────────

async function getCompanySettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM company_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertCompanySettings(userId, data) {
  const fields = [
    "company_logo", "company_name", "registration_number", "gst_number",
    "address", "phone", "email", "website", "default_currency",
    "financial_year", "fiscal_start_date"
  ];
  const values = fields.map((f) => data[f] ?? null);

  await pool.query(
    `INSERT INTO company_settings (user_id, ${fields.join(", ")})
     VALUES (?, ${fields.map(() => "?").join(", ")})
     ON DUPLICATE KEY UPDATE ${fields.map((f) => `${f} = VALUES(${f})`).join(", ")}`,
    [userId, ...values]
  );
}

// ─── Login Sessions ─────────────────────────────────────────────────────────

async function getLoginSessions(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM login_session WHERE user_id = ? ORDER BY login_time DESC",
    [userId]
  );
  return rows;
}

async function createLoginSession(userId, data) {
  await pool.query(
    `INSERT INTO login_session (user_id, device, browser, os, ip_address, location, login_time, is_current)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [userId, data.device, data.browser, data.os, data.ip_address, data.location, data.is_current ? 1 : 0]
  );
}

async function deleteSession(sessionId, userId) {
  await pool.query(
    "DELETE FROM login_session WHERE session_id = ? AND user_id = ?",
    [sessionId, userId]
  );
}

async function deleteOtherSessions(userId, currentSessionId) {
  await pool.query(
    "DELETE FROM login_session WHERE user_id = ? AND session_id != ?",
    [userId, currentSessionId]
  );
}

async function deleteAllSessions(userId) {
  await pool.query("DELETE FROM login_session WHERE user_id = ?", [userId]);
}

// ─── Audit Logs (Settings-specific) ─────────────────────────────────────────

async function getSettingsAuditLogs(userId, { page = 1, limit = 20, search = "", module = "" }) {
  const offset = (page - 1) * limit;
  let where = "WHERE al.user_id = ?";
  const params = [userId];

  if (search) {
    where += " AND (al.action LIKE ? OR al.module LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (module) {
    where += " AND al.module = ?";
    params.push(module);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM settings_audit_log al ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT al.*, u.name AS user_name
     FROM settings_audit_log al
     LEFT JOIN user u ON u.user_id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { logs: rows, total, page, limit };
}

async function createSettingsAuditLog(userId, data) {
  await pool.query(
    `INSERT INTO settings_audit_log (user_id, action, module, ip_address, device, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [userId, data.action, data.module, data.ip_address || null, data.device || null]
  );
}

// ─── Appearance & Language ──────────────────────────────────────────────────

async function getAppearanceSettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM appearance_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertAppearanceSettings(userId, data) {
  await pool.query(
    `INSERT INTO appearance_settings (user_id, theme, accent_color, compact_mode, font_size, language)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE theme = VALUES(theme), accent_color = VALUES(accent_color),
       compact_mode = VALUES(compact_mode), font_size = VALUES(font_size), language = VALUES(language)`,
    [userId, data.theme || "system", data.accent_color || "#7B2FF7", data.compact_mode ? 1 : 0, data.font_size || "medium", data.language || "en"]
  );
}

// ─── API Keys ───────────────────────────────────────────────────────────────

async function getApiSettings(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM api_settings WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertApiSettings(userId, data) {
  await pool.query(
    `INSERT INTO api_settings (user_id, api_key, webhook_url, webhook_secret, webhooks_enabled)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), webhook_url = VALUES(webhook_url),
       webhook_secret = VALUES(webhook_secret), webhooks_enabled = VALUES(webhooks_enabled)`,
    [userId, data.api_key, data.webhook_url || null, data.webhook_secret || null, data.webhooks_enabled ? 1 : 0]
  );
}

module.exports = {
  getProfile,
  upsertProfile,
  getUserPassword,
  updatePassword,
  get2FASettings,
  upsert2FASettings,
  getConnectedAccounts,
  upsertConnectedAccount,
  disconnectAccount,
  getNotificationSettings,
  upsertNotificationSettings,
  getInvoiceSettings,
  upsertInvoiceSettings,
  getPayrollSettings,
  upsertPayrollSettings,
  getCompanySettings,
  upsertCompanySettings,
  getLoginSessions,
  createLoginSession,
  deleteSession,
  deleteOtherSessions,
  deleteAllSessions,
  getSettingsAuditLogs,
  createSettingsAuditLog,
  getAppearanceSettings,
  upsertAppearanceSettings,
  getApiSettings,
  upsertApiSettings
};
