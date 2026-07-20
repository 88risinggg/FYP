/**
 * Settings Model
 *
 * Database queries for all settings-related operations.
 * After 1:1 merge, all per-user settings are stored directly in the `user` table.
 * Covers profile, security, notifications, invoice/payroll/company settings,
 * connected accounts, login sessions, and audit logs.
 */

const { pool } = require("../config/db");

// ─── Profile ────────────────────────────────────────────────────────────────

async function getProfile(userId) {
  const [rows] = await pool.query(
    `SELECT user_id, name, email, status, created_at, role_name,
            display_name, mobile, job_title, department,
            preferred_language, timezone, date_format, currency,
            profile_picture, profile_employee_id AS employee_id,
            profile_company_name AS company_name
     FROM user
     WHERE user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function upsertProfile(userId, data) {
  const fields = [];
  const values = [];

  const mapping = {
    display_name: data.display_name,
    mobile: data.mobile,
    job_title: data.job_title,
    department: data.department,
    preferred_language: data.preferred_language,
    timezone: data.timezone,
    date_format: data.date_format,
    currency: data.currency,
    profile_picture: data.profile_picture
  };

  for (const [col, val] of Object.entries(mapping)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (data.name) {
    fields.push("name = ?");
    values.push(data.name);
  }

  if (fields.length > 0) {
    values.push(userId);
    await pool.query(
      `UPDATE user SET ${fields.join(", ")} WHERE user_id = ?`,
      values
    );
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
    "SELECT two_fa_enabled, two_fa_method, recovery_codes FROM user WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsert2FASettings(userId, data) {
  await pool.query(
    `UPDATE user SET two_fa_enabled = ?, two_fa_method = ?, recovery_codes = ? WHERE user_id = ?`,
    [data.two_fa_enabled ? 1 : 0, data.two_fa_method || null, data.recovery_codes || null, userId]
  );
}

// ─── Connected Accounts (stored as JSON on user table) ──────────────────────

async function getConnectedAccounts(userId) {
  const [rows] = await pool.query(
    "SELECT connected_accounts_json FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0] || !rows[0].connected_accounts_json) return [];
  let accounts = rows[0].connected_accounts_json;
  if (typeof accounts === "string") {
    try { accounts = JSON.parse(accounts); } catch { return []; }
  }
  return Array.isArray(accounts) ? accounts : [];
}

async function upsertConnectedAccount(userId, provider, data) {
  const accounts = await getConnectedAccounts(userId);
  const idx = accounts.findIndex((a) => a.provider === provider);
  const entry = {
    provider,
    account_email: data.account_email || null,
    status: data.status || "connected",
    connected_at: new Date().toISOString(),
    last_sync: new Date().toISOString()
  };
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...entry };
  } else {
    accounts.push(entry);
  }
  await pool.query("UPDATE user SET connected_accounts_json = ? WHERE user_id = ?", [JSON.stringify(accounts), userId]);
}

async function disconnectAccount(userId, provider) {
  const accounts = await getConnectedAccounts(userId);
  const filtered = accounts.filter((a) => a.provider !== provider);
  await pool.query("UPDATE user SET connected_accounts_json = ? WHERE user_id = ?", [JSON.stringify(filtered), userId]);
}

// ─── Notification Settings ──────────────────────────────────────────────────

async function getNotificationSettings(userId) {
  const [rows] = await pool.query(
    "SELECT notification_preferences AS preferences FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0]) return null;
  return { preferences: rows[0].preferences };
}

async function upsertNotificationSettings(userId, data) {
  const json = JSON.stringify(data);
  await pool.query(
    "UPDATE user SET notification_preferences = ? WHERE user_id = ?",
    [json, userId]
  );
}

// ─── Invoice Settings ───────────────────────────────────────────────────────

async function getInvoiceSettings(userId) {
  const invoiceSettingsModel = require("./invoiceSettingsModel");
  return invoiceSettingsModel.getInvoiceSettings();
}

async function upsertInvoiceSettings(userId, data) {
  const invoiceSettingsModel = require("./invoiceSettingsModel");
  const current = (await invoiceSettingsModel.getInvoiceSettings()) || invoiceSettingsModel.defaultSettings;
  const dueDays = Number(data.default_due_days ?? current.dueDays ?? 30);
  await invoiceSettingsModel.saveInvoiceSettings({
    ...current,
    invoicePrefix: data.invoice_prefix ?? current.invoicePrefix,
    nextInvoiceNumber: data.next_invoice_number ?? current.nextInvoiceNumber,
    dueDays,
    defaultCurrency: data.default_currency ?? current.defaultCurrency,
    defaultTaxRate: data.tax_rate ?? current.defaultTaxRate,
    paymentTerms: data.payment_terms ?? current.paymentTerms,
    footerNote: data.invoice_footer ?? current.footerNote,
    attachPdfInvoice: data.auto_email_invoice === undefined
      ? current.attachPdfInvoice
      : Boolean(data.auto_email_invoice),
    general: {
      ...current.general,
      defaultCurrency: data.default_currency ?? current.general?.defaultCurrency,
      paymentTerms: data.payment_terms ?? current.general?.paymentTerms
    },
    export: {
      ...current.export,
      pdfExportEnabled: data.auto_generate_pdf === undefined
        ? current.export?.pdfExportEnabled
        : Boolean(data.auto_generate_pdf),
      pdfPaperSize: "A4"
    },
    branding: {
      ...current.branding,
      companyLogoUrl: data.company_logo ?? current.branding?.companyLogoUrl,
      showCompanyDetailsOnInvoice: true
    }
  });
}

// ─── Payroll Settings ───────────────────────────────────────────────────────

async function getPayrollSettings(userId) {
  const [rows] = await pool.query(
    "SELECT payroll_config_json FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0] || !rows[0].payroll_config_json) return null;
  let config = rows[0].payroll_config_json;
  if (typeof config === "string") {
    try { return JSON.parse(config); } catch { return null; }
  }
  return config;
}

async function upsertPayrollSettings(userId, data) {
  const fields = [
    "payroll_frequency", "salary_payment_day", "cpf_contribution",
    "tax_settings", "working_hours", "overtime_enabled",
    "payroll_approval_required", "payslip_template", "payroll_lock"
  ];
  const settings = Object.fromEntries(fields.map((field) => [field, data[field] ?? null]));

  await pool.query(
    "UPDATE user SET payroll_config_json = ? WHERE user_id = ?",
    [JSON.stringify(settings), userId]
  );
}

// ─── Company Settings ───────────────────────────────────────────────────────

async function getCompanySettings(userId) {
  const [rows] = await pool.query(
    `SELECT setting_company_name AS company_name, company_logo, registration_number,
            gst_number, company_address AS address, company_phone AS phone,
            company_email AS email, company_website AS website,
            setting_default_currency AS default_currency, financial_year, fiscal_start_date
     FROM user WHERE user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function upsertCompanySettings(userId, data) {
  const fields = [];
  const values = [];

  const mapping = {
    company_logo: data.company_logo,
    setting_company_name: data.company_name,
    registration_number: data.registration_number,
    gst_number: data.gst_number,
    company_address: data.address,
    company_phone: data.phone,
    company_email: data.email,
    company_website: data.website,
    setting_default_currency: data.default_currency,
    financial_year: data.financial_year,
    fiscal_start_date: data.fiscal_start_date
  };

  for (const [col, val] of Object.entries(mapping)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (fields.length > 0) {
    values.push(userId);
    await pool.query(
      `UPDATE user SET ${fields.join(", ")} WHERE user_id = ?`,
      values
    );
  }
}

// ─── Login Sessions ─────────────────────────────────────────────────────────

// ─── Login Sessions (stored as JSON on user table) ──────────────────────────

async function getLoginSessions(userId) {
  const [rows] = await pool.query(
    "SELECT login_sessions_json FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0] || !rows[0].login_sessions_json) return [];
  let sessions = rows[0].login_sessions_json;
  if (typeof sessions === "string") {
    try { sessions = JSON.parse(sessions); } catch { return []; }
  }
  return Array.isArray(sessions) ? sessions.sort((a, b) => new Date(b.login_time) - new Date(a.login_time)) : [];
}

async function createLoginSession(userId, data) {
  const sessions = await getLoginSessions(userId);
  const newSession = {
    session_id: Date.now(),
    device: data.device,
    browser: data.browser,
    os: data.os,
    ip_address: data.ip_address,
    location: data.location,
    login_time: new Date().toISOString(),
    is_current: data.is_current ? 1 : 0
  };
  sessions.unshift(newSession);
  // Keep last 20 sessions max
  const trimmed = sessions.slice(0, 20);
  await pool.query("UPDATE user SET login_sessions_json = ? WHERE user_id = ?", [JSON.stringify(trimmed), userId]);
}

async function deleteSession(sessionId, userId) {
  const sessions = await getLoginSessions(userId);
  const filtered = sessions.filter((s) => String(s.session_id) !== String(sessionId));
  await pool.query("UPDATE user SET login_sessions_json = ? WHERE user_id = ?", [JSON.stringify(filtered), userId]);
}

async function deleteOtherSessions(userId, currentSessionId) {
  const sessions = await getLoginSessions(userId);
  const filtered = sessions.filter((s) => String(s.session_id) === String(currentSessionId));
  await pool.query("UPDATE user SET login_sessions_json = ? WHERE user_id = ?", [JSON.stringify(filtered), userId]);
}

async function deleteAllSessions(userId) {
  await pool.query("UPDATE user SET login_sessions_json = '[]' WHERE user_id = ?", [userId]);
}

// ─── Audit Logs (Settings-specific) ─────────────────────────────────────────

// ─── Audit Logs (stored in audit_logs table) ────────────────────────────────

async function getSettingsAuditLogs(userId, { page = 1, limit = 20, search = "", module = "" }) {
  const offset = (page - 1) * limit;
  let where = "WHERE al.user_id = ? AND al.activity_type = 'settings'";
  const params = [userId];

  if (search) {
    where += " AND (al.action_description LIKE ? OR al.activity_type LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (module) {
    where += " AND al.affected_record = ?";
    params.push(module);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT al.audit_log_id AS id, al.user_id, al.action_description AS action,
            al.activity_type AS module, al.ip_address, al.device_info AS device,
            al.created_at, al.user_name
     FROM audit_logs al
     ${where}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { logs: rows, total, page, limit };
}

async function createSettingsAuditLog(userId, data) {
  // Get user name for the log
  const [userRows] = await pool.query("SELECT name FROM user WHERE user_id = ?", [userId]);
  const userName = userRows[0]?.name || "Unknown";

  await pool.query(
    `INSERT INTO audit_logs (user_id, user_name, activity_type, action_description, affected_record, status, ip_address, device_info, created_at)
     VALUES (?, ?, 'settings', ?, ?, 'success', ?, ?, NOW())`,
    [userId, userName, data.action, data.module || null, data.ip_address || null, data.device || null]
  );
}

// ─── Appearance & Language ──────────────────────────────────────────────────

async function getAppearanceSettings(userId) {
  const [rows] = await pool.query(
    `SELECT theme, accent_color, compact_mode, font_size, ui_language AS language
     FROM user WHERE user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

async function upsertAppearanceSettings(userId, data) {
  await pool.query(
    `UPDATE user SET theme = ?, accent_color = ?, compact_mode = ?, font_size = ?, ui_language = ?
     WHERE user_id = ?`,
    [
      data.theme || "system",
      data.accent_color || "#7B2FF7",
      data.compact_mode ? 1 : 0,
      data.font_size || "medium",
      data.language || "en",
      userId
    ]
  );
}

// ─── API Keys ───────────────────────────────────────────────────────────────

async function getApiSettings(userId) {
  const [rows] = await pool.query(
    "SELECT api_key, webhook_url, webhook_secret, webhooks_enabled FROM user WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

async function upsertApiSettings(userId, data) {
  await pool.query(
    `UPDATE user SET api_key = ?, webhook_url = ?, webhook_secret = ?, webhooks_enabled = ?
     WHERE user_id = ?`,
    [data.api_key, data.webhook_url || null, data.webhook_secret || null, data.webhooks_enabled ? 1 : 0, userId]
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
