const { pool } = require("../config/db");
const { currentCompanyId } = require("./tenantContext");
const { createEmailTransport, emailFrom, publicClientUrl } = require("./emailTransportService");

function eventCompanyId(event) {
  if (Number(event?.companyId) > 0) return Number(event.companyId);
  try { return currentCompanyId(); } catch { return process.env.NODE_ENV === "test" ? 1 : null; }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function payrollEmailHtml({ recipientName, title, message, actorName, actionPath }) {
  const clientUrl = publicClientUrl();
  const actionUrl = actionPath ? `${clientUrl}${actionPath}` : clientUrl;
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#251E1F">
    <h2 style="color:#F38978">${escapeHtml(title)}</h2><p>Hello ${escapeHtml(recipientName || "PayNivo user")},</p>
    <p>${escapeHtml(message)}</p>${actorName ? `<p><strong>Action initiated by:</strong> ${escapeHtml(actorName)}</p>` : ""}
    <p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#F38978;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Open PayNivo</a></p>
    <p style="color:#7b6660;font-size:12px">This is an automated payroll workflow notification.</p></div>`;
}

async function resolveActorName(actorUserId, companyId) {
  if (!actorUserId) return null;
  const [rows] = await pool.execute("SELECT name FROM user WHERE user_id = ? AND company_id = ? LIMIT 1", [actorUserId, companyId]);
  return rows[0]?.name || null;
}

async function notifyUser(userId, event) {
  const companyId = eventCompanyId(event);
  if (!companyId) return null;
  const [users] = await pool.execute(
    "SELECT user_id, name, email, status FROM user WHERE user_id = ? AND company_id=? LIMIT 1",
    [userId, companyId]
  );
  const recipient = users[0];
  if (!recipient || Number(recipient.status) !== 1) return null;

  const actorName = event.actorName || await resolveActorName(event.actorUserId, companyId);
  const message = actorName && !String(event.message).includes(actorName)
    ? `${event.message} Initiated by ${actorName}.`
    : event.message;
  const emailEnabled = event.email !== false;
  const [result] = await pool.execute(
    `INSERT INTO notification
      (company_id, user_id, type, title, message, is_read, created_at, channel, delivery_status,
       action_path, actor_user_id, entity_type, entity_id, metadata)
     VALUES (?, ?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
    [companyId, recipient.user_id, event.type || "payroll_workflow", event.title, message,
      emailEnabled ? "in_app,email" : "in_app", emailEnabled ? "Pending" : "Skipped",
      event.actionPath || null, event.actorUserId || null, event.entityType || null,
      event.entityId == null ? null : String(event.entityId), JSON.stringify(event.metadata || {})]
  );

  if (!emailEnabled) return result.insertId;

  const mailer = createEmailTransport({ required: false });
  if (!mailer) {
    await pool.execute(
      "UPDATE notification SET delivery_status = 'Skipped', error_message = ? WHERE notification_id = ? AND company_id = ?",
      ["SMTP is not configured", result.insertId, companyId]
    );
    return result.insertId;
  }

  try {
    await mailer.sendMail({
      from: emailFrom(),
      to: recipient.email,
      subject: `[PayNivo] ${event.title}`,
      html: payrollEmailHtml({ recipientName: recipient.name, title: event.title, message, actorName, actionPath: event.actionPath })
    });
    await pool.execute(
      "UPDATE notification SET delivery_status = 'Sent', sent_at = NOW(), error_message = NULL WHERE notification_id = ? AND company_id = ?",
      [result.insertId, companyId]
    );
  } catch (error) {
    await pool.execute(
      "UPDATE notification SET delivery_status = 'Failed', error_message = ? WHERE notification_id = ? AND company_id = ?",
      [String(error.message || "Email delivery failed").slice(0, 2000), result.insertId, companyId]
    );
  }
  return result.insertId;
}

async function notifyRoles(roleNames, event, { excludeUserId = null } = {}) {
  const roles = Array.isArray(roleNames) ? roleNames : [roleNames];
  if (!roles.length) return [];
  const placeholders = roles.map(() => "?").join(",");
  const companyId = eventCompanyId(event);
  if (!companyId) return [];
  const [users] = await pool.execute(
    `SELECT user_id FROM user WHERE status = 1 AND company_id=? AND role_name IN (${placeholders})`,
    [companyId, ...roles]
  );
  return Promise.all(users
    .filter((user) => Number(user.user_id) !== Number(excludeUserId))
    .map((user) => notifyUser(user.user_id, event)));
}

module.exports = { notifyRoles, notifyUser, payrollEmailHtml };
