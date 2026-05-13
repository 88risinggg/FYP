import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("Admin"), (_req, res) => {
  res.json({
    role: "Admin",
    message: "Admin dashboard placeholder. Add user, role, rate config, and audit controls here."
  });
});

export default router;
