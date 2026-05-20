import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { demoUsers, publicUser } from "../data/demoUsers.js";

const router = Router();

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = demoUsers.find((item) => item.email.toLowerCase() === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const safeUser = publicUser(user);
  const token = jwt.sign(safeUser, process.env.JWT_SECRET || "dev_secret", { expiresIn: "8h" });
  return res.json({ token, user: safeUser });
});

export default router;
