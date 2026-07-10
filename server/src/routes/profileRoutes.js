const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  createProfile,
  getProfileByUserId,
  getAllProfiles,
  updateProfileByUserId,
  deleteProfileByUserId,
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact
} = require("../controllers/profileController");

const router = express.Router();

// CRUD
router.post("/", authenticateToken, createProfile);           // Create
router.get("/", authenticateToken, getAllProfiles);            // Read all
router.get("/:userId", authenticateToken, getProfileByUserId); // Read one
router.put("/:userId", authenticateToken, updateProfileByUserId); // Update
router.delete("/:userId", authenticateToken, deleteProfileByUserId); // Delete

// [STAFF BRANCH - Steven] Emergency contact endpoints
router.get("/:userId/emergency-contacts", authenticateToken, getEmergencyContacts);
router.post("/:userId/emergency-contacts", authenticateToken, addEmergencyContact);
router.put("/:userId/emergency-contacts/:contactId", authenticateToken, updateEmergencyContact);
router.delete("/:userId/emergency-contacts/:contactId", authenticateToken, deleteEmergencyContact);

module.exports = router;
