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

// Staff endpoints
router.post("/apply", authenticateToken, allowRoles("Staff"), upload.single("attachment"), applyLeave);
router.get("/my-applications", authenticateToken, allowRoles("Staff"), getMyApplications);
router.get("/my-balance", authenticateToken, allowRoles("Staff"), getMyBalance);
router.put("/applications/:id/cancel", authenticateToken, allowRoles("Staff"), cancelLeave);

// Shared endpoints (Staff and HR)
router.get("/types", authenticateToken, allowRoles("Staff", "HR"), getLeaveTypes);

// HR endpoints
router.get("/applications/pending", authenticateToken, allowRoles("HR"), getPendingApplications);
router.get("/applications/all", authenticateToken, allowRoles("HR"), getAllApplications);
router.put("/applications/:id/status", authenticateToken, allowRoles("HR"), updateLeaveStatus);
router.get("/balances/all", authenticateToken, allowRoles("HR"), getAllBalances);
router.put("/types/:id", authenticateToken, allowRoles("HR"), updateLeaveType);
router.post("/carry-forward", authenticateToken, allowRoles("HR"), runCarryForward);

module.exports = router;
