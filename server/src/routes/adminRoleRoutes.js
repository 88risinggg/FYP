/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Defines the available admin Role Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
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
