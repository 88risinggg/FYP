/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Defines the available leave Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const {
  applyLeave,
  getMyApplications,
  getMyBalance,
  cancelLeave,
  getPendingApplications,
  getAllApplications,
  updateLeaveStatus,
  getAllBalances,
  getLeaveTypes,
  updateLeaveType,
  runCarryForward,
} = require("../controllers/leaveController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

// Multer configuration for leave attachment uploads
const leaveUploadsDir = path.join(__dirname, "..", "..", "uploads", "leave-attachments");
if (!fs.existsSync(leaveUploadsDir)) fs.mkdirSync(leaveUploadsDir, { recursive: true });

const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, leaveUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, JPG, and PNG files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

function debugLeave(req, stage, details = {}) {
  if (process.env.DEBUG_LEAVE !== "true") return;
  console.log("[LEAVE_DEBUG]", JSON.stringify({
    stage,
    method: req.method,
    path: req.originalUrl || req.url || "unknown",
    userId: req.user?.userId || null,
    role: req.user?.role || null,
    companyId: req.user?.companyId || null,
    staffId: req.user?.staffId || null,
    ...details
  }));
}

router.use((req, _res, next) => {
  debugLeave(req, "route_enter");
  next();
});

// ── STAFF + HR: self-service leave actions ───────────────────────────────────
// Used by: client/src/pages/payroll/StaffLeaveView.jsx  (staff dashboard)
//          client/src/pages/payroll/HRLeaveManagement.jsx (HR can also apply)
// Service: client/src/services/leaveService.js → applyLeave / getMyApplications / getMyBalance / cancelLeave
router.post("/apply",                    authenticateToken, allowRoles("Staff", "HR"), upload.single("attachment"), applyLeave);       // POST /api/leave/apply
router.get("/my-applications",           authenticateToken, allowRoles("Staff", "HR"), getMyApplications);                             // GET  /api/leave/my-applications
router.get("/my-balance",                authenticateToken, allowRoles("Staff", "HR"), getMyBalance);                                  // GET  /api/leave/my-balance
router.put("/applications/:id/cancel",   authenticateToken, allowRoles("Staff", "HR"), cancelLeave);                                   // PUT  /api/leave/applications/:id/cancel

// ── STAFF + HR: shared read ───────────────────────────────────────────────────
// Returns leave types filtered by the requesting user's gender (Maternity/Paternity logic)
// Controller: leaveController.js → getLeaveTypes  reads staff.gender from DB
router.get("/types",                     authenticateToken, allowRoles("Staff", "HR"), getLeaveTypes);                                 // GET  /api/leave/types

// ── HR ONLY: approval and management ─────────────────────────────────────────
// Used by: client/src/pages/payroll/HRLeaveManagement.jsx
// Service: client/src/services/leaveService.js → getPendingApplications / getAllApplications / updateLeaveStatus / getAllBalances / updateLeaveType / runCarryForward
router.get("/applications/pending",      authenticateToken, allowRoles("HR"), getPendingApplications);                                 // GET  /api/leave/applications/pending
router.get("/applications/all",          authenticateToken, allowRoles("HR"), getAllApplications);                                     // GET  /api/leave/applications/all?page=&pageSize=
router.put("/applications/:id/status",   authenticateToken, allowRoles("HR"), updateLeaveStatus);                                     // PUT  /api/leave/applications/:id/status
router.get("/balances/all",              authenticateToken, allowRoles("HR"), getAllBalances);                                         // GET  /api/leave/balances/all
router.put("/types/:id",                 authenticateToken, allowRoles("HR"), updateLeaveType);                                       // PUT  /api/leave/types/:id
router.post("/carry-forward",            authenticateToken, allowRoles("HR"), runCarryForward);                                       // POST /api/leave/carry-forward

module.exports = router;
