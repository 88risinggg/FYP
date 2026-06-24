const { pool } = require("../config/db");

const missingReminderTableMessage =
  "Reminder database tables are missing. Add reminder_settings and reminder_logs manually in MySQL before using this feature.";

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
    ruleName: row.rule_name,
    enabled: Boolean(row.is_enabled),
    frequency: row.frequency,
    reminderTime: row.reminder_time,
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

async function listReminderSettings() {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM reminder_settings
       ORDER BY created_at DESC, reminder_setting_id DESC`
    );

    return rows.map(mapReminder);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function findReminderSettingById(id) {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM reminder_settings WHERE reminder_setting_id = ?",
      [id]
    );

    return rows[0] ? mapReminder(rows[0]) : null;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function createReminderSetting(setting) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO reminder_settings (
        rule_name, is_enabled, frequency, reminder_time, timezone, delivery_channel,
        whatsapp_enabled, first_reminder_days, second_reminder_days, final_reminder_days,
        unpaid_only, stop_when_paid, exclude_cancelled, include_pdf,
        template_name, email_subject, email_body
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        setting.ruleName,
        setting.enabled ? 1 : 0,
        setting.frequency,
        setting.reminderTime,
        setting.timezone,
        setting.deliveryChannel,
        setting.whatsappEnabled ? 1 : 0,
        setting.firstReminderDays,
        setting.secondReminderDays,
        setting.finalReminderDays,
        setting.unpaidOnly ? 1 : 0,
        setting.stopWhenPaid ? 1 : 0,
        setting.excludeCancelled ? 1 : 0,
        setting.includePdf ? 1 : 0,
        setting.templateName,
        setting.emailSubject,
        setting.emailBody
      ]
    );

    return findReminderSettingById(result.insertId);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function updateReminderSetting(id, setting) {
  try {
    await pool.execute(
      `UPDATE reminder_settings
       SET rule_name = ?,
           is_enabled = ?,
           frequency = ?,
           reminder_time = ?,
           timezone = ?,
           delivery_channel = ?,
           whatsapp_enabled = ?,
           first_reminder_days = ?,
           second_reminder_days = ?,
           final_reminder_days = ?,
           unpaid_only = ?,
           stop_when_paid = ?,
           exclude_cancelled = ?,
           include_pdf = ?,
           template_name = ?,
           email_subject = ?,
           email_body = ?
       WHERE reminder_setting_id = ?`,
      [
        setting.ruleName,
        setting.enabled ? 1 : 0,
        setting.frequency,
        setting.reminderTime,
        setting.timezone,
        setting.deliveryChannel,
        setting.whatsappEnabled ? 1 : 0,
        setting.firstReminderDays,
        setting.secondReminderDays,
        setting.finalReminderDays,
        setting.unpaidOnly ? 1 : 0,
        setting.stopWhenPaid ? 1 : 0,
        setting.excludeCancelled ? 1 : 0,
        setting.includePdf ? 1 : 0,
        setting.templateName,
        setting.emailSubject,
        setting.emailBody,
        id
      ]
    );

    return findReminderSettingById(id);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function updateReminderStatus(id, enabled) {
  try {
    await pool.execute("UPDATE reminder_settings SET is_enabled = ? WHERE reminder_setting_id = ?", [
      enabled ? 1 : 0,
      id
    ]);

    return findReminderSettingById(id);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function deleteReminderSetting(id) {
  try {
    const [result] = await pool.execute(
      "DELETE FROM reminder_settings WHERE reminder_setting_id = ?",
      [id]
    );

    return result.affectedRows > 0;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function listReminderLogs(limit = 100) {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM reminder_logs
       ORDER BY sent_at DESC, reminder_log_id DESC
       LIMIT ?`,
      [Number(limit)]
    );

    return rows.map(mapLog);
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function createReminderLog(log) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO reminder_logs (
        reminder_setting_id, invoice_id, invoice_number, client_email,
        reminder_type, delivery_channel, delivery_status, sent_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        log.reminderSettingId,
        log.invoiceId,
        log.invoiceNumber,
        log.clientEmail,
        log.reminderType,
        log.deliveryChannel,
        log.deliveryStatus,
        log.errorMessage || null
      ]
    );

    return result.insertId;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function findDueInvoicesForRule(rule, reminderType, overdueDays) {
  try {
    const statusFilter = rule.excludeCancelled
      ? "invoice.status NOT IN ('Paid', 'Cancelled')"
      : "invoice.status <> 'Paid'";

    const [rows] = await pool.execute(
      `SELECT
        invoice.invoice_id AS invoiceId,
        COALESCE(invoice.invoiceId, CONCAT('INV-', invoice.invoice_id)) AS invoiceNumber,
        invoice.total_amount AS amountDue,
        invoice.due_date AS dueDate,
        DATEDIFF(CURDATE(), invoice.due_date) AS overdueDays,
        customer.name AS clientName,
        customer.email AS clientEmail
      FROM invoice
      JOIN customer ON invoice.customer_id = customer.customer_id
      WHERE ${statusFilter}
        AND invoice.due_date IS NOT NULL
        AND customer.email IS NOT NULL
        AND DATEDIFF(CURDATE(), invoice.due_date) >= ?
        AND NOT EXISTS (
          SELECT 1
          FROM reminder_logs
          WHERE reminder_logs.invoice_id = invoice.invoice_id
            AND reminder_logs.reminder_setting_id = ?
            AND reminder_logs.reminder_type = ?
            AND reminder_logs.delivery_status = 'Sent'
        )`,
      [overdueDays, rule.id, reminderType]
    );

    return rows;
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

async function getReminderSummary() {
  try {
    const [settingsRows] = await pool.execute(
      "SELECT COUNT(*) AS activeRules FROM reminder_settings WHERE is_enabled = 1"
    );
    const [sentRows] = await pool.execute(
      `SELECT
        SUM(delivery_status = 'Sent') AS sentToday,
        SUM(delivery_status = 'Failed') AS failedDeliveries
       FROM reminder_logs
       WHERE DATE(sent_at) = CURDATE()`
    );
    const [paidRows] = await pool.execute(
      "SELECT COUNT(*) AS paidInvoicesExcluded FROM invoice WHERE status = 'Paid'"
    );

    return {
      activeReminderRules: Number(settingsRows[0]?.activeRules || 0),
      remindersSentToday: Number(sentRows[0]?.sentToday || 0),
      failedDeliveries: Number(sentRows[0]?.failedDeliveries || 0),
      paidInvoicesExcluded: Number(paidRows[0]?.paidInvoicesExcluded || 0)
    };
  } catch (error) {
    handleDatabaseShapeError(error);
  }
}

module.exports = {
  createReminderLog,
  createReminderSetting,
  deleteReminderSetting,
  findDueInvoicesForRule,
  findReminderSettingById,
  getReminderSummary,
  listReminderLogs,
  listReminderSettings,
  missingReminderTableMessage,
  updateReminderSetting,
  updateReminderStatus
};
