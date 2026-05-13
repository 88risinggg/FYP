import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("HR"), (_req, res) => {
  res.json({
    role: "HR",
    message: "HR dashboard placeholder. Add staff profile and payroll preparation endpoints here."
  });
});

export default router;
