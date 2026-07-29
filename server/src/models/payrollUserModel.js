const { pool } = require("../config/db");
const { writeAuditLog } = require("../services/auditService");
const { currentCompanyId } = require("../services/tenantContext");

const ROLE_NAMES = ["Admin", "Finance", "HR", "Staff"];

async function listManagedUsers() {
  const companyId = currentCompanyId();
  const [accountRows] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.role_name, u.status AS account_status,
            u.must_change_password, u.failed_login_attempts, u.account_locked_at,
            u.account_lock_reason, u.created_at AS account_created_at,
            s.employee_id, s.employee_code, s.name AS staff_name, s.email AS staff_email,
            s.phone, s.department_name, s.hire_date, s.date_of_birth, s.gender, s.race, s.religion, s.base_salary,
            s.status AS employment_status, s.bank, s.account_no,
            ar.request_id,
            CASE ar.status WHEN 'pending' THEN 'Pending' WHEN 'approved' THEN 'Approved'
              WHEN 'rejected' THEN 'Rejected' ELSE 'Approved' END AS activation_status,
            ar.requested_role, ar.requested_by, requester.name AS requested_by_name,
            ar.reviewed_by, reviewer.name AS reviewed_by_name, ar.review_note AS rejection_reason,
            ar.requested_at, ar.reviewed_at,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.status')) AS setup_email_status,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.recipient')) AS setup_email_recipient,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.sentAt')) AS setup_email_sent_at,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.error')) AS setup_email_error
            ,(SELECT dr.status FROM account_action_requests dr WHERE dr.user_id = u.user_id AND dr.company_id=u.company_id AND dr.request_type = 'account_deletion' ORDER BY dr.request_id DESC LIMIT 1) AS deletion_request_status
            ,(SELECT dr.request_id FROM account_action_requests dr WHERE dr.user_id = u.user_id AND dr.company_id=u.company_id AND dr.request_type = 'account_deletion' ORDER BY dr.request_id DESC LIMIT 1) AS deletion_request_id
     FROM user u
     LEFT JOIN staff s ON s.user_user_id = u.user_id AND s.company_id=u.company_id
     LEFT JOIN account_action_requests ar
       ON ar.request_id = (
         SELECT MAX(latest_ar.request_id) FROM account_action_requests latest_ar
         WHERE latest_ar.user_id = u.user_id AND latest_ar.company_id=u.company_id AND latest_ar.request_type = 'user_activation'
       )
     LEFT JOIN user requester ON requester.user_id = ar.requested_by AND requester.company_id=u.company_id
     LEFT JOIN user reviewer ON reviewer.user_id = ar.reviewed_by AND reviewer.company_id=u.company_id
     WHERE u.company_id=?`, [companyId]
  );
  const [unlinkedRows] = await pool.query(
    `SELECT s.employee_id, s.employee_code, s.name AS staff_name, s.email AS staff_email,
            s.phone, s.department_name, s.hire_date, s.date_of_birth, s.gender, s.race, s.religion, s.base_salary,
            s.status AS employment_status, s.bank, s.account_no
     FROM staff s
     WHERE s.user_user_id IS NULL AND s.company_id=?`, [companyId]
  );

  const unlinkedUsers = unlinkedRows.map((staff) => ({
    user_id: null,
    name: staff.staff_name,
    email: staff.staff_email,
    role_name: null,
    account_status: null,
    must_change_password: 0,
    failed_login_attempts: null,
    account_locked_at: null,
    account_lock_reason: null,
    account_created_at: null,
    ...staff,
    request_id: null,
    activation_status: "No Account",
    requested_role: null,
    requested_by: null,
    requested_by_name: null,
    reviewed_by: null,
    reviewed_by_name: null,
    rejection_reason: null,
    requested_at: null,
    reviewed_at: null
  }));

  return [...accountRows, ...unlinkedUsers].sort((left, right) => {
    const pendingDifference = Number(right.activation_status === "Pending") - Number(left.activation_status === "Pending");
    if (pendingDifference) return pendingDifference;
    const leftName = left.staff_name || left.name || "";
    const rightName = right.staff_name || right.name || "";
    return leftName.localeCompare(rightName, "en", { sensitivity: "base" });
  });
}

async function createHireWithAccount({ staff, account, requestedBy, passwordHash }) {
  const companyId = currentCompanyId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[duplicate]] = await connection.execute(
      "SELECT user_id FROM user WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [account.email]
    );
    if (duplicate) {
      await connection.rollback();
      return { duplicateEmail: true };
    }
    let employeeId = staff.employeeId;
    if (employeeId) {
      const [[existingStaff]] = await connection.execute(
        "SELECT employee_id, user_user_id FROM staff WHERE employee_id = ? AND company_id=? FOR UPDATE", [employeeId, companyId]
      );
      if (!existingStaff) {
        await connection.rollback();
        return { staffNotFound: true };
      }
      if (existingStaff.user_user_id) {
        await connection.rollback();
        return { staffAlreadyLinked: true };
      }
      await connection.execute(
        `UPDATE staff SET employee_code = COALESCE(NULLIF(?, ''), employee_code), name = ?, email = ?,
          phone = ?, department_name = ?, hire_date = ?, date_of_birth = ?, gender = ?, race = ?, religion = ?, base_salary = ?, status = ?, bank = ?,
          account_no = ?, updated_at = NOW() WHERE employee_id = ? AND company_id=?`,
        [staff.employeeCode, staff.name, staff.email, staff.phone || null, staff.departmentName || null,
          staff.hireDate || null, staff.dateOfBirth || null, staff.gender || null, staff.race || null, staff.religion || null, Number(staff.baseSalary || 0), staff.status === 0 ? 0 : 1,
          staff.bank || null, staff.accountNo || null, employeeId, companyId]
      );
    } else {
      const [[next]] = await connection.query("SELECT COALESCE(MAX(employee_id), 0) + 1 AS employeeId FROM staff FOR UPDATE");
      employeeId = next.employeeId;
      const employeeCode = staff.employeeCode || `EMP-${String(employeeId).padStart(4, "0")}`;
      await connection.execute(
        `INSERT INTO staff
          (employee_id, company_id, employee_code, name, email, phone, department_name, hire_date,
           date_of_birth, gender, race, religion, base_salary, status, bank, account_no, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [employeeId, companyId, employeeCode, staff.name, staff.email, staff.phone || null,
          staff.departmentName || null, staff.hireDate || null, staff.dateOfBirth || null, staff.gender || null, staff.race || null, staff.religion || null, Number(staff.baseSalary || 0),
          staff.status === 0 ? 0 : 1, staff.bank || null, staff.accountNo || null]
      );
    }
    const [userResult] = await connection.execute(
      `INSERT INTO user (company_id, name, email, password, role_name, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 1, NOW(), NOW())`,
      [companyId, account.name, account.email, passwordHash, account.roleName]
    );
    await connection.execute("UPDATE staff SET user_user_id = ? WHERE employee_id = ? AND company_id=?", [userResult.insertId, employeeId, companyId]);
    const [requestResult] = await connection.execute(
      `INSERT INTO account_action_requests
        (company_id, user_id, user_name, user_email, staff_employee_id, requested_role,
         requested_by, request_type, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user_activation', 'pending', JSON_OBJECT('source', 'payroll_user_management'))`,
      [companyId, userResult.insertId, account.name, account.email, employeeId, account.roleName, requestedBy]
    );
    await writeAuditLog({ connection, module: "Payroll", activityType: "User Activation", action: "Created new-hire account pending Admin activation", entityId: userResult.insertId, entityType: "user", userId: requestedBy, status: "Success", newValue: JSON.stringify({ requestedRole: account.roleName, activationStatus: "pending" }) });
    await connection.commit();
    return { employeeId, userId: userResult.insertId, requestId: requestResult.insertId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function reviewActivationRequest({ requestId, action, reviewerId, reason }) {
  const companyId = currentCompanyId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[request]] = await connection.execute(
      `SELECT ar.*, u.email, u.name, u.must_change_password, s.email AS staff_email FROM account_action_requests ar
       JOIN user u ON u.user_id = ar.user_id
       LEFT JOIN staff s ON s.employee_id = ar.staff_employee_id
       WHERE ar.request_id = ? AND ar.company_id=? AND u.company_id=? AND ar.request_type = 'user_activation' FOR UPDATE`,
      [requestId, companyId, companyId]
    );
    if (!request) {
      await connection.rollback();
      return { notFound: true };
    }
    if (request.status !== "pending") {
      await connection.rollback();
      const requestedStatus = action === "approve" ? "approved" : "rejected";
      return { alreadyReviewed: true, idempotent: request.status === requestedStatus, approved: request.status === "approved", request };
    }
    const approved = action === "approve";
    await connection.execute(
      `UPDATE account_action_requests SET status = ?, reviewed_by = ?,
         review_note = ?, reviewed_at = NOW() WHERE request_id = ? AND company_id=? AND request_type = 'user_activation'`,
      [approved ? "approved" : "rejected", reviewerId, approved ? null : reason, requestId, companyId]
    );
    await connection.execute("UPDATE user SET status = ? WHERE user_id = ? AND company_id=?", [approved ? 1 : 0, request.user_id, companyId]);
    await writeAuditLog({ connection, module: "Payroll", activityType: "User Activation", action: approved ? "Approved new-hire account" : "Rejected new-hire account", entityId: request.user_id, entityType: "user", userId: reviewerId, status: approved ? "Success" : "Warning", previousValue: JSON.stringify({ activationStatus: "pending" }), newValue: JSON.stringify({ activationStatus: approved ? "approved" : "rejected", reason: approved ? null : reason }) });
    await connection.commit();
    return { approved, request };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getActivationSetupContext(requestId) {
  const companyId = currentCompanyId();
  const [rows] = await pool.execute(
    `SELECT ar.*, u.name, u.email AS account_email, u.status AS account_status, u.must_change_password,
            s.email AS staff_email,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.status')) AS setup_email_status,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.recipient')) AS setup_email_recipient,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.sentAt')) AS setup_email_sent_at,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.error')) AS setup_email_error
     FROM account_action_requests ar
     JOIN user u ON u.user_id = ar.user_id
     LEFT JOIN staff s ON s.employee_id = ar.staff_employee_id
     WHERE ar.request_id = ? AND ar.company_id=? AND u.company_id=? AND ar.request_type = 'user_activation' LIMIT 1`,
    [requestId, companyId, companyId]
  );
  return rows[0] || null;
}

async function getUserSetupContext(userId) {
  const companyId = currentCompanyId();
  const [rows] = await pool.execute(
    `SELECT ar.request_id, ar.status, ar.user_name, ar.user_email,
            u.user_id, u.name, u.email AS account_email,
            u.status AS account_status, u.must_change_password,
            s.email AS staff_email,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.status')) AS setup_email_status,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.recipient')) AS setup_email_recipient,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.sentAt')) AS setup_email_sent_at,
            JSON_UNQUOTE(JSON_EXTRACT(ar.metadata, '$.setupEmail.error')) AS setup_email_error
     FROM user u
     LEFT JOIN staff s ON s.user_user_id = u.user_id AND s.company_id = u.company_id
     LEFT JOIN account_action_requests ar ON ar.request_id = (
       SELECT MAX(latest.request_id) FROM account_action_requests latest
       WHERE latest.user_id = u.user_id AND latest.company_id = u.company_id
         AND latest.request_type = 'user_activation'
     )
     WHERE u.user_id = ? AND u.company_id = ? LIMIT 1`,
    [userId, companyId]
  );
  const context = rows[0] || null;
  if (context && !context.request_id && Number(context.account_status) === 1) context.status = "approved";
  return context;
}

async function saveSetupEmailResult(requestId, setupEmail) {
  const companyId = currentCompanyId();
  const [rows] = await pool.execute(
    "SELECT metadata FROM account_action_requests WHERE request_id = ? AND company_id=? LIMIT 1", [requestId, companyId]
  );
  if (!rows[0]) return false;
  let metadata = {};
  try { metadata = typeof rows[0].metadata === "string" ? JSON.parse(rows[0].metadata || "{}") : (rows[0].metadata || {}); } catch { metadata = {}; }
  metadata.setupEmail = setupEmail;
  await pool.execute("UPDATE account_action_requests SET metadata = ? WHERE request_id = ? AND company_id=?", [JSON.stringify(metadata), requestId, companyId]);
  return true;
}

async function logSetupEmailAudit(requestId, setupEmail) {
  await writeAuditLog({ module: "Payroll", activityType: "Account Setup Email", action: `Account setup email ${setupEmail.status.toLowerCase()}`, entityId: requestId, entityType: "account_action_request", status: setupEmail.status === "Sent" ? "Success" : setupEmail.status === "Not Required" ? "Info" : "Failed", newValue: JSON.stringify({ status: setupEmail.status, recipient: setupEmail.recipient, sentAt: setupEmail.sentAt, error: setupEmail.error }) });
}

async function logUserSetupEmailAudit(userId, setupEmail) {
  await writeAuditLog({ module: "Payroll", activityType: "Account Setup Email", action: `Account setup email ${setupEmail.status.toLowerCase()}`, entityId: userId, entityType: "user", status: setupEmail.status === "Sent" ? "Success" : setupEmail.status === "Not Required" ? "Info" : "Failed", newValue: JSON.stringify({ status: setupEmail.status, recipient: setupEmail.recipient, sentAt: setupEmail.sentAt, error: setupEmail.error }) });
}

async function updatePendingRequest({ requestId, requestedBy, staff, account }) {
  const companyId = currentCompanyId();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[request]] = await connection.execute(
      "SELECT * FROM account_action_requests WHERE request_id = ? AND company_id=? AND request_type = 'user_activation' FOR UPDATE",
      [requestId, companyId]
    );
    if (!request) {
      await connection.rollback();
      return { notFound: true };
    }
    if (!["pending", "rejected"].includes(request.status)) {
      await connection.rollback();
      return { locked: true };
    }
    await connection.execute(
      "UPDATE user SET name = ?, email = ?, role_name = ?, status = 0 WHERE user_id = ? AND company_id=?",
      [account.name, account.email, account.roleName, request.user_id, companyId]
    );
    await connection.execute(
      `UPDATE staff SET name = ?, email = ?, employee_code = ?, phone = ?, department_name = ?, hire_date = ?,
        date_of_birth = ?, gender = ?, race = ?, religion = ?, base_salary = ?, bank = ?, account_no = ?, updated_at = NOW() WHERE employee_id = ? AND company_id=?`,
      [staff.name, staff.email, staff.employeeCode || null, staff.phone || null, staff.departmentName || null,
        staff.hireDate || null, staff.dateOfBirth || null, staff.gender || null, staff.race || null, staff.religion || null, Number(staff.baseSalary || 0), staff.bank || null,
        staff.accountNo || null, request.staff_employee_id, companyId]
    );
    await connection.execute(
      `UPDATE account_action_requests SET user_name = ?, user_email = ?, requested_role = ?,
       status = 'pending', requested_by = ?, reviewed_by = NULL, reviewed_at = NULL,
       review_note = NULL WHERE request_id = ? AND company_id=? AND request_type = 'user_activation'`,
      [account.name, account.email, account.roleName, requestedBy, requestId, companyId]
    );
    await connection.commit();
    return { userId: request.user_id, requestId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { ROLE_NAMES, createHireWithAccount, getActivationSetupContext, getUserSetupContext, listManagedUsers, logSetupEmailAudit, logUserSetupEmailAudit, reviewActivationRequest, saveSetupEmailResult, updatePendingRequest };
