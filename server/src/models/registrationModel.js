/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Reads and writes registration Model data in the database.
 * LAYER: Backend model - contains database queries and persistence operations.
 * FIND RELATED CODE: Use Find All References to locate the controller/service that requests this data.
 */
const crypto = require("crypto");
const { pool } = require("../config/db");

async function isRegistrationAvailable() {
  return true;
}

async function findPendingById(pendingRegistrationId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT
      pending_registration_id AS pendingRegistrationId,
      full_name AS fullName,
      work_email AS workEmail,
      job_title AS jobTitle,
      password_hash AS passwordHash,
      terms_accepted_at AS termsAcceptedAt,
      privacy_accepted_at AS privacyAcceptedAt,
      email_verified_at AS emailVerifiedAt,
      consumed_at AS consumedAt
     FROM pending_registrations
     WHERE pending_registration_id = ?`,
    [pendingRegistrationId]
  );
  return rows[0] || null;
}

async function createPendingRegistration({
  fullName,
  workEmail,
  jobTitle,
  passwordHash,
  termsAcceptedAt,
  privacyAcceptedAt
}) {
  const pendingRegistrationId = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO pending_registrations (
      pending_registration_id, full_name, work_email, job_title, password_hash,
      terms_accepted_at, privacy_accepted_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      pendingRegistrationId,
      fullName,
      workEmail,
      jobTitle,
      passwordHash,
      termsAcceptedAt,
      privacyAcceptedAt
    ]
  );
  return pendingRegistrationId;
}

async function markEmailVerified(pendingRegistrationId) {
  const [result] = await pool.execute(
    `UPDATE pending_registrations
     SET email_verified_at = COALESCE(email_verified_at, NOW())
     WHERE pending_registration_id = ? AND consumed_at IS NULL`,
    [pendingRegistrationId]
  );
  return result.affectedRows === 1;
}

async function consumePendingRegistration(pendingRegistrationId, connection = pool) {
  const [result] = await connection.execute(
    `UPDATE pending_registrations
     SET consumed_at = NOW()
     WHERE pending_registration_id = ? AND consumed_at IS NULL`,
    [pendingRegistrationId]
  );
  return result.affectedRows === 1;
}

module.exports = {
  consumePendingRegistration,
  createPendingRegistration,
  findPendingById,
  isRegistrationAvailable,
  markEmailVerified
};
