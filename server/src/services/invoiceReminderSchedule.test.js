const {
  daysOverdue,
  nextReminderDue,
  reminderSequence,
  scheduledReminderType
} = require("./invoiceReminderSchedule");

describe("invoice reminder schedule", () => {
  const today = new Date("2026-07-21T04:00:00Z");

  test.each([
    ["2026-07-24", "upcoming_due"],
    ["2026-07-21", "due_today"],
    ["2026-07-18", "overdue_3d"],
    ["2026-07-14", "overdue_recurring"],
    ["2026-07-13", null]
  ])("classifies reminders using the Singapore calendar", (dueDate, expected) => {
    expect(scheduledReminderType(dueDate, today, "Asia/Singapore")).toBe(expected);
  });

  test("calculates overdue days without mixing UTC and Singapore dates", () => {
    expect(daysOverdue("2026-07-18", today, "Asia/Singapore")).toBe(3);
  });

  test("reports the next recurring reminder date", () => {
    expect(nextReminderDue("2026-07-14", today, "Asia/Singapore")).toContain("2026-07-28");
  });

  test("provides readable reminder sequences", () => {
    expect(reminderSequence("overdue_3d")).toBe("First Overdue Reminder");
  });
});
