import { Router } from "express";
import { loginPlaceholder, profilePlaceholder } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", loginPlaceholder);
router.get("/me", requireAuth, profilePlaceholder);

export default router;
