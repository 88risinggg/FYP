import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("Customer"), (_req, res) => {
  res.json({
    role: "Customer",
    message: "Customer dashboard placeholder. Add customer invoice and payment status endpoints here."
  });
});

export default router;
