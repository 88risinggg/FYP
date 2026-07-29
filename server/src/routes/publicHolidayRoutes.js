/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - HR
 * PURPOSE: Defines the available public Holiday Routes API endpoints and connects them to handlers.
 * LAYER: Backend route - maps HTTP methods and URLs to middleware and controller functions.
 * FIND RELATED CODE: Follow the imported controller function to find request handling.
 */
/**
 * Public Holiday Routes
 *
 * RESTful API routes for managing public holidays.
 * All routes require HR role access.
 */

const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const {
  getAll,
  getById,
  create,
  update,
  remove,
} = require("../controllers/publicHolidayController");

const router = express.Router();

// All routes require authentication + HR role
router.use(authenticateToken, allowRoles("HR"));

// GET /api/hr/public-holidays — List all public holidays
router.get("/", getAll);

// GET /api/hr/public-holidays/:id — Get a single public holiday
router.get("/:id", getById);

// POST /api/hr/public-holidays — Create a new public holiday
router.post("/", create);

// PUT /api/hr/public-holidays/:id — Update a public holiday
router.put("/:id", update);

// DELETE /api/hr/public-holidays/:id — Delete a public holiday
router.delete("/:id", remove);

module.exports = router;
