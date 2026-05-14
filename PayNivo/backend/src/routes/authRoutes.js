import { Router } from "express";
import { demoAccounts, login, profilePlaceholder } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.get("/demo-accounts", demoAccounts);
router.get("/me", requireAuth, profilePlaceholder);

export default router;
