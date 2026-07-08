/**
 * Telegram Login Authentication Controller
 *
 * Uses a polling-based approach that works without domain verification:
 * 1. Frontend requests a unique login token
 * 2. User opens bot in Telegram and sends the token
 * 3. Bot receives the token and links the Telegram user to the login session
 * 4. Frontend polls for completion and receives a JWT
 *
 * This avoids the Telegram Login Widget which requires a verified domain.
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

// Read at runtime to ensure dotenv has loaded
function getBotToken() { return process.env.TELEGRAM_BOT_TOKEN; }
function getBotName() { return process.env.TELEGRAM_BOT_NAME; }

// Pending login sessions: token -> { telegramUser, createdAt }
const pendingLogins = new Map();

// Track last Telegram update offset
let lastUpdateOffset = 0;
let pollingInterval = null;

/**
 * Start polling Telegram for bot messages (login codes).
 */
function startTelegramPolling() {
  if (!getBotToken() || pollingInterval) return;

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${getBotToken()}/getUpdates?offset=${lastUpdateOffset}&timeout=0&allowed_updates=["message"]`
      );
      const data = await response.json();

      if (!data.ok || !data.result?.length) return;

      for (const update of data.result) {
        lastUpdateOffset = update.update_id + 1;
        const message = update.message;
        if (!message?.text) continue;

        const text = message.text.trim();

        // Handle /start with login token (deep link)
        if (text.startsWith("/start login_")) {
          const loginToken = text.replace("/start login_", "");
          await handleLoginToken(loginToken, message.from, message.chat.id);
        }
        // Handle plain login token
        else if (pendingLogins.has(text) && !pendingLogins.get(text).telegramUser) {
          await handleLoginToken(text, message.from, message.chat.id);
        }
      }
    } catch (err) {
      // Silent fail — polling will retry
    }
  }, 2000);
}

/**
 * Process a login token received from Telegram.
 */
async function handleLoginToken(token, telegramFrom, chatId) {
  const session = pendingLogins.get(token);
  if (!session || session.telegramUser) return;

  // Link the Telegram user to this login session
  session.telegramUser = {
    id: telegramFrom.id,
    first_name: telegramFrom.first_name,
    last_name: telegramFrom.last_name,
    username: telegramFrom.username
  };

  // Send confirmation message to user in Telegram
  try {
    await fetch(`https://api.telegram.org/bot${getBotToken()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Login successful! You can close this chat and return to the app."
      })
    });
  } catch (err) {
    // Non-fatal
  }
}

/**
 * GET /api/auth/telegram/init
 *
 * Creates a login session and returns a token + bot deep link.
 * The user opens the deep link in Telegram to authenticate.
 */
function telegramInit(req, res) {
  if (!getBotToken()) {
    return res.status(500).json({ message: "Telegram login not configured." });
  }

  // Start polling if not already running
  startTelegramPolling();

  // Generate unique login token
  const loginToken = crypto.randomBytes(16).toString("hex");
  pendingLogins.set(loginToken, { telegramUser: null, createdAt: Date.now() });

  // Clean up old sessions (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, val] of pendingLogins) {
    if (val.createdAt < fiveMinutesAgo) pendingLogins.delete(key);
  }

  const botName = getBotName();
  const deepLink = `https://t.me/${botName}?start=login_${loginToken}`;

  res.json({ loginToken, deepLink });
}

/**
 * GET /api/auth/telegram/poll?token=xxx
 *
 * Frontend polls this endpoint to check if the user has authenticated via Telegram.
 * Returns { status: "pending" } or { status: "success", token, user }.
 */
async function telegramPoll(req, res) {
  try {
    const { token } = req.query;

    if (!token || !pendingLogins.has(token)) {
      return res.status(400).json({ status: "expired", message: "Login session expired." });
    }

    const session = pendingLogins.get(token);

    if (!session.telegramUser) {
      return res.json({ status: "pending" });
    }

    // User authenticated — find/create local user and issue JWT
    pendingLogins.delete(token);
    const localUser = await findOrCreateTelegramUser(session.telegramUser);

    const jwtToken = jwt.sign(
      { userId: localUser.user_id, email: localUser.email, role: localUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    res.json({
      status: "success",
      token: jwtToken,
      user: {
        userId: localUser.user_id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role
      }
    });
  } catch (error) {
    console.error("[Telegram] Poll error:", error);
    res.status(500).json({ message: "Telegram login failed." });
  }
}

/**
 * Find existing user by Telegram ID or create a new one.
 */
async function findOrCreateTelegramUser(telegramData) {
  const { id, first_name, last_name, username } = telegramData;
  const telegramId = String(id);

  // Check if user already linked to this Telegram account
  const [existing] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.status, r.role_name AS role
     FROM user u
     JOIN role r ON r.role_id = u.role_id
     WHERE u.telegram_id = ?
     LIMIT 1`,
    [telegramId]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new user with Staff role
  const [staffRole] = await pool.query("SELECT role_id FROM role WHERE role_name = 'Staff' LIMIT 1");
  const roleId = staffRole[0]?.role_id || 4;
  const displayName = [first_name, last_name].filter(Boolean).join(" ") || `Telegram User ${telegramId}`;
  const email = username ? `${username}@telegram.local` : `tg_${telegramId}@telegram.local`;

  const [result] = await pool.query(
    `INSERT INTO user (name, email, password, role_id, status, telegram_id)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [displayName, email, "", roleId, telegramId]
  );

  return {
    user_id: result.insertId,
    name: displayName,
    email,
    role: "Staff"
  };
}

module.exports = {
  telegramInit,
  telegramPoll
};
