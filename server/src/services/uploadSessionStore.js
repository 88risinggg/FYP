/**
 * EVALUATION HEADER
 * FEATURE: SECURITY / ACCESS
 * PURPOSE: Provides reusable upload Session Store business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
const crypto = require("crypto");
const { currentCompanyId } = require("./tenantContext");

class UploadSessionStore {
  /**
   * @param {number} ttlMs - Time-to-live for sessions in milliseconds (default: 30 minutes)
   */
  constructor(ttlMs = 30 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.sessions = new Map();

    // Run cleanup every 5 minutes to remove expired sessions
    this._cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    // Allow the timer to not block Node.js process exit
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  /**
   * Store a validation result and associate it with a user.
   * @param {Object} validationResult - The validated upload data
   * @param {string} userId - The ID/email of the uploading user
   * @returns {string} The generated session ID (UUID)
   */
  create(validationResult, userId) {
    const sessionId = crypto.randomUUID();

    this.sessions.set(sessionId, {
      validationResult,
      userId,
      companyId: currentCompanyId(),
      createdAt: Date.now(),
    });

    return sessionId;
  }

  /**
   * Retrieve session data by ID. Returns null if the session is expired,
   * does not exist, or belongs to a different user (without revealing which case).
   * @param {string} sessionId - The session identifier
   * @param {string} userId - The requesting user's ID/email
   * @returns {Object|null} The stored validation result, or null
   */
  get(sessionId, userId) {
    const session = this.sessions.get(sessionId);

    // Return null for non-existent sessions
    if (!session) {
      return null;
    }

    // Check TTL expiry
    if (Date.now() - session.createdAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Check user ownership — return null without revealing whether session exists
    if (session.userId !== userId || Number(session.companyId) !== currentCompanyId()) {
      return null;
    }

    return session.validationResult;
  }

  /**
   * Remove a session from the store (e.g., after commit completes).
   * @param {string} sessionId - The session identifier to remove
   */
  delete(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up all expired sessions from memory.
   */
  cleanup() {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions) {
      if (now - session.createdAt > this.ttlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Export singleton instance
const uploadSessionStore = new UploadSessionStore();

module.exports = uploadSessionStore;
module.exports.UploadSessionStore = UploadSessionStore;
