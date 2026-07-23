const nodemailer = require("nodemailer");
const { pool } = require("../config/db");

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function payrollEmailHtml({ recipientName, title, message, actorName, actionPath }) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const actionUrl = actionPath ? `${clientUrl}${actionPath}` : clientUrl;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#251E1F">
    <h2 style="color:#F38978">${escapeHtml(title)}</h2><p>Hello ${escapeHtml(recipientName || "PayNivo user")},</p>
    <p>${escapeHtml(message)}</p>${actorName ? `<p><strong>Action initiated by:</strong> ${escapeHtml(actorName)}</p>` : ""}
    <p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#F38978;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Open PayNivo</a></p>
    <p style="color:#7b6660;font-size:12px">This is an automated payroll workflow notification.</p></div>`;
}

async function resolveActorName(actorUserId) {
  if (!actorUserId) return null;
  const [rows] = await pool.execute("SELECT name FROM user WHERE user_id = ? LIMIT 1", [actorUserId]);
  return rows[0]?.name || null;
}

async function notifyUser(userId, event) {
  const [users] = await pool.execute(
    "SELECT user_id, name, email, status FROM user WHERE user_id = ? LIMIT 1",
    [userId]
  );
  const recipient = users[0];
  if (!recipient || Number(recipient.status) !== 1) return null;

  const actorName = event.actorName || await resolveActorName(event.actorUserId);
  const message = actorName && !String(event.message).includes(actorName)
    ? `${event.message} Initiated by ${actorName}.`
    : event.message;
  const [result] = await pool.execute(
    `INSERT INTO notification
      (user_id, type, title, message, is_read, created_at, channel, delivery_status,
       action_path, actor_user_id, entity_type, entity_id, metadata)
     VALUES (?, ?, ?, ?, 0, NOW(), 'in_app,email', 'Pending', ?, ?, ?, ?, ?)`,
    [recipient.user_id, event.type || "payroll_workflow", event.title, message,
      event.actionPath || null, event.actorUserId || null, event.entityType || null,
      event.entityId == null ? null : String(event.entityId), JSON.stringify(event.metadata || {})]
  );

  const mailer = createTransporter();
  if (!mailer) {
    await pool.execute(
      "UPDATE notification SET delivery_status = 'Skipped', error_message = ? WHERE notification_id = ?",
      ["SMTP is not configured", result.insertId]
    );
    return result.insertId;
  }

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient.email,
      subject: `[PayNivo] ${event.title}`,
      html: payrollEmailHtml({ recipientName: recipient.name, title: event.title, message, actorName, actionPath: event.actionPath })
    });
    await pool.execute(
      "UPDATE notification SET delivery_status = 'Sent', sent_at = NOW(), error_message = NULL WHERE notification_id = ?",
      [result.insertId]
    );
  } catch (error) {
    await pool.execute(
      "UPDATE notification SET delivery_status = 'Failed', error_message = ? WHERE notification_id = ?",
      [String(error.message || "Email delivery failed").slice(0, 2000), result.insertId]
    );
  }
  return result.insertId;
}

async function notifyRoles(roleNames, event, { excludeUserId = null } = {}) {
  const roles = Array.isArray(roleNames) ? roleNames : [roleNames];
  if (!roles.length) return [];
  const placeholders = roles.map(() => "?").join(",");
  const [users] = await pool.execute(
    `SELECT user_id FROM user WHERE status = 1 AND role_name IN (${placeholders})`,
    roles
  );
  return Promise.all(users
    .filter((user) => Number(user.user_id) !== Number(excludeUserId))
    .map((user) => notifyUser(user.user_id, event)));
}

module.exports = { notifyRoles, notifyUser, payrollEmailHtml };
