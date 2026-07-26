const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const {
  ROLE_NAMES,
  createHireWithAccount,
  getActivationSetupContext,
  listManagedUsers,
  logSetupEmailAudit,
  reviewActivationRequest,
  saveSetupEmailResult,
  updatePendingRequest
} = require("../models/payrollUserModel");
const { notifyRoles, notifyUser } = require("../services/payrollNotificationService");
const { sendAccountSetupEmail } = require("../services/emailService");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizedPayload(body = {}) {
  const staff = body.staff || body;
  const account = body.account || body;
  return {
    staff: {
      employeeId: Number(staff.employeeId || staff.employee_id || 0) || null,
      name: String(staff.name || "").trim(),
      email: String(staff.email || account.email || "").trim().toLowerCase(),
      employeeCode: String(staff.employeeCode || staff.employee_code || "").trim(),
      phone: String(staff.phone || "").trim(),
      departmentName: String(staff.departmentName || staff.department_name || "").trim(),
      hireDate: staff.hireDate || staff.hire_date || null,
      dateOfBirth: staff.dateOfBirth || staff.date_of_birth || null,
      race: String(staff.race || "").trim(),
      religion: String(staff.religion || "").trim(),
      baseSalary: Number(staff.baseSalary ?? staff.base_salary ?? 0),
      bank: String(staff.bank || "").trim(),
      accountNo: String(staff.accountNo || staff.account_no || "").trim(),
      status: staff.status === 0 ? 0 : 1
    },
    account: {
      name: String(account.name || staff.name || "").trim(),
      email: String(account.email || staff.email || "").trim().toLowerCase(),
      roleName: String(account.roleName || account.role_name || "Staff").trim()
    }
  };
}

function validate(payload) {
  if (!payload.staff.name || !payload.account.name) return "Employee name is required.";
  if (!emailPattern.test(payload.staff.email) || !emailPattern.test(payload.account.email)) return "A valid employee email is required.";
  if (!payload.staff.departmentName || !payload.staff.hireDate || !payload.staff.dateOfBirth) return "Department, hire date and date of birth are required.";
  if (!payload.staff.race || !payload.staff.religion) return "Race and religion are required for statutory payroll assessment.";
  if (!payload.staff.bank || !payload.staff.accountNo) return "Bank and account number are required for payroll payment.";
  if (!ROLE_NAMES.includes(payload.account.roleName)) return "Select a valid PayNivo role.";
  if (!Number.isFinite(payload.staff.baseSalary) || payload.staff.baseSalary <= 0) return "Base salary must be greater than zero.";
  return null;
}

function temporaryPassword() {
  return `PayNivo-${crypto.randomBytes(5).toString("base64url")}9!`;
}

function toAdminManagedUser(record) {
  return {
    user_id: record.user_id,
    name: record.name,
    email: record.email,
    role_name: record.role_name,
    account_status: record.account_status,
    must_change_password: record.must_change_password,
    failed_login_attempts: record.failed_login_attempts,
    account_locked_at: record.account_locked_at,
    account_lock_reason: record.account_lock_reason,
    account_created_at: record.account_created_at,
    employee_id: record.employee_id,
    employee_code: record.employee_code,
    staff_name: record.staff_name,
    staff_email: record.staff_email,
    department_name: record.department_name,
    employment_status: record.employment_status,
    request_id: record.request_id,
    activation_status: record.activation_status,
    requested_role: record.requested_role,
    requested_by: record.requested_by,
    requested_by_name: record.requested_by_name,
    reviewed_by: record.reviewed_by,
    reviewed_by_name: record.reviewed_by_name,
    rejection_reason: record.rejection_reason,
    requested_at: record.requested_at,
    reviewed_at: record.reviewed_at
    ,setup_email_status: record.setup_email_status,
    setup_email_recipient: record.setup_email_recipient,
    setup_email_sent_at: record.setup_email_sent_at,
    setup_email_error: record.setup_email_error
    ,deletion_request_status: record.deletion_request_status,
    deletion_request_id: record.deletion_request_id
  };
}

function toHrManagedUser(record) {
  const {
    failed_login_attempts: _failedLoginAttempts,
    account_locked_at: _accountLockedAt,
    account_lock_reason: _accountLockReason,
    ...hrRecord
  } = record;
  return hrRecord;
}

async function getManagedUsers(req, res) {
  try {
    const users = await listManagedUsers();
    return res.json({
      users: req.user.role === "Admin" ? users.map(toAdminManagedUser) : users.map(toHrManagedUser),
      roles: ROLE_NAMES
    });
  } catch (error) {
    console.error("Unable to load payroll user management:", error.message);
    return res.status(500).json({ message: "Unable to load payroll user management." });
  }
}

async function createHire(req, res) {
  try {
    const payload = normalizedPayload(req.body);
    const validationError = validate(payload);
    if (validationError) return res.status(400).json({ message: validationError });
    const generatedPassword = temporaryPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    const result = await createHireWithAccount({
      ...payload,
      requestedBy: req.user.userId,
      passwordHash
    });
    if (result.duplicateEmail) return res.status(409).json({ message: "A user with this email already exists." });
    if (result.staffNotFound) return res.status(404).json({ message: "The selected staff record no longer exists." });
    if (result.staffAlreadyLinked) return res.status(409).json({ message: "The selected staff record is already linked to an account." });
    await notifyRoles("Admin", {
      type: "payroll_account_activation",
      title: "New account awaiting activation",
      message: `${payload.staff.name}'s ${payload.account.roleName} account requires Admin review.`,
      actionPath: "/dashboard/payroll/admin/user-management",
      actorUserId: req.user.userId,
      entityType: "account_action_request",
      entityId: result.requestId
    }, { excludeUserId: req.user.userId });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Unable to create the new-hire account.", detail: error.message });
  }
}

const importColumns = {
  name: ["name", "fullname", "staffname", "employeename", "employee", "legalname"], email: ["email", "employeeemail", "staffemail", "emailaddress", "personalemail", "personalemailaddress", "workemail"],
  employeeCode: ["employeecode", "employeeid", "staffid", "staffcode", "employeenumber"], phone: ["phone", "phonenumber", "contact", "contactnumber", "mobile", "mobilenumber"],
  departmentName: ["department", "departmentname", "jobdepartment", "division", "team"], hireDate: ["hiredate", "startdate", "datejoined", "joiningdate", "employmentdate"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate"], race: ["race"], religion: ["religion"],
  baseSalary: ["basesalary", "salary", "basicsalary", "monthlysalary", "monthlybasicsalary", "grosssalary"], bank: ["bank", "bankname"],
  accountNo: ["accountno", "accountnumber", "bankaccount", "bankaccountnumber", "bankaccountno"]
};
const excelValue = (value) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : value && typeof value === "object"
    ? (value.text || value.result || (Array.isArray(value.richText) ? value.richText.map((item) => item.text || "").join("") : ""))
    : (value ?? "");
const excelHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const knownImportHeaders = new Set(Object.values(importColumns).flat());

function findStaffWorksheet(workbook) {
  let best = null;
  workbook.worksheets.forEach((worksheet) => {
    const scanLimit = Math.min(Math.max(worksheet.actualRowCount || worksheet.rowCount || 0, 1), 40);
    for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber += 1) {
      const headers = {};
      worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, column) => {
        const normalized = excelHeader(excelValue(cell.value));
        if (normalized) headers[normalized] = column;
      });
      const score = Object.keys(headers).filter((header) => knownImportHeaders.has(header)).length;
      const hasIdentity = importColumns.name.some((alias) => headers[alias]) || importColumns.email.some((alias) => headers[alias]);
      if (hasIdentity && (!best || score > best.score)) best = { worksheet, headerRow: rowNumber, headers, score };
    }
  });
  return best;
}

async function importHires(req, res) {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "Select an Excel workbook to import." });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    if (!workbook.worksheets.length) return res.status(400).json({ message: "The workbook does not contain a worksheet." });
    const detected = findStaffWorksheet(workbook);
    if (!detected) return res.status(400).json({ message: "Employee column headings could not be found. Include at least Name and Email headings; introductory rows above the headings are supported." });
    const { worksheet, headerRow, headers } = detected;
    const prepared = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const staff = {};
      Object.entries(importColumns).forEach(([field, aliases]) => {
        const alias = aliases.find((item) => headers[item]);
        staff[field] = alias ? excelValue(row.getCell(headers[alias]).value) : "";
      });
      if (!Object.values(staff).some((value) => String(value || "").trim())) return;
      const payload = normalizedPayload({ staff, account: { name: staff.name, email: staff.email, roleName: "Staff" } });
      prepared.push({ rowNumber, payload, error: validate(payload) });
    });
    if (!prepared.length) return res.status(400).json({ message: `No employee records were found below the headings in worksheet "${worksheet.name}".` });
    if (prepared.length > 500) return res.status(400).json({ message: "Import up to 500 staff records at a time." });
    if (String(req.body?.mode || "preview") !== "commit") {
      return res.json({ mode: "preview", worksheet: worksheet.name, headerRow, total: prepared.length, valid: prepared.filter((row) => !row.error).length, invalid: prepared.filter((row) => row.error).length, rows: prepared.map((row) => ({ rowNumber: row.rowNumber, name: row.payload.staff.name, email: row.payload.staff.email, department: row.payload.staff.departmentName, valid: !row.error, error: row.error })) });
    }
    const results = [];
    for (const row of prepared) {
      if (row.error) { results.push({ rowNumber: row.rowNumber, status: "invalid", error: row.error }); continue; }
      try {
        const passwordHash = await bcrypt.hash(temporaryPassword(), 12);
        const result = await createHireWithAccount({ ...row.payload, requestedBy: req.user.userId, passwordHash });
        const duplicate = result.duplicateEmail || result.staffAlreadyLinked;
        results.push({ rowNumber: row.rowNumber, name: row.payload.staff.name, status: duplicate ? "skipped" : "created", error: duplicate ? "Account already exists or is linked." : "" });
      } catch (error) {
        results.push({ rowNumber: row.rowNumber, name: row.payload.staff.name, status: "failed", error: error.code === "ER_DUP_ENTRY" ? "Duplicate employee code or email." : "Unable to create this record." });
      }
    }
    const created = results.filter((row) => row.status === "created").length;
    if (created) await notifyRoles("Admin", { type: "payroll_account_activation", title: "Imported accounts awaiting activation", message: `${created} imported staff account(s) require Admin review.`, actionPath: "/dashboard/payroll/admin/user-management", actorUserId: req.user.userId, entityType: "account_action_request" }, { excludeUserId: req.user.userId });
    return res.status(created ? 201 : 422).json({ mode: "commit", total: results.length, created, skipped: results.filter((row) => row.status === "skipped").length, failed: results.filter((row) => row.status === "failed" || row.status === "invalid").length, rows: results });
  } catch (error) {
    return res.status(400).json({ message: "Unable to read the Excel workbook.", detail: error.message });
  }
}

async function editRequest(req, res) {
  try {
    const payload = normalizedPayload(req.body);
    const validationError = validate(payload);
    if (validationError) return res.status(400).json({ message: validationError });
    const result = await updatePendingRequest({
      requestId: Number(req.params.requestId),
      requestedBy: req.user.userId,
      ...payload
    });
    if (result.notFound) return res.status(404).json({ message: "Activation request not found." });
    if (result.locked) return res.status(409).json({ message: "Approved requests can no longer be edited by HR." });
    await notifyRoles("Admin", {
      type: "payroll_account_activation",
      title: "Account request updated",
      message: `${payload.staff.name}'s account request is ready for review.`,
      actionPath: "/dashboard/payroll/admin/user-management",
      actorUserId: req.user.userId,
      entityType: "account_action_request",
      entityId: result.requestId
    }, { excludeUserId: req.user.userId });
    return res.json(result);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A user with this email already exists." });
    return res.status(500).json({ message: "Unable to update the activation request." });
  }
}

async function reviewRequest(req, res) {
  try {
    const action = req.params.action;
    if (!["approve", "reject"].includes(action)) return res.status(404).json({ message: "Invalid review action." });
    const reason = String(req.body.reason || "").trim();
    if (action === "reject" && !reason) return res.status(400).json({ message: "A rejection reason is required." });
    const result = await reviewActivationRequest({
      requestId: Number(req.params.requestId), action, reviewerId: req.user.userId, reason
    });
    if (result.notFound) return res.status(404).json({ message: "Activation request not found." });
    if (result.alreadyReviewed && result.idempotent) {
      const context = await getActivationSetupContext(Number(req.params.requestId));
      return res.json({ approved: result.approved, accountStatus: Number(context?.account_status) === 1 ? "Active" : "Inactive", alreadyReviewed: true, setupEmail: context ? {
        status: context.setup_email_status || "Unknown", recipient: context.setup_email_recipient || context.staff_email || "", sentAt: context.setup_email_sent_at || null, error: context.setup_email_error || null
      } : null });
    }
    if (result.alreadyReviewed) return res.status(409).json({ message: `This activation request was already ${result.request.status}. Refresh to view its latest status.` });
    const event = {
      type: "payroll_account_activation_result",
      title: result.approved ? "Account approved" : "Account request rejected",
      message: result.approved
        ? `${result.request.name}'s PayNivo account is now active.`
        : `${result.request.name}'s account request was rejected: ${reason}`,
      actionPath: "/dashboard/payroll/hr/user-management",
      actorUserId: req.user.userId,
      entityType: "account_action_request",
      entityId: req.params.requestId
    };
    await notifyUser(result.request.requested_by, event);
    let setupEmail = null;
    if (result.approved) {
      setupEmail = await deliverSetupEmail(Number(req.params.requestId));
      await notifyUser(result.request.user_id, {
        ...event,
        title: "Your PayNivo account is active",
        message: "Your account has been approved. Check your email for the one-time password setup link.",
        actionPath: "/login"
      });
    }
    return res.json({ approved: result.approved, accountStatus: result.approved ? "Active" : "Inactive", setupEmail });
  } catch (error) {
    return res.status(500).json({ message: "Unable to review the activation request.", detail: error.message });
  }
}

async function deliverSetupEmail(requestId, suppliedContext = null) {
  const context = suppliedContext || await getActivationSetupContext(requestId);
  const recipient = String(context?.staff_email || "").trim().toLowerCase();
  let result;
  if (!context || context.status !== "approved") {
    result = { status: "Failed", recipient, sentAt: null, error: "The activation request is not approved." };
  } else if (Number(context.must_change_password) !== 1) {
    result = { status: "Not Required", recipient, sentAt: null, error: "The employee already completed account setup." };
  } else if (!emailPattern.test(recipient)) {
    result = { status: "Failed", recipient, sentAt: null, error: "HR must provide a valid staff email before the setup link can be sent." };
  } else {
    const setupToken = jwt.sign({ userId: context.user_id, purpose: "first_login_password" }, process.env.JWT_SECRET, { expiresIn: "24h" });
    const setupUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/login?setup_token=${encodeURIComponent(setupToken)}`;
    try {
      const delivery = await sendAccountSetupEmail({ to: recipient, name: context.name || context.user_name, setupUrl });
      result = { status: "Sent", recipient, sentAt: new Date().toISOString(), error: null, providerMessageId: delivery?.messageId || null };
    } catch (error) {
      result = { status: "Failed", recipient, sentAt: null, error: String(error.message || "Email delivery failed").slice(0, 500) };
    }
  }
  await saveSetupEmailResult(requestId, result);
  await logSetupEmailAudit(requestId, result);
  return result;
}

async function resendSetupEmail(req, res) {
  try {
    const requestId = Number(req.params.requestId);
    const context = await getActivationSetupContext(requestId);
    if (!context) return res.status(404).json({ message: "Activation request not found." });
    if (context.status !== "approved") return res.status(409).json({ message: "Approve the account before sending its setup link." });
    const setupEmail = await deliverSetupEmail(requestId, context);
    const status = setupEmail.status === "Sent" ? 200 : 422;
    return res.status(status).json({ approved: true, accountStatus: Number(context.account_status) === 1 ? "Active" : "Inactive", setupEmail });
  } catch (error) {
    return res.status(500).json({ message: "Unable to resend the account setup link.", detail: error.message });
  }
}

module.exports = { createHire, editRequest, getManagedUsers, importHires, resendSetupEmail, reviewRequest, toAdminManagedUser, toHrManagedUser };
