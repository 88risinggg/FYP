const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { findUserByEmail } = require("../models/authModel");

function getAllowedModules(roleName) {
  const modulesByRole = {
    Admin: ["invoicing", "payroll"],
    Finance: ["invoicing", "payroll"],
    HR: ["payroll"],
    Staff: ["payroll"]
  };

  return modulesByRole[roleName] || [];
}

function isActiveStatus(status) {
  return status === 1 || status === true || status === "1" || status === "active";
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    const user = await findUserByEmail(email.trim().toLowerCase());

    if (!user || !isActiveStatus(user.status)) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const payload = {
      userId: user.user_id,
      email: user.email,
      role: user.role_name
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    });

    res.json({
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role_name,
        allowedModules: getAllowedModules(user.role_name)
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed. Please try again later."
    });
  }
}

module.exports = {
  login
};

