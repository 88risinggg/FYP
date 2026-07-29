/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Defines the available payroll User Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
const express = require("express");
const multer = require("multer");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { createHire, editRequest, getManagedUsers, importHires, resendSetupEmail, resendUserSetupEmail, reviewRequest } = require("../controllers/payrollUserController");
const { changeUserRole, changeUserStatus, resetUserPassword } = require("../controllers/adminPayrollController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(authenticateToken);
router.get("/", requireRole("Admin", "HR"), getManagedUsers);
router.post("/hires", requireRole("Admin", "HR"), createHire);
router.post("/hires/import", requireRole("Admin", "HR"), upload.single("file"), importHires);
router.put("/activation-requests/:requestId", requireRole("HR"), editRequest);
router.post("/activation-requests/:requestId/resend-setup", requireRole("Admin"), resendSetupEmail);
router.post("/:userId/resend-setup", requireRole("Admin"), resendUserSetupEmail);
router.post("/activation-requests/:requestId/:action", requireRole("Admin"), reviewRequest);
router.patch("/:userId/status", requireRole("Admin"), changeUserStatus);
router.patch("/:userId/role", requireRole("Admin"), changeUserRole);
router.post("/:userId/reset-password", requireRole("Admin"), resetUserPassword);

module.exports = router;
