const express = require("express");
const multer = require("multer");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { createHire, editRequest, getManagedUsers, importHires, resendSetupEmail, reviewRequest } = require("../controllers/payrollUserController");
const { changeUserRole, changeUserStatus, resetUserPassword } = require("../controllers/adminPayrollController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(authenticateToken);
router.get("/", requireRole("Admin", "HR"), getManagedUsers);
router.post("/hires", requireRole("Admin", "HR"), createHire);
router.post("/hires/import", requireRole("Admin", "HR"), upload.single("file"), importHires);
router.put("/activation-requests/:requestId", requireRole("HR"), editRequest);
router.post("/activation-requests/:requestId/resend-setup", requireRole("Admin"), resendSetupEmail);
router.post("/activation-requests/:requestId/:action", requireRole("Admin"), reviewRequest);
router.patch("/:userId/status", requireRole("Admin"), changeUserStatus);
router.patch("/:userId/role", requireRole("Admin"), changeUserRole);
router.post("/:userId/reset-password", requireRole("Admin"), resetUserPassword);

module.exports = router;
