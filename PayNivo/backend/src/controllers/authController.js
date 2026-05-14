import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { demoUsers, publicUser } from "../data/demoUsers.js";

export async function login(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = demoUsers.find((item) => item.email.toLowerCase() === email);
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const safeUser = publicUser(user);
  const token = jwt.sign(safeUser, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h"
  });

  return res.json({ token, user: safeUser });
}

export function demoAccounts(_req, res) {
  res.json(demoUsers.map(publicUser));
}

export function profilePlaceholder(req, res) {
  res.json({
    user: req.user || null
  });
}
