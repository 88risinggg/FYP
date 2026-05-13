import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("Finance"), (_req, res) => {
  res.json({
    role: "Finance",
    message: "Finance dashboard placeholder. Add invoice, payment, and reporting endpoints here."
  });
});

export default router;
