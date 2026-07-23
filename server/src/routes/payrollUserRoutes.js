const express = require("express");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");
const { createHire, editRequest, getManagedUsers, reviewRequest } = require("../controllers/payrollUserController");
const { changeUserRole, changeUserStatus, resetUserPassword } = require("../controllers/adminPayrollController");

const router = express.Router();
router.use(authenticateToken);
router.get("/", requireRole("Admin", "HR"), getManagedUsers);
router.post("/hires", requireRole("HR"), createHire);
router.put("/activation-requests/:requestId", requireRole("HR"), editRequest);
router.post("/activation-requests/:requestId/:action", requireRole("Admin"), reviewRequest);
router.patch("/:userId/status", requireRole("Admin"), changeUserStatus);
router.patch("/:userId/role", requireRole("Admin"), changeUserRole);
router.post("/:userId/reset-password", requireRole("Admin"), resetUserPassword);

module.exports = router;
