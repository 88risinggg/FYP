const bcrypt = require("bcrypt");

const { pool } = require("../config/db");
const { findUserByEmail } = require("../models/authModel");
const challengeModel = require("../models/authChallengeModel");
const registrationModel = require("../models/registrationModel");
const challengeService = require("../services/authChallengeService");
const { sendAuthOtpEmail } = require("../services/emailService");
const { writeAuditLog, MODULE } = require("../services/auditService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function challengeError(res, result) {
  if (result.error === "BLOCKED") {
    return res.status(429).json({
      code: "OTP_BLOCKED",
      message: "Too many OTP requests or attempts. Registration is blocked for three hours.",
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
  return res.status(400).json({ code: "OTP_CHALLENGE_INVALID", message: "The registration challenge is no longer valid." });
}

function validateAdminDetails(body) {
  const {
    fullName,
    workEmail,
    password,
    confirmPassword,
    termsAccepted,
    privacyAccepted
  } = body;

  if (!fullName?.trim() || !EMAIL_PATTERN.test(String(workEmail || "").trim())) {
    return "Full name and a valid email are required.";
  }
  if (typeof password !== "string" || password.length < 8) {
    return "Password must contain at least eight characters.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  if (termsAccepted !== true || privacyAccepted !== true) {
    return "Terms and Privacy acceptance are required.";
  }
  return null;
}

async function getRegistrationStatus(_req, res) {
  try {
    const registrationAvailable = await registrationModel.isRegistrationAvailable();
    return res.json({ registrationAvailable });
  } catch (error) {
    return res.status(503).json({
      registrationAvailable: false,
      message: "Registration storage is not ready. Run the authentication migration."
    });
  }
}

async function startRegistration(req, res) {
  try {
    const validationError = validateAdminDetails(req.body);
    if (validationError) return res.status(400).json({ message: validationError });
    const workEmail = req.body.workEmail.trim().toLowerCase();
    if (await findUserByEmail(workEmail)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    const activeBlock = await challengeModel.findActiveBlock(workEmail, "registration");
    if (activeBlock) {
      return res.status(429).json({
        code: "OTP_BLOCKED",
        message: "Registration OTP requests are temporarily blocked.",
        blockedUntil: activeBlock.blockedUntil
      });
    }

    const acceptedAt = new Date();
    const pendingRegistrationId = await registrationModel.createPendingRegistration({
      fullName: req.body.fullName.trim(),
      workEmail,
      jobTitle: String(req.body.jobTitle || "Staff").trim(),
      passwordHash: await bcrypt.hash(req.body.password, 12),
      termsAcceptedAt: acceptedAt,
      privacyAcceptedAt: acceptedAt
    });
    const challenge = await challengeService.createChallenge({
      email: workEmail,
      purpose: "registration",
      pendingRegistrationId
    });
    await sendAuthOtpEmail({ to: workEmail, otp: challenge.otp, purpose: "registration" });

    return res.status(202).json({
      challengeId: challenge.challengeId,
      email: workEmail,
      expiresAt: challenge.expiresAt
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration could not be started." });
  }
}

async function verifyEmail(req, res) {
  try {
    const { challengeId, otp } = req.body;
    if (!challengeId || !otp) return res.status(400).json({ message: "Challenge ID and OTP are required." });

    const result = await challengeService.verifyChallenge(challengeId, otp, "registration");
    if (result.error) return challengeError(res, result);
    const marked = await registrationModel.markEmailVerified(result.challenge.pendingRegistrationId);
    if (!marked) return res.status(409).json({ message: "This registration can no longer be completed." });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const pending = await registrationModel.findPendingById(result.challenge.pendingRegistrationId, connection);
      if (!pending?.emailVerifiedAt || pending.consumedAt) {
        await connection.rollback();
        return res.status(409).json({ message: "This registration can no longer be completed." });
      }
      if (await findUserByEmail(pending.workEmail)) {
        await connection.rollback();
        return res.status(409).json({ message: "An account with this email already exists." });
      }

      const [userResult] = await connection.execute(
        `INSERT INTO user (
          name, email, password, role_name, status, job_title, email_verified_at, created_at
        ) VALUES (?, ?, ?, 'Staff', 1, ?, NOW(), NOW())`,
        [pending.fullName, pending.workEmail, pending.passwordHash, pending.jobTitle || "Staff"]
      );
      await registrationModel.consumePendingRegistration(pending.pendingRegistrationId, connection);
      try {
        await writeAuditLog(connection, "User registered with email OTP", "Registration", userResult.insertId, userResult.insertId, {
          module: MODULE.AUTH,
          userName: pending.fullName,
          ipAddress: req.ip || null,
          entityType: "User"
        });
      } catch (_auditError) {
        // Registration should not fail if audit storage is temporarily unavailable.
      }
      await connection.commit();
      return res.status(201).json({
        message: "Email verified. Your account has been created. Please log in."
      });
    } catch (error) {
      await connection.rollback();
      return res.status(500).json({ message: "Account could not be created after verification." });
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ message: "Email verification failed." });
  }
}

async function resendRegistrationOtp(req, res) {
  try {
    const { challengeId } = req.body;
    if (!challengeId) return res.status(400).json({ message: "Challenge ID is required." });
    const result = await challengeService.resendChallenge(challengeId, "registration");
    if (result.error) return challengeError(res, result);
    await sendAuthOtpEmail({ to: result.challenge.email, otp: result.otp, purpose: "registration" });
    return res.json({ message: "A new verification code was sent.", expiresAt: result.expiresAt });
  } catch (error) {
    return res.status(500).json({ message: "The verification code could not be resent." });
  }
}

module.exports = {
  getRegistrationStatus,
  resendRegistrationOtp,
  startRegistration,
  verifyEmail
};
