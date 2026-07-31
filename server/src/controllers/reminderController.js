/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Handles reminder Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
const {
  createReminderSetting,
  findReminderSettingById,
  getReminderSummary,
  listReminderLogs,
  listReminderSettings,
  updateReminderSetting,
  updateReminderStatus
} = require("../models/reminderModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");
const { sendTestReminderEmail } = require("../services/emailService");
const { createNotification } = require("../services/invoiceNotificationService");
const { requireCompanyId } = require("../utils/companyScope");

const requiredPlaceholders = ["{{client_name}}", "{{invoice_number}}", "{{amount_due}}", "{{due_date}}"];

// PRESENTATION NOTE:
// Converts checkbox-like values from the frontend into true/false.
function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value === true || value === 1 || value === "1";
}

// PRESENTATION NOTE:
// Converts the frontend request body into the backend reminder policy shape.
// This keeps admin policy fixed to Email, Asia/Singapore, unpaid-only, and
// stop-when-paid rules.
function normalizeReminderSetting(body) {
  const intervals = body.intervals || {};
  return {
    ruleName: String(body.ruleName || "Invoice overdue reminder").trim(),
    enabled: toBoolean(body.enabled, true),
    frequency: String(body.frequency || "").trim(),
    reminderTime: String(body.reminderTime || "").trim(),
    timezone: "Asia/Singapore",
    deliveryChannel: "Email",
    whatsappEnabled: false,
    firstReminderDays: Number(body.firstReminderDays ?? intervals.firstReminderDays),
    secondReminderDays: Number(body.secondReminderDays ?? intervals.secondReminderDays),
    finalReminderDays: body.finalReminderDays || intervals.finalReminderDays
      ? Number(body.finalReminderDays ?? intervals.finalReminderDays)
      : null,
    unpaidOnly: true,
    stopWhenPaid: true,
    excludeCancelled: true,
    includePdf: false,
    templateName: String(body.templateName || "").trim(),
    emailSubject: String(body.emailSubject || "").trim(),
    emailBody: String(body.emailBody || "").trim()
  };
}

// PRESENTATION NOTE:
// Backend validation. Even if frontend validation is bypassed, backend still
// checks reminder days, email subject/body, and required placeholders.
function validateReminderSetting(setting) {
  const errors = [];

  if (!setting.frequency) errors.push("Reminder frequency is required.");
  if (!["Daily", "Weekdays"].includes(setting.frequency)) {
    errors.push("Reminder frequency must be Daily or Weekdays.");
  }
  if (!setting.reminderTime) errors.push("Reminder time is required.");
  if (!setting.timezone) errors.push("Time zone is required.");
  if (!setting.deliveryChannel) errors.push("Delivery channel is required.");
  if (setting.deliveryChannel !== "Email") errors.push("Email must be selected as the priority delivery channel.");
  if (!Number.isInteger(setting.firstReminderDays) || setting.firstReminderDays < 1) {
    errors.push("1st reminder overdue interval must be at least 1 day.");
  }
  if (!Number.isInteger(setting.secondReminderDays) || setting.secondReminderDays <= setting.firstReminderDays) {
    errors.push("2nd reminder overdue interval must be greater than the 1st reminder.");
  }
  if (setting.finalReminderDays && setting.finalReminderDays <= setting.secondReminderDays) {
    errors.push("Final reminder overdue interval must be greater than the 2nd reminder.");
  }
  if (!setting.emailSubject) errors.push("Email subject is required.");
  if (!setting.emailBody) errors.push("Email body is required.");

  const missingPlaceholders = requiredPlaceholders.filter(
    (placeholder) => !setting.emailBody.includes(placeholder)
  );
  if (missingPlaceholders.length > 0) {
    errors.push(`Email body is missing required placeholders: ${missingPlaceholders.join(", ")}.`);
  }

  return errors;
}

function handleReminderError(error, res, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : fallbackMessage
  });
}

// PRESENTATION NOTE:
// GET /api/admin/invoicing/reminder-settings
// Called when AdminReminderSettingsPage.jsx first loads.
// Next file:
// server/src/models/reminderModel.js -> listReminderSettings/listReminderLogs/getReminderSummary
async function getReminderSettings(req, res) {
  try {
    const companyId = requireCompanyId(req);
    const [settings, logs, summary] = await Promise.all([
      listReminderSettings(companyId),
      listReminderLogs(companyId, 25),
      getReminderSummary(companyId)
    ]);

    res.json({ settings, logs, summary });
  } catch (error) {
    handleReminderError(error, res, "Unable to load reminder settings.");
  }
}

// PRESENTATION NOTE:
// POST /api/admin/invoicing/reminder-settings
// Called when admin saves a policy for the first time.
// It writes to reminder_settings and also records audit/notification events.
async function postReminderSetting(req, res) {
  try {
    const companyId = requireCompanyId(req);
    const existing = await listReminderSettings(companyId);
    if (existing.length > 0) {
      return res.status(409).json({
        message: "This company already has a reminder policy. Update the existing policy instead."
      });
    }
    const setting = normalizeReminderSetting(req.body);
    const errors = validateReminderSetting(setting);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const created = await createReminderSetting(setting, companyId, req.user?.userId);
    await logAuditEvent({
      module: "Invoice",
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `Created reminder rule ${created.ruleName}`,
      affectedRecord: String(created.id),
      status: "Success",
      ipAddress: getClientIp(req)
    });
    await createNotification({
      type: "reminder_policy_updated",
      title: "Invoice Reminder Policy Created",
      message: `Admin created the invoice reminder policy (${created.firstReminderDays}, ${created.secondReminderDays}, ${created.finalReminderDays} days overdue).`
    });
    res.status(201).json({ setting: created });
  } catch (error) {
    handleReminderError(error, res, "Unable to save reminder setting.");
  }
}

// PRESENTATION NOTE:
// PUT /api/admin/invoicing/reminder-settings/:id
// Called when admin edits an existing policy and clicks Save.
// It updates reminder_settings through reminderModel.js.
async function putReminderSetting(req, res) {
  try {
    const companyId = requireCompanyId(req);
    const current = await findReminderSettingById(req.params.id, companyId);
    if (!current) {
      return res.status(404).json({ message: "Reminder rule not found." });
    }

    const setting = normalizeReminderSetting(req.body);
    const errors = validateReminderSetting(setting);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const updated = await updateReminderSetting(
      req.params.id,
      setting,
      companyId,
      req.user?.userId
    );
    await logAuditEvent({
      module: "Invoice",
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `Updated reminder rule ${updated.ruleName}`,
      affectedRecord: String(updated.id),
      status: "Success",
      ipAddress: getClientIp(req)
    });
    await createNotification({
      type: "reminder_policy_updated",
      title: "Invoice Reminder Policy Updated",
      message: `Admin updated automatic invoice reminders to ${updated.firstReminderDays}, ${updated.secondReminderDays}, and ${updated.finalReminderDays} days overdue.`
    });
    res.json({ setting: updated });
  } catch (error) {
    handleReminderError(error, res, "Unable to update reminder setting.");
  }
}

// PRESENTATION NOTE:
// PATCH /api/admin/invoicing/reminder-settings/:id/status
// Used when a page needs to enable or disable a saved reminder policy.
async function patchReminderStatus(req, res) {
  try {
    const companyId = requireCompanyId(req);
    const enabled = toBoolean(req.body.enabled, false);
    const current = await findReminderSettingById(req.params.id, companyId);
    if (!current) {
      return res.status(404).json({ message: "Reminder rule not found." });
    }

    const updated = await updateReminderStatus(
      req.params.id,
      enabled,
      companyId,
      req.user?.userId
    );
    await logAuditEvent({
      module: "Invoice",
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `${enabled ? "Enabled" : "Disabled"} reminder rule ${updated.ruleName}`,
      affectedRecord: String(updated.id),
      status: "Success",
      ipAddress: getClientIp(req)
    });
    await createNotification({
      type: "reminder_policy_updated",
      title: `Invoice Reminders ${enabled ? "Enabled" : "Disabled"}`,
      message: `Admin ${enabled ? "enabled" : "disabled"} automatic customer invoice reminders.`
    });
    res.json({ setting: updated });
  } catch (error) {
    handleReminderError(error, res, "Unable to update reminder status.");
  }
}

// PRESENTATION NOTE:
// GET /api/admin/invoicing/reminder-logs
// Reads reminder_logs so admin can review sent/failed deliveries.
async function getReminderLogs(req, res) {
  try {
    const companyId = requireCompanyId(req);
    const logs = await listReminderLogs(companyId, 100);
    res.json({ logs });
  } catch (error) {
    handleReminderError(error, res, "Unable to load reminder logs.");
  }
}

// PRESENTATION NOTE:
// POST /api/admin/invoicing/reminders/test
// Called by "Send Test Email". It sends a sample email using the current form
// values without saving the policy to the database.
async function postTestReminder(req, res) {
  try {
    const to = String(req.body.to || "").trim();
    const setting = normalizeReminderSetting(req.body.setting || req.body);
    const errors = validateReminderSetting(setting);

    if (!to) {
      return res.status(400).json({ message: "Test recipient email is required." });
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    await sendTestReminderEmail({ to, rule: setting });
    await logAuditEvent({
      module: "Invoice",
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `Sent test reminder email to ${to}`,
      affectedRecord: setting.ruleName,
      status: "Success",
      ipAddress: getClientIp(req)
    });
    res.json({ message: "Test reminder email sent." });
  } catch (error) {
    res.status(500).json({ message: `Unable to send test reminder email: ${error.message}` });
  }
}

module.exports = {
  getReminderLogs,
  getReminderSettings,
  patchReminderStatus,
  postReminderSetting,
  postTestReminder,
  putReminderSetting
};
