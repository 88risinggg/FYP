import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Authentication required." });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
