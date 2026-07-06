const {
  createReminderSetting,
  deleteReminderSetting,
  findReminderSettingById,
  getReminderSummary,
  listReminderLogs,
  listReminderSettings,
  updateReminderSetting,
  updateReminderStatus
} = require("../models/reminderModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");
const { sendTestReminderEmail } = require("../services/emailService");

const requiredPlaceholders = ["{{client_name}}", "{{invoice_number}}", "{{amount_due}}", "{{due_date}}"];

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  return value === true || value === 1 || value === "1";
}

function normalizeReminderSetting(body) {
  const intervals = body.intervals || {};
  return {
    ruleName: String(body.ruleName || "Invoice overdue reminder").trim(),
    enabled: toBoolean(body.enabled, true),
    frequency: String(body.frequency || "").trim(),
    reminderTime: String(body.reminderTime || "").trim(),
    timezone: String(body.timezone || "").trim(),
    deliveryChannel: String(body.deliveryChannel || "").trim(),
    whatsappEnabled: toBoolean(body.whatsappEnabled, false),
    firstReminderDays: Number(body.firstReminderDays ?? intervals.firstReminderDays),
    secondReminderDays: Number(body.secondReminderDays ?? intervals.secondReminderDays),
    finalReminderDays: body.finalReminderDays || intervals.finalReminderDays
      ? Number(body.finalReminderDays ?? intervals.finalReminderDays)
      : null,
    unpaidOnly: toBoolean(body.unpaidOnly, true),
    stopWhenPaid: toBoolean(body.stopWhenPaid, true),
    excludeCancelled: toBoolean(body.excludeCancelled, true),
    includePdf: toBoolean(body.includePdf, true),
    templateName: String(body.templateName || "").trim(),
    emailSubject: String(body.emailSubject || "").trim(),
    emailBody: String(body.emailBody || "").trim()
  };
}

function validateReminderSetting(setting) {
  const errors = [];

  if (!setting.frequency) errors.push("Reminder frequency is required.");
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

async function getReminderSettings(req, res) {
  try {
    const [settings, logs, summary] = await Promise.all([
      listReminderSettings(),
      listReminderLogs(25),
      getReminderSummary()
    ]);

    res.json({ settings, logs, summary });
  } catch (error) {
    handleReminderError(error, res, "Unable to load reminder settings.");
  }
}

async function postReminderSetting(req, res) {
  try {
    const setting = normalizeReminderSetting(req.body);
    const errors = validateReminderSetting(setting);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const created = await createReminderSetting(setting);
    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `Created reminder rule ${created.ruleName}`,
      affectedRecord: String(created.id),
      status: "Success",
      ipAddress: getClientIp(req)
    });
    res.status(201).json({ setting: created });
  } catch (error) {
    handleReminderError(error, res, "Unable to save reminder setting.");
  }
}

async function putReminderSetting(req, res) {
  try {
    const current = await findReminderSettingById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: "Reminder rule not found." });
    }

    const setting = normalizeReminderSetting(req.body);
    const errors = validateReminderSetting(setting);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const updated = await updateReminderSetting(req.params.id, setting);
    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `Updated reminder rule ${updated.ruleName}`,
      affectedRecord: String(updated.id),
      status: "Success",
      ipAddress: getClientIp(req)
    });
    res.json({ setting: updated });
  } catch (error) {
    handleReminderError(error, res, "Unable to update reminder setting.");
  }
}

async function patchReminderStatus(req, res) {
  try {
    const enabled = toBoolean(req.body.enabled, false);
    const current = await findReminderSettingById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: "Reminder rule not found." });
    }

    const updated = await updateReminderStatus(req.params.id, enabled);
    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `${enabled ? "Enabled" : "Disabled"} reminder rule ${updated.ruleName}`,
      affectedRecord: String(updated.id),
      status: "Success",
      ipAddress: getClientIp(req)
    });
    res.json({ setting: updated });
  } catch (error) {
    handleReminderError(error, res, "Unable to update reminder status.");
  }
}

async function deleteReminder(req, res) {
  try {
    const deleted = await deleteReminderSetting(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Reminder rule not found." });
    }

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Reminder Settings",
      actionDescription: `Deleted reminder rule ${req.params.id}`,
      affectedRecord: String(req.params.id),
      status: "Warning",
      ipAddress: getClientIp(req)
    });

    res.json({ message: "Reminder rule deleted." });
  } catch (error) {
    handleReminderError(error, res, "Unable to delete reminder setting.");
  }
}

async function getReminderLogs(req, res) {
  try {
    const logs = await listReminderLogs(100);
    res.json({ logs });
  } catch (error) {
    handleReminderError(error, res, "Unable to load reminder logs.");
  }
}

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
  deleteReminder,
  getReminderLogs,
  getReminderSettings,
  patchReminderStatus,
  postReminderSetting,
  postTestReminder,
  putReminderSetting
};
