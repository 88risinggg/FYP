const express = require("express");
const { createStaff, getStaffList, getStaffById, updateStaff, deleteStaff, importProfiles } = require("../controllers/staffController");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

// Map existing routes to controller handlers (keep middleware in place)
router.get("/", authenticateToken, allowRoles("Admin", "HR"), getStaffList);
router.post("/", authenticateToken, allowRoles("Admin", "HR"), createStaff);
router.get("/:id", authenticateToken, allowRoles("Admin", "HR"), getStaffById);
router.put("/:id", authenticateToken, allowRoles("Admin", "HR"), updateStaff);
router.delete("/:id", authenticateToken, allowRoles("Admin", "HR"), deleteStaff);

// Profile update route used by Staff self-update endpoint
router.patch("/profile/:employeeId", authenticateToken, allowRoles("Staff", "Admin", "HR"), updateStaff);

// Bulk import
router.post("/import", authenticateToken, allowRoles("Admin", "HR"), importProfiles);

module.exports = router;
