/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Handles OTP Auth Controller API requests, validation, status codes, and responses.
 * LAYER: Backend controller - validates HTTP input and returns the API response.
 * FIND RELATED CODE: Follow service/model calls to find business rules and database work.
 */
/**
 * Email OTP Authentication Controller
 *
 * Implements passwordless login via email OTP:
 * 1. User submits their email
 * 2. Server generates a 6-digit OTP, stores it, and emails it
 * 3. User submits the OTP
 * 4. Server verifies and issues a JWT
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const { sendEmail } = require("../services/emailTransportService");

// In-memory OTP store: email -> { otp, expiresAt, attempts }
const pendingOtps = new Map();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

/**
 * POST /api/auth/otp/request
 *
 * Generates and sends an OTP to the provided email.
 * Request body: { email }
 */
async function requestOtp(req, res) {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP
    pendingOtps.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    // Clean up expired OTPs
    for (const [key, val] of pendingOtps) {
      if (val.expiresAt < Date.now()) pendingOtps.delete(key);
    }

    // Send email
    const companyName = process.env.COMPANY_NAME || "PayNivo";

    await sendEmail({
      to: normalizedEmail,
      subject: `${companyName} - Your Login Code`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <h2 style="color: #1a1a2e; margin: 0 0 16px;">Your Login Code</h2>
          <p style="color: #555; margin: 0 0 24px;">Use the code below to sign in to ${companyName}:</p>
          <div style="background: #1a1a2e; color: #fff; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #888; font-size: 13px; margin: 24px 0 0;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `
    });

    res.json({ message: "OTP sent to your email.", email: normalizedEmail });
  } catch (error) {
    console.error("[OTP] Request error:", error);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
}

/**
 * POST /api/auth/otp/verify
 *
 * Verifies the OTP and issues a JWT.
 * Request body: { email, otp }
 */
async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const session = pendingOtps.get(normalizedEmail);

    if (!session) {
      return res.status(401).json({ message: "No OTP found. Please request a new one." });
    }

    // Check expiry
    if (session.expiresAt < Date.now()) {
      pendingOtps.delete(normalizedEmail);
      return res.status(401).json({ message: "OTP expired. Please request a new one." });
    }

    // Check attempts
    session.attempts += 1;
    if (session.attempts > MAX_ATTEMPTS) {
      pendingOtps.delete(normalizedEmail);
      return res.status(401).json({ message: "Too many attempts. Please request a new OTP." });
    }

    // Verify OTP
    if (session.otp !== otp.trim()) {
      return res.status(401).json({ message: `Invalid OTP. ${MAX_ATTEMPTS - session.attempts} attempts remaining.` });
    }

    // OTP verified — clean up
    pendingOtps.delete(normalizedEmail);

    // Find or create user
    const localUser = await findOrCreateOtpUser(normalizedEmail);

    if (localUser.account_locked_at) {
      return res.status(423).json({ code: "ACCOUNT_LOCKED", message: "This account is locked. Contact an administrator to reactivate it." });
    }
    if (!(Number(localUser.status) === 1)) {
      return res.status(403).json({ message: "This account is awaiting activation or has been disabled." });
    }
    if (Number(localUser.must_change_password) === 1) {
      return res.status(403).json({ message: "Use the temporary password supplied by HR to create your permanent password first." });
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: localUser.user_id, email: localUser.email, role: localUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    res.json({
      token,
      user: {
        userId: localUser.user_id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role
      }
    });
  } catch (error) {
    console.error("[OTP] Verify error:", error);
    res.status(500).json({ message: "OTP verification failed." });
  }
}

/**
 * Find existing user by email or create a new one.
 * Uses the role_name column directly on the user table (no separate role table).
 */
async function findOrCreateOtpUser(email) {
  // Check if user exists
  const [existing] = await pool.query(
    `SELECT user_id, name, email, status, must_change_password, account_locked_at, role_name AS role
     FROM user
     WHERE email = ?
     LIMIT 1`,
    [email]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new user with Staff role
  const displayName = email.split("@")[0];

  const [result] = await pool.query(
    `INSERT INTO user (name, email, password, role_name, status, created_at)
     VALUES (?, ?, '', 'Staff', 1, NOW())`,
    [displayName, email]
  );

  return {
    user_id: result.insertId,
    name: displayName,
    email,
    role: "Staff"
  };
}

module.exports = {
  requestOtp,
  verifyOtp
};
