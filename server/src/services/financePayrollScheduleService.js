const { pool } = require("../config/db");
const { submitModernTreasuryPayrollBatch } = require("./modernTreasuryPaymentService");
const { notifyRoles } = require("./payrollNotificationService");
const { writeAuditLog, MODULE } = require("./auditService");
const { getPayrollRunComplianceErrors } = require("../models/financePayrollModel");

const TIMEZONE = "Asia/Singapore";
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value) { return String(value).padStart(2, "0"); }
function mysqlDate(year, month, day, time) { return `${year}-${pad(month)}-${pad(day)} ${time}:00`; }
function parseBoolean(value) { return String(value).toLowerCase() === "true"; }
function validDay(value) { const day = Number(value); return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null; }
function validTime(value, fallback) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback; }
function localNowString(now = new Date()) { return new Date(now.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 19).replace("T", " "); }
function nextPeriod(year, month) { return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }; }
function targetPeriodForCutoff(year, month, nowString, cutoffAt) { return cutoffAt && nowString > cutoffAt ? nextPeriod(year, month) : { year, month }; }

function previousBusinessDate(year, month, requestedDay, holidayDates = []) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let day = Math.min(Number(requestedDay), lastDay);
  const holidays = new Set(holidayDates.map((value) => String(value).slice(0, 10)));
  while (day > 1) {
    const candidate = `${year}-${pad(month)}-${pad(day)}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(candidate)) return candidate;
    day -= 1;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function calculatePeriodSchedule(config, year, month, holidayDates = []) {
  const releaseDay = validDay(config.salaryReleaseDay);
  const cutoffDay = validDay(config.claimCutoffDay);
  if (!config.enabled || !releaseDay || !cutoffDay) return { claimCutoffAt: null, scheduledReleaseAt: null };
  const releaseDate = previousBusinessDate(year, month, releaseDay, holidayDates);
  const cutoffDate = previousBusinessDate(year, month, cutoffDay, holidayDates);
  return {
    claimCutoffAt: `${cutoffDate} ${validTime(config.claimCutoffTime, "23:59")}:00`,
    scheduledReleaseAt: `${releaseDate} ${validTime(config.salaryReleaseTime, "09:00")}:00`
  };
}

async function getFinanceScheduleConfig(connection = pool) {
  const [rows] = await connection.query(
    `SELECT configuration_key, configuration_value, updated_at, updated_by
     FROM payroll_configuration WHERE configuration_type = 'finance_schedule'`
  );
  const values = Object.fromEntries(rows.map((row) => [row.configuration_key, row.configuration_value]));
  const latest = rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  return {
    enabled: parseBoolean(values.enabled),
    salaryReleaseDay: validDay(values.salary_release_day),
    salaryReleaseTime: validTime(values.salary_release_time, "09:00"),
    claimCutoffDay: validDay(values.claim_cutoff_day),
    claimCutoffTime: validTime(values.claim_cutoff_time, "23:59"),
    timezone: TIMEZONE,
    updatedAt: latest?.updated_at || null,
    updatedBy: latest?.updated_by || null
  };
}

async function saveFinanceScheduleConfig(input, userId) {
  const enabled = Boolean(input.enabled);
  const releaseDay = validDay(input.salaryReleaseDay);
  const cutoffDay = validDay(input.claimCutoffDay);
  if (enabled && (!releaseDay || !cutoffDay)) throw new Error("Release day and claim cutoff day must be between 1 and 31.");
  if (enabled && cutoffDay > releaseDay) throw new Error("The claim cutoff day must be on or before the salary release day.");
  const values = {
    enabled: String(enabled), salary_release_day: releaseDay ? String(releaseDay) : "",
    salary_release_time: validTime(input.salaryReleaseTime, "09:00"),
    claim_cutoff_day: cutoffDay ? String(cutoffDay) : "",
    claim_cutoff_time: validTime(input.claimCutoffTime, "23:59"), timezone: TIMEZONE
  };
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const [key, value] of Object.entries(values)) {
      await connection.query(
        `INSERT INTO payroll_configuration (configuration_type, configuration_key, configuration_value, description, updated_by)
         VALUES ('finance_schedule', ?, ?, 'Finance payroll operational schedule', ?)
         ON DUPLICATE KEY UPDATE configuration_value = ?, updated_by = ?, updated_at = NOW()`,
        [key, value, userId || null, value, userId || null]
      );
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  return getFinanceScheduleConfig();
}

async function getHolidayDates(connection, year, month) {
  const [rows] = await connection.query(
    `SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holiday_date FROM public_holidays WHERE status = 'Active' AND YEAR(holiday_date) = ? AND MONTH(holiday_date) = ?`,
    [year, month]
  );
  return rows.map((row) => String(row.holiday_date).slice(0, 10));
}

async function previewFinanceSchedule(year, month, input = {}) {
  const config = { ...(await getFinanceScheduleConfig()), ...input };
  if (input.enabled !== undefined) config.enabled = parseBoolean(input.enabled);
  const holidays = await getHolidayDates(pool, year, month);
  return { ...calculatePeriodSchedule(config, year, month, holidays), holidays, timezone: TIMEZONE };
}

async function applyScheduleDefaultsToRun(runId, connection = pool) {
  const [month, year] = String(runId).split("_").map(Number);
  const config = await getFinanceScheduleConfig(connection);
  const dates = calculatePeriodSchedule(config, year, month, await getHolidayDates(connection, year, month));
  if (!dates.claimCutoffAt || !dates.scheduledReleaseAt) return dates;
  await connection.query(
    `UPDATE payroll_run SET effective_claim_cutoff_at = COALESCE(effective_claim_cutoff_at, ?),
       scheduled_release_at = COALESCE(scheduled_release_at, ?),
       release_schedule_status = COALESCE(release_schedule_status, 'Draft')
     WHERE payroll_month = ? AND payroll_year = ? AND approved_at IS NULL`,
    [dates.claimCutoffAt, dates.scheduledReleaseAt, month, year]
  );
  return dates;
}

async function updateRunSchedule(runId, input, userId) {
  const [month, year] = String(runId).split("_").map(Number);
  const [[run]] = await pool.query(`SELECT * FROM payroll_run WHERE payroll_month = ? AND payroll_year = ? LIMIT 1`, [month, year]);
  if (!run) throw new Error("Payroll run not found.");
  if (run.payment_reference || run.payment_attempted_at || ["Released", "Processing"].includes(run.release_schedule_status)) throw new Error("A released or processing payroll run cannot be rescheduled.");
  const cutoff = String(input.claimCutoffAt || "").replace("T", " ").slice(0, 19);
  const release = String(input.scheduledReleaseAt || "").replace("T", " ").slice(0, 19);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(cutoff) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(release)) throw new Error("Valid claim cutoff and release dates are required.");
  if (cutoff >= release) throw new Error("The claim cutoff must be earlier than the scheduled release.");
  await pool.query(
    `UPDATE payroll_run SET effective_claim_cutoff_at = ?, scheduled_release_at = ?,
       release_schedule_status = 'Draft', release_confirmed_by = NULL, release_confirmed_at = NULL,
       release_failure_reason = NULL, updated_at = NOW() WHERE payroll_run_id = ?`,
    [cutoff, release, run.payroll_run_id]
  );
  await writeAuditLog({ module: MODULE.PAYROLL, activityType: "Payroll Schedule", action: `Updated release schedule for ${runId}`, entityId: runId, entityType: "payroll_run", userId });
}

async function confirmRunSchedule(runId, userId) {
  const [month, year] = String(runId).split("_").map(Number);
  const [[run]] = await pool.query(`SELECT * FROM payroll_run WHERE payroll_month = ? AND payroll_year = ? LIMIT 1`, [month, year]);
  if (!run?.approved_at) throw new Error("Finance approval is required before scheduling release.");
  if (!run.scheduled_release_at || !run.effective_claim_cutoff_at) throw new Error("Set the effective cutoff and release dates first.");
  if (run.payment_reference) throw new Error("This payroll run has already been released.");
  const errors = await getPayrollRunComplianceErrors(runId);
  if (errors.length) { const error = new Error("Compliance validation must pass before scheduling release."); error.details = errors; throw error; }
  await pool.query(
    `UPDATE payroll_run SET release_schedule_status = 'Confirmed', release_confirmed_by = ?,
       release_confirmed_at = NOW(), payment_attempted_at = NULL, release_failure_reason = NULL, updated_at = NOW()
     WHERE payroll_run_id = ?`, [userId || null, run.payroll_run_id]
  );
  await writeAuditLog({ module: MODULE.PAYROLL, activityType: "Payroll Schedule", action: `Confirmed scheduled release for ${runId}`, entityId: runId, entityType: "payroll_run", userId });
}

async function cancelRunSchedule(runId, userId) {
  const [month, year] = String(runId).split("_").map(Number);
  const [result] = await pool.query(
    `UPDATE payroll_run SET release_schedule_status = 'Cancelled', release_confirmed_by = NULL,
       release_confirmed_at = NULL, updated_at = NOW()
     WHERE payroll_month = ? AND payroll_year = ? AND payment_attempted_at IS NULL AND payment_reference IS NULL`, [month, year]
  );
  if (!result.affectedRows) throw new Error("This schedule can no longer be cancelled.");
  await writeAuditLog({ module: MODULE.PAYROLL, activityType: "Payroll Schedule", action: `Cancelled scheduled release for ${runId}`, entityId: runId, entityType: "payroll_run", userId });
}

async function markRunForManualRetry(runId, userId) {
  const [month, year] = String(runId).split("_").map(Number);
  const [result] = await pool.query(
    `UPDATE payroll_run SET release_schedule_status = 'Confirmed', payment_attempted_at = NULL,
       release_failure_reason = NULL, release_confirmed_by = ?, release_confirmed_at = NOW(), updated_at = NOW()
     WHERE payroll_month = ? AND payroll_year = ? AND release_schedule_status = 'Release Failed' AND payment_reference IS NULL`,
    [userId || null, month, year]
  );
  if (!result.affectedRows) throw new Error("Only a failed unreleased run can be retried.");
}

async function claimTargetForApproval(connection, now = new Date()) {
  const local = new Date(now.getTime() + SINGAPORE_OFFSET_MS);
  let month = local.getUTCMonth() + 1;
  let year = local.getUTCFullYear();
  const config = await getFinanceScheduleConfig(connection);
  const holidays = await getHolidayDates(connection, year, month);
  const schedule = calculatePeriodSchedule(config, year, month, holidays);
  ({ month, year } = targetPeriodForCutoff(year, month, localNowString(now), schedule.claimCutoffAt));
  const [[locked]] = await connection.query(
    `SELECT COUNT(*) AS count FROM payroll_run WHERE payroll_month = ? AND payroll_year = ?
       AND (approved_at IS NOT NULL OR LOWER(status) IN ('payment processed','payslips sent','reconciled'))`,
    [month, year]
  );
  if (Number(locked.count) > 0) ({ month, year } = nextPeriod(year, month));
  return { month, year, cutoffAt: schedule.claimCutoffAt };
}

async function executeScheduledRelease(payrollRunId) {
  const connection = await pool.getConnection();
  let run;
  try {
    await connection.beginTransaction();
    [[run]] = await connection.query(`SELECT * FROM payroll_run WHERE payroll_run_id = ? FOR UPDATE`, [payrollRunId]);
    if (!run || run.release_schedule_status !== "Confirmed" || run.payment_attempted_at || run.payment_reference) { await connection.rollback(); return { skipped: true }; }
    await connection.query(`UPDATE payroll_run SET release_schedule_status = 'Processing', payment_attempted_at = NOW(), updated_at = NOW() WHERE payroll_run_id = ?`, [payrollRunId]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }

  const runId = `${run.payroll_month}_${run.payroll_year}`;
  try {
    const errors = await getPayrollRunComplianceErrors(runId);
    if (errors.length) throw new Error(`Server compliance validation failed: ${errors.map((item) => item.message).join("; ")}`);
    const configuration = typeof run.configuration_json === "object" ? run.configuration_json : JSON.parse(run.configuration_json || "{}");
    const recipients = configuration.paymentRecipients || {};
    const [rows] = await pool.query(
      `SELECT p.staff_employee_id, p.net_salary, p.payslip_status, s.name, s.email, s.bank, s.account_no
       FROM payroll p JOIN staff s ON s.employee_id = p.staff_employee_id WHERE p.payroll_run_id = ?`, [payrollRunId]
    );
    const approved = rows.filter((row) => ["Approved", "finance_approved"].includes(row.payslip_status));
    if (!approved.length) throw new Error("No approved employee payments are available.");
    const employees = approved.map((row) => ({
      employeeId: row.staff_employee_id, employeeName: row.name, email: row.email,
      bankName: row.bank, bankAccount: row.account_no, amount: Number(row.net_salary), currency: "SGD",
      ...(recipients[String(row.staff_employee_id)] || {})
    }));
    if (employees.some((item) => !item.bankName || !item.bankAccount || !item.modernTreasuryCounterpartyId || !item.modernTreasuryReceivingAccountId)) throw new Error("One or more approved employees are missing bank or Modern Treasury recipient details.");
    const result = await submitModernTreasuryPayrollBatch({ payrollRunId: runId, payrollPeriod: `${pad(run.payroll_month)}/${run.payroll_year}`, employees });
    const now = new Date().toISOString();
    configuration.workflow = { ...(configuration.workflow || {}), paidAt: now, paymentProvider: result.provider, paymentTransferCount: result.transferCount };
    await pool.query(
      `UPDATE payroll_run SET status = 'Payment Processed', release_schedule_status = 'Released', payment_reference = ?,
       configuration_json = ?, release_failure_reason = NULL, updated_at = NOW() WHERE payroll_run_id = ?`,
      [result.batchReference, JSON.stringify(configuration), payrollRunId]
    );
    await pool.query(`UPDATE payroll SET run_status = 'Payment Processed', payment_reference = ?, configuration_json = ? WHERE payroll_run_id = ?`, [result.batchReference, JSON.stringify(configuration), payrollRunId]);
    await writeAuditLog({ module: MODULE.PAYROLL, activityType: "Payroll Payment", action: `Automatically released scheduled payroll ${runId}`, entityId: runId, entityType: "payroll_run", status: "Success" });
    await notifyRoles("Finance", { type: "payroll_release_success", title: "Scheduled payroll released", message: `Payroll ${runId} was released successfully.`, entityType: "payroll_run", entityId: runId, actionPath: "/dashboard/payroll/finance/payroll-runs" });
    return { released: true, result };
  } catch (error) {
    await pool.query(`UPDATE payroll_run SET release_schedule_status = 'Release Failed', release_failure_reason = ?, updated_at = NOW() WHERE payroll_run_id = ?`, [String(error.message).slice(0, 1000), payrollRunId]);
    await writeAuditLog({ module: MODULE.PAYROLL, activityType: "Payroll Payment", action: `Scheduled payroll release failed for ${runId}: ${error.message}`, entityId: runId, entityType: "payroll_run", status: "Failed" });
    await notifyRoles("Finance", { type: "payroll_release_failed", title: "Scheduled payroll release failed", message: `Payroll ${runId} was not released: ${error.message}`, entityType: "payroll_run", entityId: runId, actionPath: "/dashboard/payroll/finance/payroll-schedule" });
    return { released: false, error: error.message };
  }
}

async function processDueScheduledReleases() {
  const [rows] = await pool.query(
    `SELECT payroll_run_id FROM payroll_run WHERE release_schedule_status = 'Confirmed'
       AND payment_attempted_at IS NULL AND payment_reference IS NULL
       AND scheduled_release_at <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00') ORDER BY scheduled_release_at LIMIT 10`
  );
  const results = [];
  for (const row of rows) results.push(await executeScheduledRelease(row.payroll_run_id));
  return results;
}

module.exports = {
  TIMEZONE, applyScheduleDefaultsToRun, calculatePeriodSchedule, cancelRunSchedule,
  claimTargetForApproval, confirmRunSchedule, executeScheduledRelease, getFinanceScheduleConfig,
  previewFinanceSchedule,
  markRunForManualRetry, previousBusinessDate, processDueScheduledReleases,
  saveFinanceScheduleConfig, targetPeriodForCutoff, updateRunSchedule
};
