const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pool } = require("../config/db");
const { createNotificationInternal } = require("./notificationController");
const { getClaimTransition } = require("../services/claimWorkflow");

const CLAIM_TYPES = ["Medical", "Transport", "Meal", "Internet", "Office Purchase", "Business Travel", "Other"];
const selectClaim = `
  SELECT ec.claim_id, ec.staff_employee_id AS staff_id, s.name AS staff_name,
    ec.claim_type, ec.amount, ec.expense_date, ec.description, ec.proof_original_name,
    ec.proof_mime_type, ec.status, ec.submitted_at, ec.hr_reviewed_at, ec.hr_comments,
    ec.finance_processed_at, ec.finance_comments, ec.payment_reference
  FROM expense_claim ec
  JOIN staff s ON s.employee_id = ec.staff_employee_id`;

function removeUploadedFile(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

function proofMatchesDeclaredType(file) {
  const buffer = Buffer.alloc(8);
  const descriptor = fs.openSync(file.path, "r");
  try { fs.readSync(descriptor, buffer, 0, 8, 0); } finally { fs.closeSync(descriptor); }
  if (file.mimetype === "application/pdf") return buffer.subarray(0, 4).toString() === "%PDF";
  if (file.mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === "image/png") return buffer.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}

async function notifyClaimOwner(claimId, title, message) {
  const [rows] = await pool.query(
    `SELECT s.user_user_id FROM expense_claim ec
     JOIN staff s ON s.employee_id = ec.staff_employee_id WHERE ec.claim_id = ? LIMIT 1`,
    [claimId]
  );
  if (rows[0]?.user_user_id) {
    await createNotificationInternal(rows[0].user_user_id, "system", title, message);
  }
}

async function submitClaim(req, res) {
  try {
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
    await pool.query(
      `INSERT INTO expense_claim
       (claim_id, staff_employee_id, claim_type, amount, expense_date, description,
        proof_path, proof_original_name, proof_mime_type, status, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_hr', ?)`,
      [claimId, req.user.staffId, claim_type, numericAmount, expense_date, description.trim(),
        req.file.path, req.file.originalname, req.file.mimetype, req.user.userId]
    );
    const [rows] = await pool.query(`${selectClaim} WHERE ec.claim_id = ?`, [claimId]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    removeUploadedFile(req.file);
    return res.status(500).json({ message: "Failed to submit claim", error: error.message });
  }
}

async function listClaims(req, res) {
  try {
    let sql = selectClaim;
    const params = [];
    if (req.user.role === "Staff") {
      sql += " WHERE ec.staff_employee_id = ?";
      params.push(req.user.staffId || -1);
    } else if (req.user.role === "Finance") {
      sql += " WHERE ec.status IN ('hr_approved','released','finance_rejected')";
    }
    sql += " ORDER BY ec.submitted_at DESC";
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
  try {
    const [result] = await pool.query(
      `UPDATE expense_claim SET status = ?, hr_reviewed_by = ?, hr_reviewed_at = NOW(), hr_comments = ?
       WHERE claim_id = ? AND status = 'pending_hr'`,
      [transition.to, req.user.userId, comments || null, req.params.id]
    );
    if (!result.affectedRows) return res.status(409).json({ message: "Claim is missing or has already been reviewed" });
    await notifyClaimOwner(
      req.params.id,
      action === "approve" ? "Claim approved by HR" : "Claim rejected by HR",
      action === "approve" ? "Your claim has been sent to Finance for reimbursement." : comments
    );
    const [rows] = await pool.query(`${selectClaim} WHERE ec.claim_id = ?`, [req.params.id]);
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Failed to review claim", error: error.message });
  }
}

async function processByFinance(req, res) {
  const action = req.params.action;
  const transition = getClaimTransition("Finance", action);
  if (!transition) return res.status(404).json({ message: "Invalid Finance claim action" });
  const comments = String(req.body?.comments || "").trim();
  const paymentReference = String(req.body?.payment_reference || "").trim();
  if (action === "release" && !paymentReference) return res.status(400).json({ message: "Payment reference is required" });
  if (action === "reject" && !comments) return res.status(400).json({ message: "A rejection reason is required" });
  try {
    const [result] = await pool.query(
      `UPDATE expense_claim SET status = ?, finance_processed_by = ?, finance_processed_at = NOW(),
       finance_comments = ?, payment_reference = ? WHERE claim_id = ? AND status = 'hr_approved'`,
      [transition.to, req.user.userId, comments || null, paymentReference || null, req.params.id]
    );
    if (!result.affectedRows) return res.status(409).json({ message: "Claim is missing or is not awaiting Finance" });
    await notifyClaimOwner(
      req.params.id,
      action === "release" ? "Claim reimbursement released" : "Claim rejected by Finance",
      action === "release" ? `Your reimbursement was released. Reference: ${paymentReference}` : comments
    );
    const [rows] = await pool.query(`${selectClaim} WHERE ec.claim_id = ?`, [req.params.id]);
    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ message: "Failed to process claim", error: error.message });
  }
}

async function downloadProof(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT ec.staff_employee_id, ec.proof_path, ec.proof_original_name
       FROM expense_claim ec WHERE ec.claim_id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Claim proof not found" });
    if (req.user.role === "Staff" && String(rows[0].staff_employee_id) !== String(req.user.staffId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const filePath = path.resolve(rows[0].proof_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Proof file is unavailable" });
    return res.download(filePath, rows[0].proof_original_name);
  } catch (error) {
    return res.status(500).json({ message: "Failed to download proof", error: error.message });
  }
}

module.exports = { CLAIM_TYPES, submitClaim, listClaims, reviewByHr, processByFinance, downloadProof };
