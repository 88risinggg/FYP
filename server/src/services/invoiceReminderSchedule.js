const APPLICATION_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Singapore";

const REMINDER_SCHEDULE = {
  UPCOMING_DUE: -3,
  DUE_TODAY: 0,
  OVERDUE_3D: 3,
  OVERDUE_RECURRING: 7
};

function calendarParts(value, timeZone = APPLICATION_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function calendarOrdinal(value, timeZone = APPLICATION_TIMEZONE) {
  const parts = calendarParts(value, timeZone);
  return parts ? Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000) : null;
}

function daysOverdue(dueDate, now = new Date(), timeZone = APPLICATION_TIMEZONE) {
  const dueOrdinal = calendarOrdinal(dueDate, timeZone);
  const todayOrdinal = calendarOrdinal(now, timeZone);
  return dueOrdinal === null || todayOrdinal === null ? null : todayOrdinal - dueOrdinal;
}

function scheduledReminderType(dueDate, now = new Date(), timeZone = APPLICATION_TIMEZONE) {
  const overdueDays = daysOverdue(dueDate, now, timeZone);
  if (overdueDays === REMINDER_SCHEDULE.UPCOMING_DUE) return "upcoming_due";
  if (overdueDays === REMINDER_SCHEDULE.DUE_TODAY) return "due_today";
  if (overdueDays === REMINDER_SCHEDULE.OVERDUE_3D) return "overdue_3d";
  if (overdueDays > REMINDER_SCHEDULE.OVERDUE_3D && overdueDays % REMINDER_SCHEDULE.OVERDUE_RECURRING === 0) {
    return "overdue_recurring";
  }
  return null;
}

function reminderSequence(type) {
  return {
    upcoming_due: "Upcoming Due Reminder",
    due_today: "Due Today Reminder",
    overdue_3d: "First Overdue Reminder",
    overdue_recurring: "Recurring Overdue Reminder",
    manual: "Manual Reminder"
  }[type] || String(type || "Payment Reminder").replaceAll("_", " ");
}

function addCalendarDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString();
}

function nextReminderDue(dueDate, now = new Date(), timeZone = APPLICATION_TIMEZONE) {
  const overdueDays = daysOverdue(dueDate, now, timeZone);
  if (overdueDays === null) return null;
  if (overdueDays < -3) return addCalendarDays(dueDate, -3);
  if (overdueDays < 0) return addCalendarDays(dueDate, 0);
  if (overdueDays < 3) return addCalendarDays(dueDate, 3);
  const nextRecurringDay = Math.max(7, (Math.floor(overdueDays / 7) + 1) * 7);
  return addCalendarDays(dueDate, nextRecurringDay);
}

module.exports = {
  APPLICATION_TIMEZONE,
  REMINDER_SCHEDULE,
  daysOverdue,
  nextReminderDue,
  reminderSequence,
  scheduledReminderType
};
