const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  createProfile,
  getProfileByUserId,
  getAllProfiles,
  updateProfileByUserId,
  deleteProfileByUserId
} = require("../controllers/profileController");

const router = express.Router();

// CRUD
router.post("/", authenticateToken, createProfile);           // Create
router.get("/", authenticateToken, getAllProfiles);            // Read all
router.get("/:userId", authenticateToken, getProfileByUserId); // Read one
router.put("/:userId", authenticateToken, updateProfileByUserId); // Update
router.delete("/:userId", authenticateToken, deleteProfileByUserId); // Delete

module.exports = router;
