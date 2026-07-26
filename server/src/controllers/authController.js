/**
 * Authentication Controller
 *
 * Handles email/password login and JWT issuance.
 * Implements role-based module access control.
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const {
  completeFirstLogin: saveFirstLoginPassword,
  findUserByEmail,
  findUserById,
  recordFailedLogin,
  resetFailedLogins
} = require("../models/authModel");
const challengeService = require("../services/authChallengeService");
const { sendAuthOtpEmail } = require("../services/emailService");
const { notifyRoles } = require("../services/payrollNotificationService");
const { writeAuditLog, MODULE } = require("../services/auditService");
const settingsModel = require("../models/settingsModel");
const { runWithTenant } = require("../services/tenantContext");

const LOGIN_FAILURE_LIMIT = 5;

const OTP_EXEMPT_EMAILS = new Set([
  "kingtoh@vaniday.com",
  "amanda.lim@vaniday.com",
  "daniel.tan@vaniday.com",
  "chloe.wong@vaniday.com",
  "admin@paynivo.com",
  "finance@paynivo.com",
  "hr@paynivo.com",
  "staff@paynivo.com",
  "operator@paynivo.com"
]);

function requiresLoginOtp(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  return Number(user?.two_fa_enabled) === 1
    && user?.two_fa_method === "Email OTP"
    && !OTP_EXEMPT_EMAILS.has(email);
}

function lockedResponse(res) {
  return res.status(423).json({
    code: "ACCOUNT_LOCKED",
    message: "This account is locked. Contact an administrator to reactivate it."
  });
}

/**
 * Determine which application modules a user role can access.
 * Admin and Finance can access both invoicing and payroll.
 * HR and Staff can only access payroll.
 *
 * @param {string} roleName - The role name (Admin, Finance, HR, Staff).
 * @returns {string[]} Array of allowed module names.
 */
function getAllowedModules(roleName) {
  const modulesByRole = {
    Admin: ["invoicing", "payroll"],
    Finance: ["invoicing", "payroll"],
    HR: ["payroll"],
    Staff: ["payroll"]
    ,PlatformOperator: ["platform"]
  };

  return modulesByRole[roleName] || [];
}

/**
 * Check if a user's account status is active.
 * Handles different representations of active status (1, true, "1", "active").
 *
 * @param {*} status - The status value from the database.
 * @returns {boolean} True if user is active.
 */
function isActiveStatus(status) {
  if (typeof status === "string") {
    return status.toLowerCase() === "active" || status === "1";
  }
  return status === 1 || status === true;
}

function normalToken(user, sessionId = null) {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      role: user.role_name,
      companyId: user.company_id || null,
      ...(sessionId ? { sessionId } : {})
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

function authPayload(user, sessionId = null) {
  return {
    token: normalToken(user, sessionId),
    user: {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role_name,
      companyId: user.company_id || null,
      company: user.company_id ? {
        workspaceId: user.workspace_id,
        name: user.company_name,
        legalName: user.company_legal_name || user.company_name,
        logoUrl: user.company_logo && user.workspace_id ? `/api/company/branding/${user.workspace_id}/logo` : null,
        brandColor: user.company_brand_color || "#F38978",
        timezone: user.company_timezone || "Asia/Singapore",
        currency: user.company_currency || "SGD"
      } : null,
      allowedModules: getAllowedModules(user.role_name)
    }
  };
}

function describeClient(req) {
  const agent = String(req.get("user-agent") || "");
  const browser = /Edg\//i.test(agent) ? "Microsoft Edge" : /Chrome\//i.test(agent) ? "Chrome" : /Firefox\//i.test(agent) ? "Firefox" : /Safari\//i.test(agent) ? "Safari" : "Unknown browser";
  const os = /Windows/i.test(agent) ? "Windows" : /Android/i.test(agent) ? "Android" : /iPhone|iPad/i.test(agent) ? "iOS" : /Mac OS/i.test(agent) ? "macOS" : /Linux/i.test(agent) ? "Linux" : "Unknown OS";
  const device = /Mobile|Android|iPhone|iPad/i.test(agent) ? "Mobile device" : "Desktop device";
  return { browser, os, device };
}

async function authenticatedPayload(user, req) {
  const sessionId = randomUUID();
  if (user.company_id) {
    try {
      await runWithTenant(user.company_id, () => settingsModel.createLoginSession(user.user_id, {
        session_id: sessionId,
        ...describeClient(req),
        ip_address: req.ip || null,
        location: "Singapore",
        is_current: true
      }));
    } catch (error) {
      // Session history must never make a valid account unable to sign in.
      console.error("Unable to record login session:", error.message);
      return authPayload(user);
    }
  }
  return authPayload(user, sessionId);
}

function buildUserResponse(user) {
  return {
    userId: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role_name,
    companyId: user.company_id || null,
    company: user.company_id ? { workspaceId: user.workspace_id, name: user.company_name, legalName: user.company_legal_name || user.company_name, logoUrl: user.company_logo && user.workspace_id ? `/api/company/branding/${user.workspace_id}/logo` : null, brandColor: user.company_brand_color || "#F38978", timezone: user.company_timezone || "Asia/Singapore", currency: user.company_currency || "SGD" } : null,
    allowedModules: getAllowedModules(user.role_name)
  };
}

function issueJwt(user) {
  return normalToken(user);
}

function challengeError(res, result) {
  if (result.error === "BLOCKED") {
    return res.status(429).json({
      code: "OTP_BLOCKED",
      message: "Too many OTP requests or attempts. Login verification is blocked for three hours.",
      blockedUntil: result.blockedUntil
    });
  }
  if (result.error === "EXPIRED") {
    return res.status(410).json({ code: "OTP_EXPIRED", message: "The OTP has expired. Request a new code." });
  }
  if (result.error === "INVALID_OTP") {
    return res.status(401).json({
      code: "OTP_INVALID",
      message: "The OTP is incorrect.",
      attemptsRemaining: result.attemptsRemaining
    });
  }
  return res.status(400).json({ code: "OTP_CHALLENGE_INVALID", message: "The login challenge is no longer valid." });
}

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Validates credentials against bcrypt-hashed password in database.
 * Issues the final JWT immediately after password verification.
 *
 * Request body: { email: string, password: string }
 * Success response: { token, user }
 * Error responses: 400 (missing fields), 401 (invalid credentials), 500 (server error)
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    // Look up user by email in database
    const user = await findUserByEmail(email.trim().toLowerCase());

    // Check user exists and account is active
    if (!user || !isActiveStatus(user.status)) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    if (user.account_locked_at) return lockedResponse(res);

    // Verify password against bcrypt hash
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      const failure = await recordFailedLogin(user.user_id, LOGIN_FAILURE_LIMIT);
      if (failure.newlyLocked) {
        await notifyRoles("Admin", {
          companyId: user.company_id,
          type: "security_account_locked",
          title: "User account locked",
          message: `${user.name} (${user.email}) was locked at ${new Date().toISOString()} after ${LOGIN_FAILURE_LIMIT} failed password attempts.`,
          actionPath: "/dashboard/payroll/admin/user-management",
          entityType: "user",
          entityId: user.user_id,
          metadata: { userId: user.user_id, lockedAt: new Date().toISOString(), reason: "Too many failed password attempts" }
        }).catch((notificationError) => {
          console.error("Unable to deliver account lock notification:", notificationError.message);
        });
        return lockedResponse(res);
      }
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    await resetFailedLogins(user.user_id);

    if (Number(user.must_change_password) === 1) {
      const setupToken = jwt.sign(
        { userId: user.user_id, purpose: "first_login_password" },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      return res.json({ requiresPasswordChange: true, setupToken, email: user.email });
    }

    if (requiresLoginOtp(user)) {
      const challenge = await challengeService.createChallenge({
        email: user.email,
        purpose: "login",
        userId: user.user_id
      });
      await sendAuthOtpEmail({ to: user.email, otp: challenge.otp, purpose: "login" });
      return res.json({
        requiresTwoFactor: true,
        challengeId: challenge.challengeId,
        expiresAt: challenge.expiresAt,
        maskedEmail: user.email.replace(/^(.{1,2}).*(@.*)$/, "$1***$2")
      });
    }

    return res.json(await authenticatedPayload(user, req));
  } catch (error) {
    res.status(500).json({
      message: "Login failed. Please try again later."
    });
  }
}

async function completeFirstLogin(req, res) {
  try {
    const setupToken = String(req.body.setupToken || "");
    const newPassword = String(req.body.newPassword || "");
    const termsAccepted = req.body.termsAccepted === true;
    const privacyAccepted = req.body.privacyAccepted === true;
    if (!setupToken || newPassword.length < 8 || !termsAccepted || !privacyAccepted) {
      return res.status(400).json({
        message: "A valid setup link, password of at least 8 characters, and acceptance of the Terms and Privacy Policy are required."
      });
    }
    const payload = jwt.verify(setupToken, process.env.JWT_SECRET);
    if (payload.purpose !== "first_login_password") {
      return res.status(401).json({ message: "Invalid password setup token." });
    }
    const current = await findUserById(payload.userId);
    if (current?.account_locked_at) return lockedResponse(res);
    if (!current || !isActiveStatus(current.status) || Number(current.must_change_password) !== 1) {
      return res.status(409).json({ message: "Password setup is no longer available for this account." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const user = await saveFirstLoginPassword(payload.userId, passwordHash);
    await writeAuditLog({
      module: MODULE.AUTH,
      activityType: "Legal Acceptance",
      action: "Accepted Terms and Privacy Policy during first account setup",
      entityId: payload.userId,
      entityType: "user",
      userId: payload.userId,
      ipAddress: req.ip || null,
      newValue: JSON.stringify({
        termsAcceptedAt: new Date().toISOString(),
        privacyAcceptedAt: new Date().toISOString()
      })
    });
    return res.json(await authenticatedPayload(user, req));
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Password setup link has expired. Sign in again with the temporary password." });
    }
    return res.status(500).json({ message: "Unable to complete password setup." });
  }
}

async function verifyLoginOtp(req, res) {
  try {
    const { challengeId, otp } = req.body;
    if (!challengeId || !otp) {
      return res.status(400).json({ message: "Challenge ID and OTP are required." });
    }
    const result = await challengeService.verifyChallenge(challengeId, otp, "login");
    if (result.error) return challengeError(res, result);
    const user = await findUserById(result.challenge.userId);
    if (!user || !isActiveStatus(user.status) || user.account_locked_at) {
      return res.status(401).json({ message: "This account is no longer available." });
    }
    return res.json(await authenticatedPayload(user, req));
  } catch (error) {
    return res.status(500).json({ message: "Login verification failed. Please try again later." });
  }
}

async function resendLoginOtp(req, res) {
  try {
    const { challengeId } = req.body;
    if (!challengeId) return res.status(400).json({ message: "Challenge ID is required." });
    const result = await challengeService.resendChallenge(challengeId, "login");
    if (result.error) return challengeError(res, result);
    await sendAuthOtpEmail({ to: result.challenge.email, otp: result.otp, purpose: "login" });
    return res.json({ message: "A new login code was sent.", expiresAt: result.expiresAt });
  } catch (error) {
    return res.status(500).json({ message: "The login code could not be resent." });
  }
}

module.exports = {
  completeFirstLogin,
  buildUserResponse,
  getAllowedModules,
  issueJwt,
  login,
  resendLoginOtp,
  verifyLoginOtp
};
