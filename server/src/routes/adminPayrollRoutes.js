const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const {
  addUser,
  addPayslipLayout,
  changeUserRole,
  changeUserStatus,
  getAdminEffectivePayrollRules,
  getAdminPayrollDashboard,
  getAdminPayrollInsights,
  getAdminPayrollReports,
  getPayrollRuleConfig,
  getPayslipLayouts,
  makeDefaultPayslipLayout,
  resetUserPassword,
  updatePayrollSetting
} = require("../controllers/adminPayrollController");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();
const layoutUploadDirectory = path.join(__dirname, "..", "..", "uploads", "payslip-layouts");
fs.mkdirSync(layoutUploadDirectory, { recursive: true });

const layoutUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, layoutUploadDirectory),
    filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.pdf`)
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === "application/pdf" && path.extname(file.originalname).toLowerCase() === ".pdf";
    callback(isPdf ? null : new Error("Only PDF payslip layouts are allowed"), isPdf);
  }
});

function uploadPayslipLayout(req, res, next) {
  layoutUpload.single("layoutFile")(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Payslip layout must not exceed 10MB"
      : error.message;
    return res.status(400).json({ message });
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "Admin") {
    return res.status(403).json({
      message: "Admin access required"
    });
  }

  next();
}

function requirePayrollConfigReader(req, res, next) {
  if (!["Admin", "Finance"].includes(req.user?.role)) {
    return res.status(403).json({
      message: "Payroll config access required"
    });
  }

  next();
}

router.use(authenticateToken);

router.get("/config", requirePayrollConfigReader, getPayrollRuleConfig);

router.use(requireAdmin);

router.get("/dashboard", getAdminPayrollDashboard);
router.get("/dashboard/insights", getAdminPayrollInsights);
router.get("/effective-rules", getAdminEffectivePayrollRules);
router.get("/reports", getAdminPayrollReports);
router.get("/payslip-layouts", getPayslipLayouts);
router.post("/users", addUser);
router.post("/payslip-layouts", uploadPayslipLayout, addPayslipLayout);
router.patch("/payslip-layouts/:layoutId/default", makeDefaultPayslipLayout);
router.patch("/users/:userId/status", changeUserStatus);
router.patch("/users/:userId/role", changeUserRole);
router.post("/users/:userId/reset-password", resetUserPassword);
router.patch("/settings/:settingKey", updatePayrollSetting);

module.exports = router;
