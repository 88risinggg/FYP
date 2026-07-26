const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { pool } = require("../config/db");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { requireTenant } = require("../middleware/tenantMiddleware");
const { getCompany, listCompanies, onboardExistingCompany, provisionCompany, resendCompanyAdminSetup, safeCompany, updateCompany } = require("../services/companyService");

const router = express.Router();
const logoRoot = path.join(__dirname, "..", "..", "uploads", "company-branding");
fs.mkdirSync(logoRoot, { recursive: true });
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) => { const folder = path.join(logoRoot, String(req.user.companyId)); fs.mkdirSync(folder, { recursive: true }); callback(null, folder); },
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => { const ok = ["image/png", "image/jpeg"].includes(file.mimetype) && [".png", ".jpg", ".jpeg"].includes(path.extname(file.originalname).toLowerCase()); callback(ok ? null : new Error("Upload a PNG or JPG logo."), ok); }
});
router.get("/branding/:workspaceId/logo", async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT logo_path FROM companies WHERE workspace_id=? AND status='active' LIMIT 1", [req.params.workspaceId]);
    const logoPath = rows[0]?.logo_path;
    if (!logoPath) return res.status(404).end();
    const absolute = path.resolve(__dirname, "..", "..", logoPath);
    if (!absolute.startsWith(`${logoRoot}${path.sep}`) || !fs.existsSync(absolute)) return res.status(404).end();
    return res.sendFile(absolute, { headers: { "Cache-Control": "no-cache, must-revalidate" } });
  } catch (error) { return next(error); }
});
router.use(authenticateToken);

router.get("/profile", requireTenant, async (req, res, next) => {
  try { res.json({ company: safeCompany(await getCompany(req.user.companyId)) }); } catch (error) { next(error); }
});
router.put("/profile", requireRole("Admin"), requireTenant, async (req, res, next) => {
  try { res.json({ company: await updateCompany(req.user.companyId, req.body || {}, req.user.userId) }); } catch (error) { next(error); }
});
router.post("/profile/logo", requireRole("Admin"), requireTenant, (req, res, next) => {
  logoUpload.single("logo")(req, res, async (error) => {
    if (error) return res.status(400).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Company logo must not exceed 3MB." : error.message });
    if (!req.file) return res.status(400).json({ message: "Select a company logo." });
    try {
      const bytes = fs.readFileSync(req.file.path);
      const valid = req.file.mimetype === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (!valid) { fs.unlinkSync(req.file.path); return res.status(400).json({ message: "The logo file signature is invalid." }); }
      const relative = path.relative(path.join(__dirname, "..", ".."), req.file.path).split(path.sep).join("/");
      await pool.execute("UPDATE companies SET logo_path=?,updated_at=NOW() WHERE company_id=?", [relative, req.user.companyId]);
      await pool.execute(`INSERT INTO audit_logs (user_id,company_id,module,activity_type,action_description,affected_record,status,created_at)
        VALUES (?,?,'Company','Branding Update','Updated company brand logo',?,'Success',NOW())`, [req.user.userId || null, req.user.companyId, String(req.user.companyId)]).catch(() => {});
      return res.json({ company: safeCompany(await getCompany(req.user.companyId)) });
    } catch (uploadError) { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); return next(uploadError); }
  });
});

router.get("/platform/companies", requireRole("PlatformOperator"), async (_req, res, next) => {
  try { res.json({ companies: await listCompanies() }); } catch (error) { next(error); }
});
router.post("/platform/companies", requireRole("PlatformOperator"), async (req, res, next) => {
  try {
    if (!req.body?.company?.name) return res.status(400).json({ message: "Company name is required." });
    res.status(201).json(await provisionCompany({ ...req.body, operatorUserId: req.user.userId }));
  } catch (error) { next(error); }
});
router.post("/platform/companies/:workspaceId/onboard", requireRole("PlatformOperator"), async (req, res, next) => {
  try { res.json(await onboardExistingCompany({ workspaceId: req.params.workspaceId, company: req.body.company || {}, admin: req.body.admin || {}, operatorUserId: req.user.userId })); }
  catch (error) { next(error); }
});
router.post("/platform/companies/:workspaceId/resend-admin-setup", requireRole("PlatformOperator"), async (req, res, next) => {
  try { res.json(await resendCompanyAdminSetup({ workspaceId: req.params.workspaceId, operatorUserId: req.user.userId })); }
  catch (error) { next(error); }
});
router.post("/platform/support-requests", requireRole("PlatformOperator"), async (req, res, next) => {
  try {
    const companyId = Number(req.body.companyId);
    const reason = String(req.body.reason || "").trim();
    if (!companyId || !reason) return res.status(400).json({ message: "Company and support reason are required." });
    const [result] = await pool.execute("INSERT INTO support_access_grants (company_id,operator_user_id,requested_reason,status) VALUES (?,?,?,'pending')", [companyId, req.user.userId, reason]);
    res.status(201).json({ grantId: result.insertId, status: "pending" });
  } catch (error) { next(error); }
});
router.get("/platform/support-requests", requireRole("PlatformOperator"), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT g.grant_id,g.company_id,c.display_name,c.company_name,g.requested_reason,g.access_mode,
              g.duration_minutes,g.status,g.requested_at,g.expires_at
       FROM support_access_grants g JOIN companies c ON c.company_id=g.company_id
       WHERE g.operator_user_id=? ORDER BY g.requested_at DESC`,
      [req.user.userId]
    );
    res.json({ requests: rows });
  } catch (error) { next(error); }
});
router.get("/support-requests", requireRole("Admin"), requireTenant, async (req, res, next) => {
  try { const [rows] = await pool.execute("SELECT grant_id,requested_reason,access_mode,duration_minutes,status,requested_at,expires_at FROM support_access_grants WHERE company_id=? ORDER BY requested_at DESC", [req.user.companyId]); res.json({ requests: rows }); } catch (error) { next(error); }
});
router.post("/support-requests/:id/review", requireRole("Admin"), requireTenant, async (req, res, next) => {
  try {
    const action = req.body.action;
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ message: "Action must be approve or reject." });
    const mode = req.body.accessMode === "read_write" ? "read_write" : "read_only";
    const duration = Math.min(240, Math.max(15, Number(req.body.durationMinutes || 60)));
    const status = action === "approve" ? "approved" : "rejected";
    const [result] = await pool.execute(`UPDATE support_access_grants SET status=?,access_mode=?,duration_minutes=?,reviewed_by=?,reviewed_at=NOW(),review_reason=? WHERE grant_id=? AND company_id=? AND status='pending'`, [status, mode, duration, req.user.userId, req.body.reason || null, req.params.id, req.user.companyId]);
    if (!result.affectedRows) return res.status(409).json({ message: "Support request is no longer pending." });
    res.json({ status });
  } catch (error) { next(error); }
});
router.post("/platform/support-requests/:id/activate", requireRole("PlatformOperator"), async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM support_access_grants WHERE grant_id=? AND operator_user_id=? AND status IN ('approved','active') LIMIT 1", [req.params.id, req.user.userId]);
    const grant = rows[0];
    if (!grant) return res.status(409).json({ message: "Support access has not been approved." });
    const expiresAt = grant.expires_at || new Date(Date.now() + Number(grant.duration_minutes) * 60000);
    await pool.execute("UPDATE support_access_grants SET status='active',activated_at=COALESCE(activated_at,NOW()),expires_at=? WHERE grant_id=?", [expiresAt, grant.grant_id]);
    const token = jwt.sign({ userId: req.user.userId, role: "Admin", operatorRole: "PlatformOperator", companyId: grant.company_id, supportGrantId: grant.grant_id }, process.env.JWT_SECRET, { expiresIn: `${grant.duration_minutes}m` });
    res.json({ token, expiresAt, supportContext: { grantId: grant.grant_id, mode: grant.access_mode }, company: safeCompany(await getCompany(grant.company_id)) });
  } catch (error) { next(error); }
});
router.post("/support-requests/:id/revoke", requireRole("Admin"), requireTenant, async (req, res, next) => {
  try { await pool.execute("UPDATE support_access_grants SET status='revoked',revoked_at=NOW() WHERE grant_id=? AND company_id=?", [req.params.id, req.user.companyId]); res.json({ status: "revoked" }); } catch (error) { next(error); }
});

module.exports = router;
