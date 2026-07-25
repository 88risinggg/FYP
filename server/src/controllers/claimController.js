const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");
const { notifyRoles: notifyPayrollRoles, notifyUser } = require("../services/payrollNotificationService");
const { getClaimTransition } = require("../services/claimWorkflow");
const { writeAuditLog } = require("../services/auditService");
const { claimTargetForApproval } = require("../services/financePayrollScheduleService");

const CLAIM_TYPES = ["Medical", "Transport", "Meal", "Internet", "Office Purchase", "Business Travel", "Other"];
const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const CLAIM_PROOF_ROOT = path.resolve(SERVER_ROOT, "uploads", "claim-proofs");

const selectClaim = `
  SELECT
    c.record_id AS claim_id,
    c.staff_employee_id AS staff_id,
    s.name AS staff_name,
    c.claim_category AS claim_type,
    c.amount,
    c.expense_date,
    c.description,
    c.proof_path,
    JSON_UNQUOTE(JSON_EXTRACT(c.request_metadata, '$.proof_original_name')) AS proof_original_name,
    JSON_UNQUOTE(JSON_EXTRACT(c.request_metadata, '$.proof_mime_type')) AS proof_mime_type,
    c.status,
    c.submitted_at,
    c.reviewed_at AS hr_reviewed_at,
    c.reviewer_comments AS hr_comments,
    c.finance_processed_at,
    JSON_UNQUOTE(JSON_EXTRACT(c.request_metadata, '$.finance_comments')) AS finance_comments,
    c.payment_reference
    ,c.payroll_target_month,
    c.payroll_target_year,
    c.payroll_inclusion_status,
    c.included_payroll_id,
    c.payroll_approved_at,
    c.payroll_included_at
  FROM claims_and_loans c
  JOIN staff s ON s.employee_id = c.staff_employee_id`;

function removeUploadedFile(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

function proofMatchesDeclaredType(file) {
  const buffer = Buffer.alloc(8);
  const descriptor = fs.openSync(file.path, "r");
  try {
    fs.readSync(descriptor, buffer, 0, 8, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (file.mimetype === "application/pdf") return buffer.subarray(0, 4).toString() === "%PDF";
  if (file.mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === "image/png") return buffer.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}

function storedProofPath(filePath) {
  return path.relative(SERVER_ROOT, path.resolve(filePath)).split(path.sep).join("/");
}

function resolvedProofPath(storedPath) {
  if (!storedPath) return null;
  const resolved = path.resolve(path.isAbsolute(storedPath) ? storedPath : path.join(SERVER_ROOT, storedPath));
  const allowedPrefix = `${CLAIM_PROOF_ROOT}${path.sep}`;
  return resolved === CLAIM_PROOF_ROOT || resolved.startsWith(allowedPrefix) ? resolved : null;
}

async function getClaimById(claimId) {
  const [rows] = await pool.query(
    `${selectClaim} WHERE c.type = 'expense_claim' AND c.record_id = ? LIMIT 1`,
    [claimId]
  );
  return rows[0] || null;
}

async function notifyClaimOwner(claimId, title, message, event = {}) {
  const [rows] = await pool.query(
    `SELECT s.user_user_id
     FROM claims_and_loans c
     JOIN staff s ON s.employee_id = c.staff_employee_id
     WHERE c.type = 'expense_claim' AND c.record_id = ?
     LIMIT 1`,
    [claimId]
  );
  if (rows[0]?.user_user_id) {
    await notifyUser(rows[0].user_user_id, {
      type: "payroll_claim", title, message, entityType: "claim", entityId: claimId,
      actionPath: "/dashboard/payroll/staff/claims", ...event
    });
  }
}

async function notifyRoles(roleNames, title, message, excludedUserId = null, event = {}) {
  await notifyPayrollRoles(roleNames, {
    type: "payroll_claim", title, message, entityType: "claim", ...event
  }, { excludeUserId: excludedUserId });
}

async function logClaimAudit(connection, req, claimId, description) {
  await writeAuditLog({
    connection,
    module: "Claims",
    activityType: "Payroll Claim",
    action: description,
    entityType: "claim",
    entityId: claimId,
    userId: req.user?.userId || null,
    userName: req.user?.name || req.user?.email || req.user?.role || "System",
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    deviceInfo: req.get?.("user-agent") || null,
    status: "Success"
  });
}

async function submitClaim(req, res) {
  const { claim_type, amount, expense_date, description } = req.body;
  const numericAmount = Number(amount);

  if (!req.user.staffId) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "No staff profile is linked to this account" });
  }
  if (!CLAIM_TYPES.includes(claim_type)) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "Select a valid claim type" });
  }
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "Amount must be between $0.01 and $100,000" });
  }
  if (!expense_date || Number.isNaN(Date.parse(expense_date))) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "A valid expense date is required" });
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (new Date(expense_date) > today) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "Expense date cannot be in the future" });
  }
  if (!description?.trim() || description.trim().length < 5 || description.trim().length > 1000) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "Description must contain 5 to 1,000 characters" });
  }
  if (!req.file) return res.status(400).json({ message: "A PDF, JPG, or PNG proof document is required" });
  if (!proofMatchesDeclaredType(req.file)) {
    removeUploadedFile(req.file);
    return res.status(400).json({ message: "Proof file content does not match its declared file type" });
  }

  const claimId = `CLM-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  const metadata = JSON.stringify({
    proof_original_name: req.file.originalname,
    proof_mime_type: req.file.mimetype,
    submitted_by: req.user.userId
  });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO claims_and_loans
        (record_id, type, claim_category, amount, status, description, expense_date,
         proof_path, request_metadata, created_by, staff_employee_id)
       VALUES (?, 'expense_claim', ?, ?, 'pending_hr', ?, ?, ?, ?, ?, ?)`,
      [
        claimId,
        claim_type,
        numericAmount,
        description.trim(),
        expense_date,
        storedProofPath(req.file.path),
        metadata,
        req.user.userId,
        req.user.staffId
      ]
    );
    await logClaimAudit(connection, req, claimId, `Submitted expense claim ${claimId}`);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    removeUploadedFile(req.file);
    return res.status(500).json({ message: "Failed to submit claim", error: error.message });
  } finally {
    connection.release();
  }

  try {
    await notifyRoles(
      ["HR"],
      "New expense claim awaiting HR review",
      `${claim_type} claim ${claimId} for $${numericAmount.toFixed(2)} requires review.`,
      req.user.userId
      , { actorUserId: req.user.userId, entityId: claimId, actionPath: "/dashboard/payroll/hr/claims" }
    );
  } catch (error) {
    console.error("Failed to notify claim reviewers:", error.message);
  }
  return res.status(201).json(await getClaimById(claimId));
}

async function listClaims(req, res) {
  try {
    let sql = `${selectClaim} WHERE c.type = 'expense_claim'`;
    const params = [];
    if (req.user.role === "Staff") {
      sql += " AND c.staff_employee_id = ?";
      params.push(req.user.staffId || -1);
    } else if (req.user.role === "Finance") {
      sql += " AND c.status IN ('hr_approved', 'payroll_approved', 'released', 'finance_rejected')";
    }
    sql += " ORDER BY c.submitted_at DESC";
    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch claims", error: error.message });
  }
}

async function reviewByHr(req, res) {
  const action = req.params.action;
  const transition = getClaimTransition("HR", action);
  if (!transition) return res.status(404).json({ message: "Invalid HR claim action" });
  const comments = String(req.body?.comments || "").trim();
  if (action === "reject" && !comments) return res.status(400).json({ message: "A rejection reason is required" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE claims_and_loans
       SET status = ?, reviewed_at = NOW(), reviewer_comments = ?,
           request_metadata = JSON_SET(
             COALESCE(request_metadata, JSON_OBJECT()),
             '$.hr_reviewed_by', ?,
             '$.hr_action', ?
           )
       WHERE type = 'expense_claim' AND record_id = ? AND status = 'pending_hr'`,
      [transition.to, comments || null, req.user.userId, action, req.params.id]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ message: "Claim is missing or has already been reviewed" });
    }
    const actionLabel = action === "approve" ? "approved" : "rejected";
    await logClaimAudit(connection, req, req.params.id, `HR ${actionLabel} expense claim ${req.params.id}`);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Failed to review claim", error: error.message });
  } finally {
    connection.release();
  }

  try {
    await notifyClaimOwner(
      req.params.id,
      action === "approve" ? "Claim approved by HR" : "Claim rejected by HR",
      action === "approve" ? "Your claim has been sent to Finance for approval and reimbursement." : comments
      , { actorUserId: req.user.userId }
    );
    if (action === "approve") {
      await notifyRoles(
        ["Finance"],
        "Expense claim awaiting Finance approval",
        `Claim ${req.params.id} was reviewed by HR and is ready for Finance approval.`,
        req.user.userId
        , { actorUserId: req.user.userId, entityId: req.params.id, actionPath: "/dashboard/payroll/finance/employee-requests" }
      );
    }
  } catch (error) {
    console.error("Failed to send claim review notifications:", error.message);
  }
  return res.json(await getClaimById(req.params.id));
}

async function processByFinance(req, res) {
  const action = req.params.action;
  const transition = getClaimTransition("Finance", action);
  if (!transition) return res.status(404).json({ message: "Invalid Finance claim action" });
  const comments = String(req.body?.comments || "").trim();
  let targetMonth = null;
  let targetYear = null;
  let targetCutoffAt = null;
  if (action === "reject" && !comments) return res.status(400).json({ message: "A rejection reason is required" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[claim]] = await connection.query(
      `SELECT staff_employee_id, claim_category, amount, expense_date
       FROM claims_and_loans WHERE type = 'expense_claim' AND record_id = ? AND status = 'hr_approved'
       LIMIT 1 FOR UPDATE`,
      [req.params.id]
    );
    if (!claim) {
      await connection.rollback();
      return res.status(409).json({ message: "Claim is missing or is not awaiting Finance" });
    }
    let openRuns = [];
    if (action === "release") {
      const target = await claimTargetForApproval(connection);
      targetMonth = target.month;
      targetYear = target.year;
      targetCutoffAt = target.cutoffAt;
      [openRuns] = await connection.query(
        `SELECT payroll_month, payroll_year FROM payroll_run
         WHERE payroll_month = ? AND payroll_year = ? AND approved_at IS NULL
           AND LOWER(status) NOT IN ('payment processed', 'payslips sent', 'reconciled') LIMIT 1 FOR UPDATE`,
        [targetMonth, targetYear]
      );
    }
    const [result] = await connection.query(
      `UPDATE claims_and_loans
       SET status = ?, finance_processed_at = NOW(), payment_reference = NULL,
           payroll_target_month = ?, payroll_target_year = ?,
           payroll_inclusion_status = ?, payroll_approved_at = CASE WHEN ? = 'release' THEN NOW() ELSE NULL END,
           request_metadata = JSON_SET(
             COALESCE(request_metadata, JSON_OBJECT()),
             '$.finance_processed_by', ?,
             '$.finance_action', ?,
             '$.finance_comments', ?,
             '$.effective_claim_cutoff_at', ?
           )
       WHERE type = 'expense_claim' AND record_id = ? AND status = 'hr_approved'`,
      [action === "release" ? "payroll_approved" : transition.to,
        targetMonth, targetYear, action === "release" ? "queued" : null, action,
        req.user.userId, action, comments || "", targetCutoffAt, req.params.id]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(409).json({ message: "Claim is missing or is not awaiting Finance" });
    }
    if (action === "release" && openRuns.length) {
      const [[payroll]] = await connection.query(
        `SELECT payroll_id, gross_salary, total_allowances, net_salary, deduction_breakdown
         FROM payroll WHERE staff_employee_id = ? AND payroll_month = ? AND payroll_year = ?
         LIMIT 1 FOR UPDATE`,
        [claim.staff_employee_id, targetMonth, targetYear]
      );
      if (payroll) {
        let breakdown = {};
        try { breakdown = typeof payroll.deduction_breakdown === "object" ? payroll.deduction_breakdown : JSON.parse(payroll.deduction_breakdown || "{}"); } catch { breakdown = {}; }
        const reimbursements = Array.isArray(breakdown.reimbursements) ? breakdown.reimbursements : [];
        if (!reimbursements.some((item) => item.claimId === req.params.id)) {
          reimbursements.push({ claimId: req.params.id, label: `${claim.claim_category || "Expense"} reimbursement · ${req.params.id}`, amount: Number(claim.amount), expenseDate: claim.expense_date, cpfApplicable: false });
          breakdown.reimbursements = reimbursements;
          await connection.query(
            `UPDATE payroll SET gross_salary = gross_salary + ?, total_allowances = total_allowances + ?,
               net_salary = net_salary + ?, deduction_breakdown = ? WHERE payroll_id = ?`,
            [claim.amount, claim.amount, claim.amount, JSON.stringify(breakdown), payroll.payroll_id]
          );
          await connection.query(
            `UPDATE claims_and_loans SET payroll_inclusion_status = 'included', included_payroll_id = ?, payroll_included_at = NOW()
             WHERE record_id = ? AND payroll_inclusion_status = 'queued'`,
            [payroll.payroll_id, req.params.id]
          );
        }
      }
    }
    const actionLabel = action === "release" ? `approved for ${targetMonth}/${targetYear} payroll` : "rejected";
    await logClaimAudit(connection, req, req.params.id, `Finance ${actionLabel} expense claim ${req.params.id}`);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Failed to process claim", error: error.message });
  } finally {
    connection.release();
  }

  try {
    await notifyClaimOwner(
      req.params.id,
      action === "release" ? "Claim approved for payroll" : "Claim rejected by Finance",
      action === "release" ? "Your reimbursement was approved and will be included in the next open payroll." : comments
      , { actorUserId: req.user.userId }
    );
    await notifyRoles(
      ["HR"],
      action === "release" ? "Expense claim approved for payroll" : "Expense claim rejected by Finance",
      action === "release"
        ? `Claim ${req.params.id} was assigned to ${targetMonth}/${targetYear} payroll.`
        : `Claim ${req.params.id} was rejected by Finance.`,
      req.user.userId
      , { actorUserId: req.user.userId, entityId: req.params.id, actionPath: "/dashboard/payroll/hr/claims" }
    );
  } catch (error) {
    console.error("Failed to send Finance claim notifications:", error.message);
  }
  return res.json(await getClaimById(req.params.id));
}

async function downloadProof(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.staff_employee_id, c.proof_path,
              JSON_UNQUOTE(JSON_EXTRACT(c.request_metadata, '$.proof_original_name')) AS proof_original_name
       FROM claims_and_loans c
       WHERE c.type = 'expense_claim' AND c.record_id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Claim proof not found" });
    if (req.user.role === "Staff" && String(rows[0].staff_employee_id) !== String(req.user.staffId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const filePath = resolvedProofPath(rows[0].proof_path);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: "Proof file is unavailable" });
    return res.download(filePath, rows[0].proof_original_name || path.basename(filePath));
  } catch (error) {
    return res.status(500).json({ message: "Failed to download proof", error: error.message });
  }
}

module.exports = { CLAIM_TYPES, submitClaim, listClaims, reviewByHr, processByFinance, downloadProof };
