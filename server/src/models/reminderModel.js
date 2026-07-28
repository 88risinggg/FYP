const { pool } = require("../config/db");

const missingReminderTableMessage =
  "Reminder database tables are missing. Run npm run db:invoice-reminder-policy in the server directory and restart the server.";

function isMissingTableError(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";
}

function handleDatabaseShapeError(error) {
  if (isMissingTableError(error)) {
    const wrapped = new Error(missingReminderTableMessage);
    wrapped.statusCode = 501;
    wrapped.cause = error;
    throw wrapped;
  }
  throw error;
}

function mapReminder(row) {
  return {
    id: row.reminder_setting_id,
    companyId: row.company_id,
    ruleName: row.rule_name,
    enabled: Boolean(row.is_enabled),
    frequency: row.frequency,
    reminderTime: String(row.reminder_time || "").slice(0, 5),
    timezone: row.timezone,
    deliveryChannel: row.delivery_channel,
    whatsappEnabled: Boolean(row.whatsapp_enabled),
    firstReminderDays: row.first_reminder_days,
    secondReminderDays: row.second_reminder_days,
    finalReminderDays: row.final_reminder_days,
    unpaidOnly: Boolean(row.unpaid_only),
    stopWhenPaid: Boolean(row.stop_when_paid),
    excludeCancelled: Boolean(row.exclude_cancelled),
    includePdf: Boolean(row.include_pdf),
    templateName: row.template_name,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLog(row) {
  return {
    id: row.reminder_log_id,
    companyId: row.company_id,
    reminderSettingId: row.reminder_setting_id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    clientEmail: row.client_email,
    reminderType: row.reminder_type,
    deliveryChannel: row.delivery_channel,
    deliveryStatus: row.delivery_status,
    sentAt: row.sent_at,
    errorMessage: row.error_message
  };
}

async function listReminderSettings(companyId = null) {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM reminder_settings
       ${companyId ? "WHERE company_id = ?" : ""}
       ORDER BY created_at DESC, reminder_setting_id DESC`,
      companyId ? [companyId] : []
    );
    return rows.map(mapReminder);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function findReminderSettingById(id, companyId) {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM reminder_settings WHERE reminder_setting_id = ? AND company_id = ?",
      [id, companyId]
    );
    return rows[0] ? mapReminder(rows[0]) : null;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function createReminderSetting(setting, companyId, userId = null) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO reminder_settings (
        company_id, rule_name, is_enabled, frequency, reminder_time, timezone, delivery_channel,
        whatsapp_enabled, first_reminder_days, second_reminder_days, final_reminder_days,
        unpaid_only, stop_when_paid, exclude_cancelled, include_pdf,
        template_name, email_subject, email_body, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        setting.ruleName,
        setting.enabled ? 1 : 0,
        setting.frequency,
        setting.reminderTime,
        setting.timezone,
        setting.deliveryChannel,
        0,
        setting.firstReminderDays,
        setting.secondReminderDays,
        setting.finalReminderDays,
        1,
        1,
        1,
        0,
        setting.templateName,
        setting.emailSubject,
        setting.emailBody,
        userId,
        userId
      ]
    );
    return findReminderSettingById(result.insertId, companyId);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function updateReminderSetting(id, setting, companyId, userId = null) {
  try {
    const [result] = await pool.execute(
      `UPDATE reminder_settings
       SET rule_name = ?,
           is_enabled = ?,
           frequency = ?,
           reminder_time = ?,
           timezone = ?,
           delivery_channel = 'Email',
           whatsapp_enabled = 0,
           first_reminder_days = ?,
           second_reminder_days = ?,
           final_reminder_days = ?,
           unpaid_only = 1,
           stop_when_paid = 1,
           exclude_cancelled = 1,
           include_pdf = 0,
           template_name = ?,
           email_subject = ?,
           email_body = ?,
           updated_by = ?
       WHERE reminder_setting_id = ? AND company_id = ?`,
      [
        setting.ruleName,
        setting.enabled ? 1 : 0,
        setting.frequency,
        setting.reminderTime,
        setting.timezone,
        setting.firstReminderDays,
        setting.secondReminderDays,
        setting.finalReminderDays,
        setting.templateName,
        setting.emailSubject,
        setting.emailBody,
        userId,
        id,
        companyId
      ]
    );
    return result.affectedRows ? findReminderSettingById(id, companyId) : null;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function updateReminderStatus(id, enabled, companyId, userId = null) {
  try {
    const [result] = await pool.execute(
      `UPDATE reminder_settings
       SET is_enabled = ?, updated_by = ?
       WHERE reminder_setting_id = ? AND company_id = ?`,
      [enabled ? 1 : 0, userId, id, companyId]
    );
    return result.affectedRows ? findReminderSettingById(id, companyId) : null;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function listReminderLogs(companyId, limit = 100) {
  try {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
    const [rows] = await pool.execute(
      `SELECT *
       FROM reminder_logs
       WHERE company_id = ?
       ORDER BY sent_at DESC, reminder_log_id DESC
       LIMIT ${safeLimit}`,
      [companyId]
    );
    return rows.map(mapLog);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function createReminderLog(log) {
  try {
    const dedupeKey = log.deliveryStatus === "Sent" && log.reminderType !== "Manual Reminder"
      ? `${log.companyId}:${log.reminderSettingId}:${log.invoiceId}:${log.reminderType}`
      : null;
    const [result] = await pool.execute(
      `INSERT INTO reminder_logs (
        company_id, reminder_setting_id, invoice_id, invoice_number, client_email,
        reminder_type, delivery_channel, delivery_status, dedupe_key, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.companyId,
        log.reminderSettingId,
        log.invoiceId,
        log.invoiceNumber,
        log.clientEmail,
        log.reminderType,
        log.deliveryChannel,
        log.deliveryStatus,
        dedupeKey,
        log.errorMessage || null
      ]
    );
    return result.insertId;
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return null;
    handleDatabaseShapeError(error);
  }
}

async function findDueInvoicesForRule(rule, reminderType, overdueDays) {
  try {
    const [rows] = await pool.execute(
      `SELECT
        invoice.invoice_id AS invoiceId,
        COALESCE(invoice.invoiceId, CONCAT('INV-', invoice.invoice_id)) AS invoiceNumber,
        invoice.status AS status,
        invoice.total_amount AS amountDue,
        invoice.due_date AS dueDate,
        invoice.payment_url AS paymentLink,
        DATEDIFF(CURDATE(), invoice.due_date) AS overdueDays,
        customer.name AS clientName,
        customer.email AS clientEmail
      FROM invoice
      JOIN customer ON invoice.customer_id = customer.customer_id
      WHERE invoice.company_id = ?
        AND customer.company_id = ?
        AND invoice.status NOT IN ('Paid', 'Cancelled', 'Void', 'Refunded')
        AND invoice.invoiceId <> '__SETTINGS__'
        AND invoice.due_date IS NOT NULL
        AND customer.email IS NOT NULL
        AND DATEDIFF(CURDATE(), invoice.due_date) >= ?
        AND NOT EXISTS (
          SELECT 1
          FROM reminder_logs
          WHERE reminder_logs.company_id = invoice.company_id
            AND reminder_logs.invoice_id = invoice.invoice_id
            AND reminder_logs.reminder_setting_id = ?
            AND reminder_logs.reminder_type = ?
            AND reminder_logs.delivery_status = 'Sent'
        )`,
      [rule.companyId, rule.companyId, overdueDays, rule.id, reminderType]
    );
    return rows;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function getReminderSummary(companyId) {
  try {
    const [[settingsRow]] = await pool.execute(
      "SELECT COUNT(*) AS activeRules FROM reminder_settings WHERE company_id = ? AND is_enabled = 1",
      [companyId]
    );
    const [[deliveryRow]] = await pool.execute(
      `SELECT
        SUM(delivery_status = 'Sent') AS sentToday,
        SUM(delivery_status = 'Failed') AS failedDeliveries
       FROM reminder_logs
       WHERE company_id = ? AND DATE(sent_at) = CURDATE()`,
      [companyId]
    );
    const [[paidRow]] = await pool.execute(
      "SELECT COUNT(*) AS paidInvoicesExcluded FROM invoice WHERE company_id = ? AND status = 'Paid'",
      [companyId]
    );
    const [[missingEmailRow]] = await pool.execute(
      `SELECT COUNT(*) AS missingCustomerEmails
       FROM invoice
       JOIN customer ON invoice.customer_id = customer.customer_id
       WHERE invoice.company_id = ?
         AND customer.company_id = ?
         AND invoice.status NOT IN ('Paid', 'Cancelled', 'Void', 'Refunded')
         AND (customer.email IS NULL OR TRIM(customer.email) = '')`,
      [companyId, companyId]
    );

    return {
      activeReminderRules: Number(settingsRow?.activeRules || 0),
      remindersSentToday: Number(deliveryRow?.sentToday || 0),
      failedDeliveries: Number(deliveryRow?.failedDeliveries || 0),
      paidInvoicesExcluded: Number(paidRow?.paidInvoicesExcluded || 0),
      missingCustomerEmails: Number(missingEmailRow?.missingCustomerEmails || 0)
    };
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

module.exports = {
  createReminderLog,
  createReminderSetting,
  findDueInvoicesForRule,
  findReminderSettingById,
  getReminderSummary,
  listReminderLogs,
  listReminderSettings,
  missingReminderTableMessage,
  updateReminderSetting,
  updateReminderStatus
};
