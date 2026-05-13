import express from "express";
import { staffProfiles } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.patch("/profile/:staffId/contact", allowRoles("Staff", "Admin", "HR"), (req, res) => {
  const profile = staffProfiles.find((item) => item.staff_id === req.params.staffId);
  if (!profile) return res.status(404).json({ message: "Staff profile not found" });
  if (req.user.role === "Staff" && req.user.staffId !== req.params.staffId) return res.status(403).json({ message: "Staff can only update own profile" });
  profile.phone = req.body.phone || profile.phone;
  profile.email = req.body.email || profile.email;
  addAudit(req.user.email, `Updated contact details for ${profile.staff_id}`, "Staff");
  res.json(profile);
});

export default router;
