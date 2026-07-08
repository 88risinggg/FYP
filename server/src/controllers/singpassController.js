/**
 * Singpass OIDC Authentication Controller
 *
 * Implements Singpass login using openid-client library with:
 * - PKCE (Proof Key for Code Exchange)
 * - DPoP (Demonstration of Proof-of-Possession)
 * - PAR (Pushed Authorization Request)
 *
 * Based on: https://github.com/singpass/demo-app
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const singpassConfig = require("../config/singpass");

// In-memory session store for PKCE state (use Redis in production)
const pendingSessions = new Map();

// Singpass OIDC client - initialized lazily
let oidcConfig = null;
let openidClient = null;
let publicSigningKey = null;
let privateSigningKey = null;
let privateEncryptionKey = null;

/**
 * Initialize the openid-client dynamically (ESM module).
 */
async function getOpenidClient() {
  if (openidClient) return openidClient;
  openidClient = await import("openid-client");
  return openidClient;
}

/**
 * Import crypto keys from JWK format.
 */
async function initializeKeys() {
  if (publicSigningKey) return;

  publicSigningKey = {
    kid: singpassConfig.KEYS.PUBLIC_SIG_KEY.kid,
    alg: singpassConfig.KEYS.PUBLIC_SIG_KEY.alg,
    key: await crypto.subtle.importKey(
      "jwk",
      singpassConfig.KEYS.PUBLIC_SIG_KEY,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    )
  };

  privateSigningKey = {
    kid: singpassConfig.KEYS.PRIVATE_SIG_KEY.kid,
    alg: singpassConfig.KEYS.PRIVATE_SIG_KEY.alg,
    key: await crypto.subtle.importKey(
      "jwk",
      singpassConfig.KEYS.PRIVATE_SIG_KEY,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    )
  };

  privateEncryptionKey = {
    kid: singpassConfig.KEYS.PRIVATE_ENC_KEY.kid,
    alg: singpassConfig.KEYS.PRIVATE_ENC_KEY.alg,
    key: await crypto.subtle.importKey(
      "jwk",
      singpassConfig.KEYS.PRIVATE_ENC_KEY,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey", "deriveBits"]
    )
  };
}

/**
 * Initialize Singpass OIDC discovery configuration.
 */
async function initializeSingpassOidc() {
  if (oidcConfig) return oidcConfig;

  const client = await getOpenidClient();
  await initializeKeys();

  oidcConfig = await client.discovery(
    new URL(singpassConfig.ISSUER_URL),
    singpassConfig.CLIENT_ID,
    undefined,
    client.PrivateKeyJwt(privateSigningKey)
  );

  client.enableDecryptingResponses(
    oidcConfig,
    ["A256GCM", "A256CBC-HS512"],
    privateEncryptionKey
  );

  return oidcConfig;
}

/**
 * Get DPoP handle for requests.
 */
function getDpopOptions(client, config) {
  return {
    DPoP: client.getDPoPHandle(
      config,
      { privateKey: privateSigningKey.key, publicKey: publicSigningKey.key },
      {
        [client.modifyAssertion]: (_header, payload) => {
          if (typeof payload.iat === "number") payload.exp = payload.iat + 120;
        }
      }
    )
  };
}

// Reinitialize OIDC config periodically (every hour)
setInterval(() => { oidcConfig = null; }, 60 * 60 * 1000);

/**
 * GET /api/auth/singpass/login
 *
 * Initiates the Singpass OIDC login flow.
 * Returns a redirect URL that the frontend should navigate to.
 */
async function singpassLogin(req, res) {
  try {
    const client = await getOpenidClient();
    const config = await initializeSingpassOidc();

    const code_verifier = client.randomPKCECodeVerifier();
    const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);
    const nonce = client.randomNonce();
    const state = client.randomState();

    // Store session data for callback verification
    pendingSessions.set(state, { code_verifier, nonce, state, createdAt: Date.now() });

    // Clean up old sessions (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, val] of pendingSessions) {
      if (val.createdAt < tenMinutesAgo) pendingSessions.delete(key);
    }

    // Build authorization URL using PAR
    const redirectTo = await client.buildAuthorizationUrlWithPAR(
      config,
      {
        redirect_uri: singpassConfig.REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge,
        nonce,
        state,
        scope: singpassConfig.SCOPES
      },
      getDpopOptions(client, config)
    );

    res.json({ redirectUrl: redirectTo.href });
  } catch (error) {
    console.error("[Singpass] Login initiation failed:", error);
    res.status(500).json({ message: "Failed to initiate Singpass login.", detail: error.message });
  }
}

/**
 * GET /api/auth/singpass/callback
 *
 * Handles the Singpass OIDC callback after user authenticates.
 * Exchanges the authorization code for tokens, retrieves user info,
 * and issues a local JWT token.
 *
 * Note: This is also mounted on port 3080 at /callback to match
 * the Singpass demo app's registered redirect URI.
 */
async function singpassCallback(req, res) {
  try {
    const client = await getOpenidClient();
    const config = await initializeSingpassOidc();

    // Reconstruct the callback URL using the registered redirect URI
    // Singpass expects the URL to match exactly what was registered
    const currentUrl = new URL(`${singpassConfig.REDIRECT_URI}${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`);

    // Get state from query params to find session
    const state = currentUrl.searchParams.get("state");
    const sessionData = pendingSessions.get(state);

    if (!sessionData) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=invalid_state`);
    }

    pendingSessions.delete(state);

    // Exchange authorization code for tokens
    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: sessionData.code_verifier,
        expectedNonce: sessionData.nonce,
        expectedState: sessionData.state,
        idTokenExpected: true
      },
      undefined,
      getDpopOptions(client, config)
    );

    const idTokenClaims = tokens.claims();
    if (!idTokenClaims) {
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=no_claims`);
    }

    console.log("[Singpass] ID Token claims:", JSON.stringify(idTokenClaims, null, 2));

    // Fetch user info (for Myinfo data like name, NRIC)
    let userInfo = {};
    try {
      userInfo = await client.fetchUserInfo(
        config,
        tokens.access_token,
        idTokenClaims.sub,
        getDpopOptions(client, config)
      );
      console.log("[Singpass] UserInfo:", JSON.stringify(userInfo, null, 2));
    } catch (uiError) {
      console.warn("[Singpass] UserInfo fetch failed (non-fatal):", uiError.message);
    }

    // The 'sub' claim contains the user's UUID from Singpass
    // The 'uinfin' scope provides the NRIC/FIN
    const singpassSub = idTokenClaims.sub;
    const nric = userInfo.uinfin || idTokenClaims.uinfin || null;
    const userName = userInfo.name || idTokenClaims.name || null;

    // Look up or create a local user based on Singpass sub
    let localUser = await findOrCreateSingpassUser(singpassSub, nric, userName);

    // Issue local JWT token
    const token = jwt.sign(
      { userId: localUser.user_id, email: localUser.email, role: localUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    // Redirect back to frontend with token
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${clientUrl}/login?singpass_token=${token}&user=${encodeURIComponent(JSON.stringify({
      userId: localUser.user_id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.role
    }))}`);
  } catch (error) {
    console.error("[Singpass] Callback error:", error);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${clientUrl}/login?error=singpass_failed`);
  }
}

/**
 * Find existing user by Singpass sub or create a new one.
 */
async function findOrCreateSingpassUser(singpassSub, nric, name) {
  // Check if user already linked to this Singpass sub
  const [existing] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.status, r.role_name AS role
     FROM user u
     JOIN role r ON r.role_id = u.role_id
     WHERE u.singpass_sub = ?
     LIMIT 1`,
    [singpassSub]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // If NRIC provided, try to match existing user by NRIC
  if (nric) {
    const [byNric] = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.status, r.role_name AS role
       FROM user u
       JOIN role r ON r.role_id = u.role_id
       WHERE u.nric = ?
       LIMIT 1`,
      [nric]
    );

    if (byNric.length > 0) {
      // Link Singpass sub to existing user
      await pool.query("UPDATE user SET singpass_sub = ? WHERE user_id = ?", [singpassSub, byNric[0].user_id]);
      return byNric[0];
    }
  }

  // Create new user with Staff role
  const [staffRole] = await pool.query("SELECT role_id FROM role WHERE role_name = 'Staff' LIMIT 1");
  const roleId = staffRole[0]?.role_id || 4;
  const email = nric ? `${nric.toLowerCase()}@singpass.local` : `${singpassSub.substring(0, 8)}@singpass.local`;
  const displayName = name || `Singpass User ${singpassSub.substring(0, 8)}`;

  const [result] = await pool.query(
    `INSERT INTO user (name, email, password, role_id, status, singpass_sub, nric)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [displayName, email, "", roleId, singpassSub, nric]
  );

  return {
    user_id: result.insertId,
    name: displayName,
    email,
    role: "Staff"
  };
}

/**
 * GET /api/auth/singpass/jwks
 *
 * Exposes the public keys for Singpass to verify our requests.
 */
function getJwks(req, res) {
  res.json({
    keys: [singpassConfig.KEYS.PUBLIC_SIG_KEY, singpassConfig.KEYS.PUBLIC_ENC_KEY]
  });
}

/**
 * POST /api/auth/singpass/demo
 *
 * Demo endpoint for FYP presentation.
 * Simulates a Singpass login by creating/finding a demo user
 * and issuing a JWT without actual Singpass authentication.
 */
async function singpassDemo(req, res) {
  try {
    const demoSub = "SINGPASS-DEMO-S1234567A";
    const demoNric = "S1234567A";
    const demoName = "Singpass Demo User";

    const localUser = await findOrCreateSingpassUser(demoSub, demoNric, demoName);

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
    console.error("[Singpass Demo] Error:", error);
    res.status(500).json({ message: "Singpass demo login failed." });
  }
}

module.exports = {
  singpassLogin,
  singpassCallback,
  singpassDemo,
  getJwks,
  startCallbackServer
};

/**
 * Start a separate Express listener on port 3080 to handle the Singpass callback.
 * The demo app credentials have `http://localhost:3080/callback` as the registered redirect URI.
 */
function startCallbackServer() {
  const callbackPort = singpassConfig.CALLBACK_PORT || 3080;
  if (!callbackPort) return;

  const express = require("express");
  const callbackApp = express();

  callbackApp.get("/callback", singpassCallback);
  callbackApp.get("/.well-known/jwks.json", getJwks);

  callbackApp.listen(callbackPort, () => {
    console.log(`Singpass callback server running on http://localhost:${callbackPort}`);
  });
}
