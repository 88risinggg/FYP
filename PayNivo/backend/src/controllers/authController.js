import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { demoUsers, publicUser } from "../data/demoUsers.js";

export async function login(req, res) {
  const { email, password } = req.body;
  const user = demoUsers.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const passwordMatches = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const safeUser = publicUser(user);
  const token = jwt.sign(safeUser, process.env.JWT_SECRET || "dev_secret", { expiresIn: "8h" });

  res.json({ token, user: safeUser });
}

export function profilePlaceholder(req, res) {
  res.json({
    user: req.user || null
  });
}
