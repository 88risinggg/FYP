/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Defines the available payroll Request Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const zlib = require("zlib");
const { pool } = require("../config/db");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { writeAuditLog } = require("../services/auditService");
const {
  notifyRoles,
  notifyUser,
} = require("../services/payrollNotificationService");
const {
  submitModernTreasuryEmployeePayment,
} = require("../services/modernTreasuryPaymentService");

const router = express.Router();
const root = path.resolve(
  __dirname,
  "..",
  "..",
  "uploads",
  "payroll-request-evidence",
);
fs.mkdirSync(root, { recursive: true });
const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _f, cb) => {
      const tenantRoot = path.join(
        root,
        String(req.user?.companyId || "unscoped"),
      );
      fs.mkdirSync(tenantRoot, { recursive: true });
      cb(null, tenantRoot);
    },
    filename: (_r, f, cb) =>
      cb(
        null,
        `${crypto.randomUUID()}${path.extname(f.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_r, f, cb) =>
    cb(
      allowed.has(f.mimetype)
        ? null
        : new Error("Only PDF, JPG, and PNG evidence is allowed"),
      allowed.has(f.mimetype),
    ),
});

function evidenceUpload(req, res, next) {
  upload.array("evidence", 5)(req, res, (error) => {
    if (error)
      return res
        .status(400)
        .json({
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "Each evidence file must not exceed 5MB"
              : error.message,
        });
    if (
      (req.files || []).reduce((sum, file) => sum + file.size, 0) >
      20 * 1024 * 1024
    ) {
      (req.files || []).forEach((file) =>
        fs.promises.unlink(file.path).catch(() => {}),
      );
      return res
        .status(400)
        .json({ message: "Combined evidence must not exceed 20MB" });
    }
    next();
  });
}

function signatureMatches(file) {
  const bytes = Buffer.alloc(8);
  const fd = fs.openSync(file.path, "r");
  try {
    fs.readSync(fd, bytes, 0, 8, 0);
  } finally {
    fs.closeSync(fd);
  }
  return file.mimetype === "application/pdf"
    ? bytes.subarray(0, 4).toString() === "%PDF"
    : file.mimetype === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
}
function parse(value) {
  try {
    return typeof value === "object" ? value || {} : JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
function attachment(file) {
  return {
    id: crypto.randomUUID(),
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: path
      .relative(path.resolve(__dirname, "..", ".."), file.path)
      .split(path.sep)
      .join("/"),
  };
}
let evidenceStorageReady;
async function ensureEvidenceStorage() {
  if (!evidenceStorageReady)
    evidenceStorageReady = (async () => {
      const [columns] = await pool.query(
        "SHOW COLUMNS FROM claims_and_loans LIKE 'evidence_payload'",
      );
      if (!columns.length)
        await pool.query(
          "ALTER TABLE claims_and_loans ADD COLUMN evidence_payload LONGBLOB NULL AFTER request_metadata",
        );
    })().catch((error) => {
      evidenceStorageReady = null;
      throw error;
    });
  return evidenceStorageReady;
}
function encodeEvidence(files, attachments) {
  const bundle = attachments.map((item, index) => ({
    id: item.id,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    data: fs.readFileSync(files[index].path).toString("base64"),
  }));
  return zlib.gzipSync(Buffer.from(JSON.stringify(bundle)), {
    level: zlib.constants.Z_BEST_SPEED,
  });
}
function decodeEvidence(payload) {
  if (!payload) return [];
  try {
    return JSON.parse(zlib.gunzipSync(Buffer.from(payload)).toString("utf8"));
  } catch (_error) {
    return [];
  }
}
const REQUEST_COLUMNS = `c.record_id,c.type,c.claim_category,c.amount,c.status,c.description,c.expense_date,c.proof_path,c.repayment_months,c.monthly_installment,c.outstanding_balance,c.submitted_at,c.reviewed_at,c.reviewer_comments,c.request_metadata,c.finance_processed_at,c.payment_reference,c.created_by,c.staff_employee_id,c.payroll_target_month,c.payroll_target_year,c.payroll_inclusion_status,c.included_payroll_id,c.payroll_approved_at,c.payroll_included_at`;
function unified(row) {
  const metadata = parse(row.request_metadata);
  const attachments = Array.isArray(metadata.attachments)
    ? metadata.attachments
    : [];
  if (!attachments.length && row.proof_path)
    attachments.push({
      id: "legacy",
      name: metadata.proof_original_name || path.basename(row.proof_path),
      mimeType: metadata.proof_mime_type,
      path: row.proof_path,
    });
  const type =
    row.type === "expense_claim"
      ? "reimbursement"
      : row.type === "advance_request"
        ? "salary_advance"
        : "loan";
  const normalizedStatus =
    row.status === "pending"
      ? "pending_hr"
      : row.status === "payroll_approved"
        ? "queued_for_payroll"
        : row.status === "approved" && type !== "reimbursement"
          ? "hr_approved"
          : row.status === "rejected"
            ? "hr_rejected"
            : row.status;
  return {
    id: row.record_id,
    requestType: type,
    purpose: row.claim_category || metadata.custom_purpose || row.description,
    amount: Number(row.amount),
    description: row.description,
    status: normalizedStatus,
    outcome:
      row.payroll_inclusion_status === "included"
        ? "included"
        : normalizedStatus,
    staffId: row.staff_employee_id,
    staffName: row.staff_name,
    submittedAt: row.submitted_at,
    hrDecision: {
      comments: row.reviewer_comments,
      at: row.reviewed_at,
      by: metadata.hr_reviewed_by || metadata.approved_by,
    },
    financeDecision: {
      comments: metadata.finance_comments,
      at: row.finance_processed_at,
      by: metadata.finance_processed_by || metadata.processed_by,
    },
    approvedTerms: {
      repaymentMonths: metadata.repayment_months,
      monthlyInstallment:
        row.monthly_installment || metadata.monthly_installment,
    },
    disbursement: {
      reference: row.payment_reference,
      status: metadata.disbursement_status,
    },
    payroll: {
      month: row.payroll_target_month,
      year: row.payroll_target_year,
      status: row.payroll_inclusion_status,
      payrollId: row.included_payroll_id,
    },
    attachments,
  };
}
async function find(id, companyId, connection = pool, includeEvidence = false) {
  const [rows] = await connection.query(
    `SELECT ${REQUEST_COLUMNS}${includeEvidence ? ",c.evidence_payload" : ""},s.name staff_name FROM claims_and_loans c JOIN staff s ON s.employee_id=c.staff_employee_id AND s.company_id=c.company_id WHERE c.record_id=? AND c.company_id=? LIMIT 1`,
    [id, companyId],
  );
  return rows[0];
}
async function notifyOwner(row, companyId, title, message, actorUserId) {
  const [[staff]] = await pool.query(
    "SELECT user_user_id FROM staff WHERE employee_id=? AND company_id=?",
    [row.staff_employee_id, companyId],
  );
  if (staff?.user_user_id)
    await notifyUser(staff.user_user_id, {
      type: "payroll_request_outcome",
      title,
      message,
      actorUserId,
      entityType: "payroll_request",
      entityId: row.record_id,
      actionPath: "/dashboard/payroll/staff/claims",
    });
}

router.get(
  "/",
  authenticateToken,
  allowRoles("Staff", "HR", "Finance", "Admin"),
  async (req, res) => {
    const params = [req.user.companyId];
    let where = "c.company_id=?";
    if (req.user.role === "Staff") {
      where += " AND c.staff_employee_id=?";
      params.push(req.user.staffId || -1);
    }
    const [rows] = await pool.query(
      `SELECT ${REQUEST_COLUMNS},s.name staff_name FROM claims_and_loans c JOIN staff s ON s.employee_id=c.staff_employee_id AND s.company_id=c.company_id WHERE ${where} ORDER BY c.submitted_at DESC`,
      params,
    );
    res.json(rows.map(unified));
  },
);
router.post(
  "/",
  authenticateToken,
  allowRoles("Staff", "HR", "Finance"),
  evidenceUpload,
  async (req, res) => {
    const files = req.files || [];
    const cleanup = () =>
      files.forEach((f) => fs.promises.unlink(f.path).catch(() => {}));
    if (!files.length) {
      cleanup();
      return res
        .status(400)
        .json({ message: "At least one supporting document is required" });
    }
    if (files.some((f) => !signatureMatches(f))) {
      cleanup();
      return res
        .status(400)
        .json({ message: "An evidence file does not match its declared type" });
    }
    const requestType = String(req.body.requestType || "");
    const dbType = {
      reimbursement: "expense_claim",
      loan: "loan",
      salary_advance: "advance_request",
    }[requestType];
    const amount = Number(req.body.amount);
    const purpose = String(req.body.purpose || "").trim();
    const description = String(req.body.description || "").trim();
    if (
      !dbType ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !purpose ||
      description.length < 5
    ) {
      cleanup();
      return res
        .status(400)
        .json({
          message:
            "Request type, purpose, positive amount, and description are required",
        });
    }
    const id = `${dbType === "expense_claim" ? "CLM" : dbType === "loan" ? "LN" : "AR"}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const months =
      requestType === "loan" ? Number(req.body.repaymentMonths) : 1;
    if (
      requestType === "loan" &&
      (!Number.isInteger(months) || months < 1 || months > 36)
    ) {
      cleanup();
      return res
        .status(400)
        .json({ message: "Repayment period must be between 1 and 36 months" });
    }
    const attachments = files.map(attachment);
    const metadata = {
      created_by: req.user.userId,
      custom_purpose: purpose,
      repayment_months: months,
      attachments,
      outstanding_balance: requestType === "reimbursement" ? null : amount,
      total_paid: 0,
      evidence_storage: "database_blob_v1",
    };
    let connection;
    try {
      await ensureEvidenceStorage();
      const evidencePayload = encodeEvidence(files, attachments);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [[ownedStaff]] = await connection.query(
        "SELECT employee_id FROM staff WHERE employee_id=? AND company_id=? LIMIT 1",
        [req.user.staffId, req.user.companyId],
      );
      if (!ownedStaff)
        throw Object.assign(
          new Error("Your staff profile is not linked to this workspace."),
          { code: "STAFF_TENANT_MISMATCH" },
        );
      await connection.query(
        `INSERT INTO claims_and_loans(company_id,record_id,type,claim_category,amount,status,description,expense_date,proof_path,request_metadata,evidence_payload,created_by,staff_employee_id,outstanding_balance) VALUES(?,?,?,?,?,'pending_hr',?,?,?,?,?,?,?,?)`,
        [
          req.user.companyId,
          id,
          dbType,
          purpose,
          amount,
          description,
          req.body.expenseDate || null,
          metadata.attachments[0].path,
          JSON.stringify(metadata),
          Buffer.alloc(0),
          req.user.userId,
          req.user.staffId,
          metadata.outstanding_balance,
        ],
      );
      const chunkSize = 512 * 1024;
      for (
        let offset = 0;
        offset < evidencePayload.length;
        offset += chunkSize
      ) {
        await connection.query(
          "UPDATE claims_and_loans SET evidence_payload=CONCAT(COALESCE(evidence_payload,''),?) WHERE record_id=? AND company_id=?",
          [
            evidencePayload.subarray(offset, offset + chunkSize),
            id,
            req.user.companyId,
          ],
        );
      }
      await connection.commit();
      connection.release();
      connection = null;
      await notifyRoles(["HR"], {
        type: "payroll_request",
        title: "Payroll request awaiting HR review",
        message: `${id} requires evidence review.`,
        actorUserId: req.user.userId,
        entityType: "payroll_request",
        entityId: id,
        actionPath: "/dashboard/payroll/hr/claims",
      });
      res.status(201).json(unified(await find(id, req.user.companyId)));
    } catch (error) {
      if (connection) {
        await connection.rollback().catch(() => {});
        connection.release();
      }
      cleanup();
      res
        .status(500)
        .json({
          message:
            "Failed to store the payroll request and supporting documents in the database",
          error: error.message,
        });
    }
  },
);
router.get(
  "/:id/attachments/:attachmentId",
  authenticateToken,
  allowRoles("Staff", "HR", "Finance", "Admin"),
  async (req, res) => {
    await ensureEvidenceStorage();
    const row = await find(req.params.id, req.user.companyId, pool, true);
    if (!row) return res.status(404).json({ message: "Request not found" });
    if (
      req.user.role === "Staff" &&
      Number(row.staff_employee_id) !== Number(req.user.staffId)
    )
      return res.status(403).json({ message: "Access denied" });
    const item = unified(row).attachments.find(
      (a) => a.id === req.params.attachmentId,
    );
    if (!item) return res.status(404).json({ message: "Evidence unavailable" });
    const stored = decodeEvidence(row.evidence_payload).find(
      (a) => a.id === req.params.attachmentId,
    );
    if (stored?.data) {
      const bytes = Buffer.from(stored.data, "base64");
      res.setHeader(
        "Content-Type",
        stored.mimeType || item.mimeType || "application/octet-stream",
      );
      res.setHeader("Content-Length", bytes.length);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(stored.name || item.name)}`,
      );
      return res.send(bytes);
    }
    const file = path.resolve(__dirname, "..", "..", item.path || "");
    const allowedRoot = path.resolve(__dirname, "..", "..", "uploads");
    if (!file.startsWith(allowedRoot) || !fs.existsSync(file))
      return res
        .status(404)
        .json({
          message: "Evidence unavailable in database or legacy storage",
        });
    return res.sendFile(file, {
      headers: {
        "Content-Type": item.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(item.name)}`,
      },
    });
  },
);
router.put(
  "/:id/hr/:action",
  authenticateToken,
  allowRoles("HR"),
  async (req, res) => {
    const action = req.params.action;
    if (!["approve", "reject"].includes(action))
      return res.status(400).json({ message: "Invalid action" });
    const reason = String(req.body.reason || "").trim();
    if (action === "reject" && !reason)
      return res
        .status(400)
        .json({ message: "A rejection reason is required" });
    const row = await find(req.params.id, req.user.companyId);
    if (
      !row ||
      !["pending", "pending_hr", "returned_to_hr"].includes(row.status)
    )
      return res
        .status(409)
        .json({ message: "Request is no longer awaiting HR" });
    const meta = {
      ...parse(row.request_metadata),
      hr_reviewed_by: req.user.userId,
      hr_action: action,
    };
    await pool.query(
      "UPDATE claims_and_loans SET status=?,reviewed_at=NOW(),reviewer_comments=?,request_metadata=? WHERE record_id=? AND company_id=?",
      [
        action === "approve" ? "hr_approved" : "hr_rejected",
        reason || null,
        JSON.stringify(meta),
        row.record_id,
        req.user.companyId,
      ],
    );
    await notifyOwner(
      row,
      req.user.companyId,
      action === "approve"
        ? "Request approved by HR"
        : "Request rejected by HR",
      action === "approve"
        ? "Your request is awaiting Finance confirmation."
        : reason,
      req.user.userId,
    );
    if (action === "approve")
      await notifyRoles(["Finance"], {
        type: "payroll_request",
        title: "Payroll request awaiting Finance",
        message: `${row.record_id} passed HR review.`,
        entityType: "payroll_request",
        entityId: row.record_id,
        actionPath: "/dashboard/payroll/finance/employee-requests",
      });
    res.json(unified(await find(row.record_id, req.user.companyId)));
  },
);
router.put(
  "/:id/finance/:action",
  authenticateToken,
  allowRoles("Finance"),
  async (req, res) => {
    const action = req.params.action;
    if (!["approve", "reject", "return", "release-manual"].includes(action))
      return res.status(400).json({ message: "Invalid action" });
    const reason = String(req.body.reason || "").trim();
    if (["reject", "return"].includes(action) && !reason)
      return res.status(400).json({ message: "A reason is required" });
    const row = await find(req.params.id, req.user.companyId);
    if (
      !row ||
      !["hr_approved", "finance_approved", "approved"].includes(row.status)
    )
      return res
        .status(409)
        .json({ message: "Request is no longer awaiting Finance" });
    const meta = {
      ...parse(row.request_metadata),
      finance_processed_by: req.user.userId,
      finance_comments: reason,
    };
    let status =
      action === "reject"
        ? "finance_rejected"
        : action === "return"
          ? "returned_to_hr"
          : row.type === "expense_claim"
            ? "payroll_approved"
            : "finance_approved";
    let reference = row.payment_reference;
    if (action === "release-manual") {
      reference = String(req.body.paymentReference || "").trim();
      if (!reference)
        return res
          .status(400)
          .json({ message: "Payment reference is required" });
      status = "released";
      meta.disbursement_status = "confirmed";
      meta.monthly_installment = Number(
        row.monthly_installment || meta.monthly_installment || row.amount,
      );
    }
    await pool.query(
      `UPDATE claims_and_loans SET status=?,finance_processed_at=NOW(),payment_reference=?,payroll_inclusion_status=CASE WHEN type='expense_claim' AND ?='payroll_approved' THEN 'queued' ELSE payroll_inclusion_status END,monthly_installment=COALESCE(monthly_installment,?),outstanding_balance=CASE WHEN type IN('loan','advance_request') AND ?='released' THEN amount ELSE outstanding_balance END,request_metadata=? WHERE record_id=? AND company_id=?`,
      [
        status,
        reference,
        status,
        row.type === "loan"
          ? Number(row.amount) / Number(meta.repayment_months || 1)
          : row.amount,
        status,
        JSON.stringify(meta),
        row.record_id,
        req.user.companyId,
      ],
    );
    const ownerNotice =
      status === "payroll_approved"
        ? [
            "Reimbursement approved by Finance",
            "Your reimbursement will be included in the next newly created payroll run.",
          ]
        : status === "finance_approved"
          ? [
              "Request approved by Finance",
              "Finance approved your request. Payment release is the next step.",
            ]
          : status === "finance_rejected"
            ? ["Request rejected by Finance", reason]
            : status === "returned_to_hr"
              ? ["Request returned for HR review", reason]
              : [
                  "Payment release confirmed",
                  `Your funds were released. Reference: ${reference}`,
                ];
    await notifyOwner(row, req.user.companyId, ownerNotice[0], ownerNotice[1], req.user.userId);
    await notifyRoles(["HR"], {
      type: "payroll_request_decision",
      title: ownerNotice[0],
      message: `${row.record_id}: ${ownerNotice[1]}`,
      actorUserId: req.user.userId,
      entityType: "payroll_request",
      entityId: row.record_id,
      actionPath: "/dashboard/payroll/hr/claims",
    });
    res.json(unified(await find(row.record_id, req.user.companyId)));
  },
);

router.post(
  "/finance-release/:id/treasury",
  authenticateToken,
  allowRoles("Finance"),
  async (req, res) => {
    const row = await find(req.params.id, req.user.companyId);
    if (
      !row ||
      row.type === "expense_claim" ||
      row.status !== "finance_approved"
    )
      return res
        .status(409)
        .json({
          message:
            "Only a Finance-approved loan or salary advance can be released.",
        });
    const [[latest]] = await pool.query(
      `SELECT pr.payroll_run_id, pr.payroll_month, pr.payroll_year, pr.configuration_json, s.bank, s.account_no
       FROM staff s
       LEFT JOIN payroll p ON p.staff_employee_id=s.employee_id AND p.company_id=s.company_id
       LEFT JOIN payroll_run pr ON pr.payroll_run_id=p.payroll_run_id AND pr.company_id=s.company_id
       WHERE s.employee_id=? AND s.company_id=? ORDER BY pr.created_at DESC LIMIT 1`,
      [row.staff_employee_id, req.user.companyId],
    );
    const config = parse(latest?.configuration_json);
    const recipient =
      config.paymentRecipients?.[String(row.staff_employee_id)] || {};
    try {
      const transfer = await submitModernTreasuryEmployeePayment({
        payrollRunId: `request-${row.record_id}`,
        payrollPeriod: "payroll-request",
        batchReference: `REQ-${row.record_id}`,
        employee: {
          payrollId: row.record_id,
          employeeId: row.staff_employee_id,
          employeeName: row.staff_name,
          bankName: latest?.bank,
          bankAccount: latest?.account_no,
          amount: row.amount,
          currency: "SGD",
          modernTreasuryCounterpartyId: recipient.modernTreasuryCounterpartyId,
          modernTreasuryReceivingAccountId:
            recipient.modernTreasuryReceivingAccountId,
        },
      });
      const metadata = {
        ...parse(row.request_metadata),
        disbursement_status: "processing",
        modern_treasury_transfer_id: transfer.transferId,
        modern_treasury_idempotency_key: transfer.idempotencyKey,
        finance_processed_by: req.user.userId,
      };
      await pool.query(
        "UPDATE claims_and_loans SET status='released',finance_processed_at=NOW(),payment_reference=?,monthly_installment=COALESCE(monthly_installment,?),outstanding_balance=amount,request_metadata=? WHERE record_id=? AND company_id=? AND status='finance_approved'",
        [
          transfer.modernTreasuryReference || transfer.transferId,
          row.type === "loan"
            ? Number(row.amount) / Number(metadata.repayment_months || 1)
            : row.amount,
          JSON.stringify(metadata),
          row.record_id,
          req.user.companyId,
        ],
      );
      await notifyOwner(
        row,
        req.user.companyId,
        "Payroll request released",
        `Finance submitted your payment through Modern Treasury. Reference: ${transfer.modernTreasuryReference || transfer.transferId}`,
        req.user.userId,
      );
      return res.json(unified(await find(row.record_id, req.user.companyId)));
    } catch (error) {
      return res
        .status(409)
        .json({
          code: error.code || "TREASURY_RELEASE_FAILED",
          message: error.message,
        });
    }
  },
);

module.exports = router;
