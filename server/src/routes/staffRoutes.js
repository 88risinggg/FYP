const express = require("express");
const { staffProfiles } = require("../services/data");
const { addAudit } = require("../services/audit");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

router.patch("/profile/:staffId/contact", authenticateToken, allowRoles("Staff", "Admin", "HR"), (req, res) => {
  const profile = staffProfiles.find(p => p.staff_id === req.params.staffId);
  if (!profile) return res.status(404).json({ message: "Staff profile not found" });
  if (req.user.role === "Staff" && req.user.staffId !== req.params.staffId) {
    return res.status(403).json({ message: "Staff can only update own profile" });
  }
  profile.phone = req.body.phone || profile.phone;
  profile.email = req.body.email || profile.email;
  addAudit(req.user.email, `Updated contact details for ${profile.staff_id}`, "Staff");
  res.json(profile);
});

module.exports = router;
