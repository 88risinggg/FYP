import express from "express";
import jwt from "jsonwebtoken";
import { demoUsers } from "../data.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.post("/login", (req, res) => {
  const { email } = req.body;
  const user = demoUsers.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user) return res.status(401).json({ message: "Invalid demo account" });
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, staffId: user.staffId },
    process.env.JWT_SECRET || "paynivo_demo_secret",
    { expiresIn: "8h" }
  );
  addAudit(user.email, "Login", "Authentication");
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, staffId: user.staffId } });
});

export default router;
