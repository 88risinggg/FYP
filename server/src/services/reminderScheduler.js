const cron = require("node-cron");

const {
  createReminderLog,
  findDueInvoicesForRule,
  listReminderSettings
} = require("../models/reminderModel");
const { sendReminderEmail } = require("./emailService");

let schedulerStarted = false;

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

  for (const interval of getReminderIntervals(rule)) {
    const invoices = await findDueInvoicesForRule(rule, interval.type, interval.days);

    for (const invoice of invoices) {
      try {
        await sendReminderEmail({ rule, invoice });
        await createReminderLog({
          reminderSettingId: rule.id,
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          clientEmail: invoice.clientEmail,
          reminderType: interval.type,
          deliveryChannel: "Email",
          deliveryStatus: "Sent"
        });
      } catch (error) {
        await createReminderLog({
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

function startReminderScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  cron.schedule("* * * * *", async () => {
    try {
      const rules = await listReminderSettings();
      for (const rule of rules) {
        await processReminderRule(rule);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Reminder scheduler skipped:", error.message);
      }
    }
  });
}

module.exports = {
  startReminderScheduler
};
