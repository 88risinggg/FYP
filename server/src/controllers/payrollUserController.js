const bcrypt = require("bcrypt");
const crypto = require("crypto");
const {
  ROLE_NAMES,
  createHireWithAccount,
  listManagedUsers,
  reviewActivationRequest,
  updatePendingRequest
} = require("../models/payrollUserModel");
const { notifyRoles, notifyUser } = require("../services/payrollNotificationService");

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
  if (!ROLE_NAMES.includes(payload.account.roleName)) return "Select a valid PayNivo role.";
  if (!Number.isFinite(payload.staff.baseSalary) || payload.staff.baseSalary < 0) return "Base salary must be zero or greater.";
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
  };
}

async function getManagedUsers(req, res) {
  try {
    const users = await listManagedUsers();
    return res.json({
      users: req.user.role === "Admin" ? users.map(toAdminManagedUser) : users,
      roles: ROLE_NAMES
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load payroll user management.", detail: error.message });
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
    return res.status(201).json({ ...result, temporaryPassword: generatedPassword });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create the new-hire account.", detail: error.message });
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
    if (result.alreadyReviewed) return res.status(409).json({ message: "This activation request has already been reviewed." });
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
    if (result.approved) {
      await notifyUser(result.request.user_id, {
        ...event,
        title: "Your PayNivo account is active",
        message: "Your account has been approved. Sign in with the temporary password supplied by HR, then create a permanent password.",
        actionPath: "/login"
      });
    }
    return res.json({ approved: result.approved });
  } catch (error) {
    return res.status(500).json({ message: "Unable to review the activation request.", detail: error.message });
  }
}

module.exports = { createHire, editRequest, getManagedUsers, reviewRequest, toAdminManagedUser };
