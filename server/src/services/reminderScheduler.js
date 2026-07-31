/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Provides reusable reminder Scheduler business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const {
  createReminderLog,
  findDueInvoicesForRule,
  listReminderSettings
} = require("../models/reminderModel");
const {
  calculateInvoiceLateFee,
  getInvoiceSettings
} = require("../models/invoiceSettingsModel");
const { sendReminderEmail } = require("./emailService");
const { notifyReminderSent } = require("./invoiceNotificationService");
const { runWithTenant } = require("./tenantContext");

let schedulerStarted = false;
let schedulerRunning = false;

// PRESENTATION NOTE:
// The automatic reminder scheduler wakes up every 60 seconds. It only sends
// reminders when the saved policy time matches the current Singapore time.
const SCHEDULER_INTERVAL_MS = 60 * 1000;

function getTimeInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone || "Asia/Singapore"
  }).formatToParts(new Date());

  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

function normalizeTime(value) {
  return String(value || "").slice(0, 5);
}

function shouldRunForFrequency(frequency, timezone) {
  const dayName = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: timezone || "Asia/Singapore"
  }).format(new Date());

  if (frequency === "Daily") {
    return true;
  }

  if (frequency === "Weekdays") {
    return dayName !== "Sat" && dayName !== "Sun";
  }

  if (frequency === "Weekly") {
    return dayName === "Mon";
  }

  return false;
}

function getReminderIntervals(rule) {
  const intervals = [
    { type: "1st Reminder", days: rule.firstReminderDays },
    { type: "2nd Reminder", days: rule.secondReminderDays }
  ];

  if (rule.finalReminderDays) {
    intervals.push({ type: "Final Reminder", days: rule.finalReminderDays });
  }

  return intervals.filter((interval) => Number(interval.days) > 0);
}

// PRESENTATION NOTE:
// This processes one company's saved reminder policy.
// Path:
// reminder_settings -> processReminderRule -> findDueInvoicesForRule()
// -> sendReminderEmail() -> createReminderLog()
async function processReminderRule(rule) {
  if (!rule.enabled || rule.deliveryChannel !== "Email") {
    return;
  }

  const nowForRule = getTimeInTimezone(rule.timezone);
  if (nowForRule !== normalizeTime(rule.reminderTime)) {
    return;
  }

  if (!shouldRunForFrequency(rule.frequency, rule.timezone)) {
    return;
  }

  const invoiceSettings = await getInvoiceSettings(rule.companyId);

  for (const interval of getReminderIntervals(rule)) {
    const invoices = await findDueInvoicesForRule(rule, interval.type, interval.days);

    for (const invoice of invoices) {
      try {
        const lateFee = calculateInvoiceLateFee({
          status: invoice.status,
          total_amount: invoice.amountDue,
          due_date: invoice.dueDate
        }, invoiceSettings);
        await sendReminderEmail({
          rule,
          invoice: {
            ...invoice,
            amountDue: lateFee.amountDue
          }
        });
        await createReminderLog({
          companyId: rule.companyId,
          reminderSettingId: rule.id,
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          clientEmail: invoice.clientEmail,
          reminderType: interval.type,
          deliveryChannel: "Email",
          deliveryStatus: "Sent"
        });
        await notifyReminderSent(invoice.invoiceNumber, invoice.clientName, interval.type);
      } catch (error) {
        await createReminderLog({
          companyId: rule.companyId,
          reminderSettingId: rule.id,
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          clientEmail: invoice.clientEmail,
          reminderType: interval.type,
          deliveryChannel: "Email",
          deliveryStatus: "Failed",
          errorMessage: error.message
        });
      }
    }
  }
}

// PRESENTATION NOTE:
// This starts the automatic customer reminder scheduler.
// It is called from server/src/server.js after the database is ready.
async function startReminderScheduler() {
  if (schedulerStarted) {
    return true;
  }

  try {
    await listReminderSettings();
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Reminder scheduler disabled:", error.message);
    }
    return false;
  }

  schedulerStarted = true;
  setInterval(async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const rules = await listReminderSettings();
      for (const rule of rules) {
        await runWithTenant(rule.companyId, () => processReminderRule(rule));
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Reminder scheduler skipped:", error.message);
      }
    } finally {
      schedulerRunning = false;
    }
  }, SCHEDULER_INTERVAL_MS);

  return true;
}

module.exports = {
  startReminderScheduler
};
