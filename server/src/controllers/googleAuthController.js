/**
 * Google OAuth2 Authentication Controller
 *
 * Implements Google Sign-In using the Authorization Code flow.
 * After the user authenticates with Google, we exchange the code for tokens,
 * verify the ID token, find/create a local user, and issue a local JWT.
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback";

// In-memory state store to prevent CSRF (use Redis in production)
const pendingStates = new Map();

/**
 * GET /api/auth/google/login
 *
 * Initiates Google OAuth2 login flow.
 * Returns a redirect URL for the frontend to navigate to.
 */
async function googleLogin(req, res) {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ message: "Google OAuth not configured." });
    }

    const state = crypto.randomBytes(32).toString("hex");
    pendingStates.set(state, { createdAt: Date.now() });

    // Clean up states older than 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of pendingStates) {
      if (val.createdAt < tenMinutesAgo) pendingStates.delete(key);
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "select_account"
    });

    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ redirectUrl });
  } catch (error) {
    console.error("[Google] Login initiation failed:", error);
    res.status(500).json({ message: "Failed to initiate Google login." });
  }
}

/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth2 callback.
 * Exchanges the authorization code for tokens, verifies the ID token,
 * finds or creates a local user, and redirects back to the client with a JWT.
 */
async function googleCallback(req, res) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${clientUrl}/login?error=google_denied`);
    }

    if (!state || !pendingStates.has(state)) {
      return res.redirect(`${clientUrl}/login?error=invalid_state`);
    }
    pendingStates.delete(state);

    if (!code) {
      return res.redirect(`${clientUrl}/login?error=no_code`);
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.id_token) {
      console.error("[Google] Token exchange failed:", tokenData);
      return res.redirect(`${clientUrl}/login?error=google_token_failed`);
    }

    // Verify ID token by fetching user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok || !userInfo.sub) {
      console.error("[Google] UserInfo fetch failed:", userInfo);
      return res.redirect(`${clientUrl}/login?error=google_userinfo_failed`);
    }

    // Find or create local user
    const localUser = await findOrCreateGoogleUser(userInfo);

    // Issue local JWT
    if (!(Number(localUser.status) === 1)) {
      return res.redirect(`${clientUrl}/login?error=account_disabled`);
    }
    if (Number(localUser.must_change_password) === 1) {
      return res.redirect(`${clientUrl}/login?error=password_setup_required`);
    }

    const token = jwt.sign(
      { userId: localUser.user_id, email: localUser.email, role: localUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    // Redirect back to frontend with token
    res.redirect(`${clientUrl}/login?google_token=${token}&user=${encodeURIComponent(JSON.stringify({
      userId: localUser.user_id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.role
    }))}`);
  } catch (error) {
    console.error("[Google] Callback error:", error);
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
}

/**
 * Find existing user by Google sub or email, or create a new one.
 */
async function findOrCreateGoogleUser(googleUser) {
  const { sub, email, name, picture } = googleUser;

  // Check if user already linked to this Google account
  const [existing] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.status, u.must_change_password, u.role_name AS role
     FROM user u
     WHERE u.google_sub = ?
     LIMIT 1`,
    [sub]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // Try to match existing user by email
  if (email) {
    const [byEmail] = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.status, u.must_change_password, u.role_name AS role
       FROM user u
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (byEmail.length > 0) {
      // Link Google sub to existing user
      await pool.query("UPDATE user SET google_sub = ? WHERE user_id = ?", [sub, byEmail[0].user_id]);
      return byEmail[0];
    }
  }

  // Create new user with Staff role
  const displayName = name || "Google User";
  const userEmail = email || `${sub.substring(0, 8)}@google.local`;

  const [result] = await pool.query(
    `INSERT INTO user (name, email, password, role_name, status, google_sub)
     VALUES (?, ?, ?, 'Staff', 1, ?)`,
    [displayName, userEmail, "", sub]
  );

  return {
    user_id: result.insertId,
    name: displayName,
    email: userEmail,
    role: "Staff"
  };
}

module.exports = {
  googleLogin,
  googleCallback
};
