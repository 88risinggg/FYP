/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Provides reusable auth Challenge Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const crypto = require("crypto");

const challengeModel = require("../models/authChallengeModel");

const OTP_TTL_MS = 60 * 1000;
const BLOCK_MS = 3 * 60 * 60 * 1000;
const MAX_RESENDS = 2;
const MAX_ATTEMPTS = 5;

function createOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

function hashOtp(challengeId, otp) {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("OTP_HASH_SECRET or JWT_SECRET must be configured");
  }
  return crypto.createHmac("sha256", secret).update(`${challengeId}:${otp}`).digest("hex");
}

function matchesOtp(challengeId, otp, expectedHash) {
  const actual = Buffer.from(hashOtp(challengeId, otp), "hex");
  const expected = Buffer.from(expectedHash || "", "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function expiryDate() {
  return new Date(Date.now() + OTP_TTL_MS);
}

function blockDate() {
  return new Date(Date.now() + BLOCK_MS);
}

async function createChallenge({ email, purpose, userId, pendingRegistrationId }) {
  const challengeId = crypto.randomUUID();
  const otp = createOtp();
  const expiresAt = expiryDate();
  await challengeModel.createChallenge({
    challengeId,
    email,
    purpose,
    userId,
    pendingRegistrationId,
    expiresAt,
    otpHash: hashOtp(challengeId, otp)
  });
  return { challengeId, otp, expiresAt };
}

async function resendChallenge(challengeId, expectedPurpose) {
  const challenge = await challengeModel.findChallenge(challengeId);
  if (!challenge || challenge.purpose !== expectedPurpose || challenge.consumedAt) {
    return { error: "INVALID_CHALLENGE" };
  }
  if (challenge.blockedUntil && new Date(challenge.blockedUntil) > new Date()) {
    return { error: "BLOCKED", blockedUntil: challenge.blockedUntil };
  }
  if (Number(challenge.resendCount) >= MAX_RESENDS) {
    const blockedUntil = blockDate();
    await challengeModel.blockChallenge(challengeId, blockedUntil);
    return { error: "BLOCKED", blockedUntil };
  }

  const otp = createOtp();
  const expiresAt = expiryDate();
  await challengeModel.replaceOtp(challengeId, hashOtp(challengeId, otp), expiresAt);
  return { challenge, otp, expiresAt };
}

async function verifyChallenge(challengeId, otp, expectedPurpose) {
  const challenge = await challengeModel.findChallenge(challengeId);
  if (!challenge || challenge.purpose !== expectedPurpose || challenge.consumedAt) {
    return { error: "INVALID_CHALLENGE" };
  }
  if (challenge.blockedUntil && new Date(challenge.blockedUntil) > new Date()) {
    return { error: "BLOCKED", blockedUntil: challenge.blockedUntil };
  }
  if (new Date(challenge.expiresAt) <= new Date()) {
    return { error: "EXPIRED" };
  }
  if (!/^\d{6}$/.test(String(otp || "")) || !matchesOtp(challengeId, String(otp), challenge.otpHash)) {
    const attempts = Number(challenge.attemptCount) + 1;
    await challengeModel.incrementAttempts(challengeId);
    if (attempts >= MAX_ATTEMPTS) {
      const blockedUntil = blockDate();
      await challengeModel.blockChallenge(challengeId, blockedUntil);
      return { error: "BLOCKED", blockedUntil };
    }
    return { error: "INVALID_OTP", attemptsRemaining: MAX_ATTEMPTS - attempts };
  }

  const consumed = await challengeModel.consumeChallenge(challengeId);
  return consumed ? { challenge } : { error: "INVALID_CHALLENGE" };
}

module.exports = {
  MAX_ATTEMPTS,
  MAX_RESENDS,
  createChallenge,
  resendChallenge,
  verifyChallenge
};
