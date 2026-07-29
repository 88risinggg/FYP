/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Reads and writes auth Challenge Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
const { pool } = require("../config/db");

async function createChallenge({
  challengeId,
  email,
  purpose,
  otpHash,
  userId = null,
  pendingRegistrationId = null,
  expiresAt
}) {
  await pool.execute(
    `INSERT INTO auth_challenges (
      challenge_id, email, purpose, otp_hash, user_id,
      pending_registration_id, expires_at, resend_count, attempt_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
    [challengeId, email, purpose, otpHash, userId, pendingRegistrationId, expiresAt]
  );
}

async function findChallenge(challengeId) {
  const [rows] = await pool.execute(
    `SELECT
      challenge_id AS challengeId,
      email,
      purpose,
      otp_hash AS otpHash,
      user_id AS userId,
      pending_registration_id AS pendingRegistrationId,
      expires_at AS expiresAt,
      resend_count AS resendCount,
      attempt_count AS attemptCount,
      blocked_until AS blockedUntil,
      consumed_at AS consumedAt
    FROM auth_challenges
    WHERE challenge_id = ?`,
    [challengeId]
  );
  return rows[0] || null;
}

async function findActiveBlock(email, purpose) {
  const [rows] = await pool.execute(
    `SELECT blocked_until AS blockedUntil
     FROM auth_challenges
     WHERE LOWER(email) = LOWER(?)
       AND purpose = ?
       AND blocked_until > NOW()
     ORDER BY blocked_until DESC
     LIMIT 1`,
    [email, purpose]
  );
  return rows[0] || null;
}

async function replaceOtp(challengeId, otpHash, expiresAt) {
  const [result] = await pool.execute(
    `UPDATE auth_challenges
     SET otp_hash = ?, expires_at = ?, resend_count = resend_count + 1,
         attempt_count = 0, updated_at = NOW()
     WHERE challenge_id = ? AND consumed_at IS NULL`,
    [otpHash, expiresAt, challengeId]
  );
  return result.affectedRows === 1;
}

async function incrementAttempts(challengeId) {
  await pool.execute(
    `UPDATE auth_challenges
     SET attempt_count = attempt_count + 1, updated_at = NOW()
     WHERE challenge_id = ? AND consumed_at IS NULL`,
    [challengeId]
  );
}

async function blockChallenge(challengeId, blockedUntil) {
  await pool.execute(
    `UPDATE auth_challenges
     SET blocked_until = ?, updated_at = NOW()
     WHERE challenge_id = ?`,
    [blockedUntil, challengeId]
  );
}

async function consumeChallenge(challengeId) {
  const [result] = await pool.execute(
    `UPDATE auth_challenges
     SET consumed_at = NOW(), updated_at = NOW()
     WHERE challenge_id = ?
       AND consumed_at IS NULL
       AND expires_at > NOW()
       AND (blocked_until IS NULL OR blocked_until <= NOW())`,
    [challengeId]
  );
  return result.affectedRows === 1;
}

module.exports = {
  blockChallenge,
  consumeChallenge,
  createChallenge,
  findActiveBlock,
  findChallenge,
  incrementAttempts,
  replaceOtp
};
