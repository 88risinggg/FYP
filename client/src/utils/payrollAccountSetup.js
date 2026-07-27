export function accountSetupRecipient(record = {}) {
  return String(record.email || record.setup_email_recipient || record.staff_email || "").trim();
}

export function canAdminSendInitialSetup(record = {}) {
  return Boolean(record.user_id)
    && String(record.activation_status || "").toLowerCase() === "approved"
    && Number(record.account_status) === 1
    && Number(record.must_change_password) === 1
    && Boolean(accountSetupRecipient(record));
}

export function initialSetupActionLabel(record = {}) {
  return record.setup_email_status ? "Resend initial setup link" : "Send initial setup email";
}
