const express = require("express");
const multer = require("multer");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { createHire, editRequest, getManagedUsers, importHires, reviewRequest } = require("../controllers/payrollUserController");
const { changeUserRole, changeUserStatus, resetUserPassword } = require("../controllers/adminPayrollController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(authenticateToken);
router.get("/", requireRole("Admin", "HR"), getManagedUsers);
router.post("/hires", requireRole("HR"), createHire);
router.post("/hires/import", requireRole("HR"), upload.single("file"), importHires);
router.put("/activation-requests/:requestId", requireRole("HR"), editRequest);
router.post("/activation-requests/:requestId/:action", requireRole("Admin"), reviewRequest);
router.patch("/:userId/status", requireRole("Admin"), changeUserStatus);
router.patch("/:userId/role", requireRole("Admin"), changeUserRole);
router.post("/:userId/reset-password", requireRole("Admin"), resetUserPassword);

module.exports = router;
