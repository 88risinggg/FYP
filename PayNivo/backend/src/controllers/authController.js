import jwt from "jsonwebtoken";

const demoUsers = [
  { email: "admin@paynivo.com", password: "password", role: "Admin", name: "Alicia Admin" },
  { email: "finance@paynivo.com", password: "password", role: "Finance", name: "Farid Finance" },
  { email: "hr@paynivo.com", password: "password", role: "HR", name: "Hana HR" },
  { email: "staff@paynivo.com", password: "password", role: "Staff", name: "Siti Staff", staffId: "STF001" }
];

export function loginPlaceholder(req, res) {
  const { email, password } = req.body || {};
  const user = demoUsers.find((item) => item.email === email && item.password === password);

  if (!user) {
    return res.status(401).json({ message: "Invalid demo credentials" });
  }

  const token = jwt.sign(
    {
      email: user.email,
      role: user.role,
      name: user.name,
      staffId: user.staffId || null
    },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );

  return res.json({
    token,
    user: {
      email: user.email,
      role: user.role,
      name: user.name,
      staffId: user.staffId || null
    }
  });
}

export function profilePlaceholder(req, res) {
  res.json({
    message: "Authenticated profile placeholder.",
    user: req.user || null
  });
}
