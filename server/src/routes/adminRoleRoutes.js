const express = require("express");

const {
  getActivity,
  getDistribution,
  getRole,
  getRoles,
  getSummary,
  patchDeactivateRole,
  postDuplicateRole
} = require("../controllers/adminRoleController");
const { authenticateToken, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("Admin"));

router.get("/", getRoles);
router.get("/summary", getSummary);
router.get("/activity", getActivity);
router.get("/distribution", getDistribution);
router.get("/:id", getRole);
router.post("/:id/duplicate", postDuplicateRole);
router.patch("/:id/deactivate", patchDeactivateRole);

module.exports = router;
