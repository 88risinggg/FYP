import express from "express";
import { staffProfiles } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.get("/staff", allowRoles("Admin", "HR"), (_req, res) => res.json(staffProfiles));

router.post("/staff", allowRoles("Admin", "HR"), (req, res) => {
  const profile = { ...req.body, staff_id: req.body.staff_id || `STF${String(staffProfiles.length + 1).padStart(3, "0")}` };
  staffProfiles.push(profile);
  addAudit(req.user.email, `Added staff record ${profile.staff_id}`, "HR");
  res.status(201).json(profile);
});

export default router;
