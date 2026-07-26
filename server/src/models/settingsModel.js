/**
 * Settings Model
 *
 * Database queries for all settings-related operations.
 * After 1:1 merge, all per-user settings are stored directly in the `user` table.
 * Covers profile, security, notifications, invoice/payroll/company settings,
 * connected accounts, login sessions, and audit logs.
 */

const { pool } = require("../config/db");
const { currentCompanyId } = require("../services/tenantContext");

let privacyTablesPromise;

function ensurePrivacyTables() {
  if (!privacyTablesPromise) {
    privacyTablesPromise = Promise.all([
      pool.query(`CREATE TABLE IF NOT EXISTS user_privacy_settings (
        user_id INT NOT NULL PRIMARY KEY,
        analytics_tracking TINYINT(1) NOT NULL DEFAULT 1,
        profile_visible TINYINT(1) NOT NULL DEFAULT 1,
        activity_visible TINYINT(1) NOT NULL DEFAULT 0,
        analytics_cookies TINYINT(1) NOT NULL DEFAULT 1,
        marketing_cookies TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`),
      pool.query(`CREATE TABLE IF NOT EXISTS account_action_requests (
        request_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        request_type VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        reviewed_by INT NULL,
        review_note VARCHAR(500) NULL,
        INDEX idx_account_requests_user (user_id, request_type, status),
        INDEX idx_account_requests_status (request_type, status, requested_at)
      )`)
    ]).catch((error) => {
      privacyTablesPromise = null;
      throw error;
    });
  }
  return privacyTablesPromise;
}

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
    `INSERT INTO audit_logs (user_id, user_name, module, activity_type, action_description, affected_record, status, ip_address, device_info, created_at)
     VALUES (?, ?, 'Settings', 'settings', ?, ?, 'success', ?, ?, NOW())`,
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
    `UPDATE user SET
       theme = COALESCE(?, theme),
       accent_color = COALESCE(?, accent_color),
       compact_mode = COALESCE(?, compact_mode),
       font_size = COALESCE(?, font_size),
       ui_language = COALESCE(?, ui_language)
     WHERE user_id = ?`,
    [
      data.theme ?? null,
      data.accent_color ?? null,
      data.compact_mode === undefined ? null : (data.compact_mode ? 1 : 0),
      data.font_size ?? null,
      data.language ?? null,
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

// Privacy preferences and account action requests are kept separately so their
// lifecycle and approval history remain available even if an account is deleted.
async function getPrivacySettings(userId) {
  await ensurePrivacyTables();
  const [rows] = await pool.query(
    `SELECT analytics_tracking, profile_visible, activity_visible,
            analytics_cookies, marketing_cookies
     FROM user_privacy_settings WHERE user_id = ?`,
    [userId]
  );
  return rows[0] || {
    analytics_tracking: 1,
    profile_visible: 1,
    activity_visible: 0,
    analytics_cookies: 1,
    marketing_cookies: 0
  };
}

async function upsertPrivacySettings(userId, data) {
  await ensurePrivacyTables();
  const value = (key, fallback) => data[key] === undefined ? fallback : (data[key] ? 1 : 0);
  await pool.query(
    `INSERT INTO user_privacy_settings
       (user_id, analytics_tracking, profile_visible, activity_visible, analytics_cookies, marketing_cookies)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       analytics_tracking = VALUES(analytics_tracking),
       profile_visible = VALUES(profile_visible),
       activity_visible = VALUES(activity_visible),
       analytics_cookies = VALUES(analytics_cookies),
       marketing_cookies = VALUES(marketing_cookies)`,
    [userId, value("analytics_tracking", 1), value("profile_visible", 1), value("activity_visible", 0),
      value("analytics_cookies", 1), value("marketing_cookies", 0)]
  );
  return getPrivacySettings(userId);
}

async function getPersonalDataExport(userId) {
  await ensurePrivacyTables();
  const companyId = currentCompanyId();
  const [[users], privacy, notifications, appearance, audit] = await Promise.all([
    pool.query("SELECT * FROM user WHERE user_id = ? AND company_id = ?", [userId, companyId]),
    getPrivacySettings(userId),
    getNotificationSettings(userId),
    getAppearanceSettings(userId),
    getSettingsAuditLogs(userId, { page: 1, limit: 1000, search: "", module: "" })
  ]);
  const account = { ...(users[0] || {}) };
  ["password", "api_key", "webhook_secret", "recovery_codes"].forEach((field) => delete account[field]);
  return { exported_at: new Date().toISOString(), account, privacy, notifications, appearance, audit_logs: audit.logs };
}

async function createAccountActionRequest(userId, requestType, requestedBy = null) {
  await ensurePrivacyTables();
  const companyId = currentCompanyId();
  const [users] = await pool.query("SELECT name, email FROM user WHERE user_id = ? AND company_id = ?", [userId, companyId]);
  if (!users[0]) return null;
  const [pending] = await pool.query(
    "SELECT * FROM account_action_requests WHERE user_id = ? AND company_id = ? AND request_type = ? AND status = 'pending' LIMIT 1",
    [userId, companyId, requestType]
  );
  if (pending[0]) return { ...pending[0], alreadyPending: true };
  const [result] = await pool.query(
    `INSERT INTO account_action_requests (company_id, user_id, user_name, user_email, request_type, requested_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [companyId, userId, users[0].name, users[0].email, requestType, requestedBy || userId]
  );
  return {
    request_id: result.insertId,
    user_id: userId,
    user_name: users[0].name,
    user_email: users[0].email,
    status: "pending",
    request_type: requestType,
    alreadyPending: false
  };
}

async function notifyAdminsOfDeletionRequest(request) {
  const companyId = currentCompanyId();
  const [admins] = await pool.query("SELECT user_id FROM user WHERE company_id = ? AND role_name = 'Admin' AND status = 1", [companyId]);
  if (!admins.length) return 0;
  const marker = `Deletion request #${request.request_id}`;
  const [notified] = await pool.query(
    "SELECT user_id FROM notification WHERE company_id = ? AND type = 'account_deletion_request' AND message LIKE ?",
    [companyId, `%${marker}%`]
  );
  const notifiedIds = new Set(notified.map((item) => Number(item.user_id)));
  const values = admins.filter((admin) => !notifiedIds.has(Number(admin.user_id))).map((admin) => [
    companyId, admin.user_id,
    "account_deletion_request",
    "Account deletion approval required",
    `${marker}: ${request.user_name} (${request.user_email}) requested account deletion. Review it in Settings > Danger Zone.`,
    0,
    new Date()
  ]);
  if (!values.length) return 0;
  const [result] = await pool.query(
    "INSERT INTO notification (company_id, user_id, type, title, message, is_read, created_at) VALUES ?",
    [values]
  );
  return result.affectedRows || values.length;
}

async function listDeletionRequests() {
  await ensurePrivacyTables();
  const companyId = currentCompanyId();
  const [rows] = await pool.query(
    `SELECT request_id, user_id, user_name, user_email, requested_by, status, requested_at, reviewed_at, reviewed_by, review_note
     FROM account_action_requests WHERE request_type = 'account_deletion' AND company_id = ?
     ORDER BY FIELD(status, 'pending', 'rejected', 'approved'), requested_at DESC`,
    [companyId]
  );
  return rows;
}

async function reviewDeletionRequest(requestId, adminId, decision, note = "") {
  await ensurePrivacyTables();
  const companyId = currentCompanyId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM account_action_requests WHERE request_id = ? AND request_type = 'account_deletion' AND company_id = ? FOR UPDATE",
      [requestId, companyId]
    );
    const request = rows[0];
    if (!request || request.status !== "pending") {
      await connection.rollback();
      return null;
    }
    if (decision === "approved") {
      const [[target]] = await connection.query("SELECT role_name FROM user WHERE user_id = ? AND company_id = ?", [request.user_id, companyId]);
      if (target?.role_name === "Admin") {
        const [[count]] = await connection.query("SELECT COUNT(*) AS total FROM user WHERE role_name = 'Admin' AND status = 1 AND company_id = ?", [companyId]);
        if (Number(count.total) <= 1) { await connection.rollback(); throw new Error("The final active Admin account cannot be deleted"); }
      }
      await connection.query("UPDATE staff SET user_user_id = NULL WHERE user_user_id = ? AND company_id = ?", [request.user_id, companyId]);
      await connection.query("UPDATE public_holidays SET created_by = NULL WHERE created_by = ? AND company_id = ?", [request.user_id, companyId]);
      await connection.query("UPDATE claims_and_loans SET created_by = NULL WHERE created_by = ? AND company_id = ?", [request.user_id, companyId]);
      await connection.query("DELETE FROM user_privacy_settings WHERE user_id = ?", [request.user_id]);
      await connection.query("DELETE FROM notification WHERE user_id = ? AND company_id = ?", [request.user_id, companyId]);
      await connection.query("UPDATE audit_logs SET user_id = NULL WHERE user_id = ? AND company_id = ?", [request.user_id, companyId]);
    }
    await connection.query(
      `UPDATE account_action_requests SET status = ?, reviewed_at = NOW(), reviewed_by = ?, review_note = ?
       WHERE request_id = ? AND company_id = ?`,
      [decision, adminId, note || null, requestId, companyId]
    );
    if (decision === "approved") await connection.query("DELETE FROM user WHERE user_id = ? AND company_id = ?", [request.user_id, companyId]);
    await connection.commit();
    return { ...request, status: decision };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteUserAccountByAdmin(userId, adminId, note = "Deleted from Payroll User Management") {
  const companyId = currentCompanyId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT user_id, name, email, role_name FROM user WHERE user_id = ? AND company_id = ? FOR UPDATE", [userId, companyId]);
    const user = rows[0];
    if (!user) { await connection.rollback(); return { notFound: true }; }
    if (Number(user.user_id) === Number(adminId)) { await connection.rollback(); return { selfDelete: true }; }
    if (user.role_name === "Admin") {
      const [[count]] = await connection.query("SELECT COUNT(*) AS total FROM user WHERE role_name = 'Admin' AND status = 1 AND company_id = ?", [companyId]);
      if (Number(count.total) <= 1) { await connection.rollback(); return { lastAdmin: true }; }
    }
    const [pending] = await connection.query("SELECT request_id FROM account_action_requests WHERE user_id = ? AND request_type = 'account_deletion' AND status = 'pending' AND company_id = ? ORDER BY request_id DESC LIMIT 1", [userId, companyId]);
    if (pending[0]) {
      await connection.query("UPDATE account_action_requests SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, review_note = ? WHERE request_id = ? AND company_id = ?", [adminId, note, pending[0].request_id, companyId]);
    } else {
      await connection.query(`INSERT INTO account_action_requests (company_id, user_id, user_name, user_email, request_type, status, requested_at, reviewed_at, reviewed_by, review_note) VALUES (?, ?, ?, ?, 'account_deletion', 'approved', NOW(), NOW(), ?, ?)`, [companyId, userId, user.name, user.email, adminId, note]);
    }
    await connection.query("UPDATE staff SET user_user_id = NULL WHERE user_user_id = ? AND company_id = ?", [userId, companyId]);
    // Null out all FK references to this user before deleting
    await connection.query("UPDATE public_holidays SET created_by = NULL WHERE created_by = ? AND company_id = ?", [userId, companyId]);
    await connection.query("UPDATE claims_and_loans SET created_by = NULL WHERE created_by = ? AND company_id = ?", [userId, companyId]);
    await connection.query("DELETE FROM user_privacy_settings WHERE user_id = ?", [userId]);
    await connection.query("DELETE FROM notification WHERE user_id = ? AND company_id = ?", [userId, companyId]);
    // audit_logs.user_id — null it out to preserve audit history
    await connection.query("UPDATE audit_logs SET user_id = NULL WHERE user_id = ? AND company_id = ?", [userId, companyId]);
    await connection.query("DELETE FROM user WHERE user_id = ? AND company_id = ?", [userId, companyId]);
    await connection.commit();
    return { deleted: true, user: { userId, name: user.name, email: user.email } };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function resetUserSettings(userId) {
  await ensurePrivacyTables();
  await Promise.all([
    pool.query(
      `UPDATE user SET notification_preferences = NULL, payroll_config_json = NULL,
       connected_accounts_json = NULL, theme = 'system', accent_color = '#F38978',
       compact_mode = 0, font_size = 'medium', ui_language = 'en',
       api_key = NULL, webhook_url = NULL, webhook_secret = NULL, webhooks_enabled = 0
       WHERE user_id = ?`,
      [userId]
    ),
    pool.query("DELETE FROM user_privacy_settings WHERE user_id = ?", [userId])
  ]);
}

// ─── Subscription Settings ──────────────────────────────────────────────────

async function getSubscriptionSettings(userId) {
  const [rows] = await pool.query(
    "SELECT subscription_settings_json FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0] || !rows[0].subscription_settings_json) return null;
  let config = rows[0].subscription_settings_json;
  if (typeof config === "string") {
    try { return JSON.parse(config); } catch { return null; }
  }
  return config;
}

async function upsertSubscriptionSettings(userId, data) {
  await pool.query(
    "UPDATE user SET subscription_settings_json = ? WHERE user_id = ?",
    [JSON.stringify(data), userId]
  );
}

// ─── Payment Settings ───────────────────────────────────────────────────────

async function getPaymentSettings(userId) {
  const [rows] = await pool.query(
    "SELECT payment_settings_json FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0] || !rows[0].payment_settings_json) return null;
  let config = rows[0].payment_settings_json;
  if (typeof config === "string") {
    try { return JSON.parse(config); } catch { return null; }
  }
  return config;
}

async function upsertPaymentSettings(userId, data) {
  await pool.query(
    "UPDATE user SET payment_settings_json = ? WHERE user_id = ?",
    [JSON.stringify(data), userId]
  );
}

// ─── Email Settings ─────────────────────────────────────────────────────────

async function getEmailSettings(userId) {
  const [rows] = await pool.query(
    "SELECT email_settings_json FROM user WHERE user_id = ?",
    [userId]
  );
  if (!rows[0] || !rows[0].email_settings_json) return null;
  let config = rows[0].email_settings_json;
  if (typeof config === "string") {
    try { return JSON.parse(config); } catch { return null; }
  }
  return config;
}

async function upsertEmailSettings(userId, data) {
  await pool.query(
    "UPDATE user SET email_settings_json = ? WHERE user_id = ?",
    [JSON.stringify(data), userId]
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
  getSubscriptionSettings,
  upsertSubscriptionSettings,
  getPaymentSettings,
  upsertPaymentSettings,
  getEmailSettings,
  upsertEmailSettings,
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
  upsertApiSettings,
  getPrivacySettings,
  upsertPrivacySettings,
  getPersonalDataExport,
  createAccountActionRequest,
  notifyAdminsOfDeletionRequest,
  listDeletionRequests,
  reviewDeletionRequest,
  deleteUserAccountByAdmin,
  resetUserSettings
};
