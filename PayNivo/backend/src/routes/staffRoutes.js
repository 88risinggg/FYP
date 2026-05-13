import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("Staff"), (_req, res) => {
  res.json({
    role: "Staff",
    message: "Staff dashboard placeholder. Add payslip and profile self-service endpoints here."
  });
});

export default router;
