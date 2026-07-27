import { describe, expect, it } from "vitest";
import { accountSetupRecipient, canAdminSendInitialSetup, initialSetupActionLabel } from "./payrollAccountSetup.js";

describe("Admin initial account setup eligibility", () => {
  const unfinished = {
    user_id: 42,
    activation_status: "Approved",
    account_status: 1,
    must_change_password: 1,
    email: "login@example.com",
    staff_email: "staff@example.com"
  };

  it("allows Admin to send or resend setup while first-time setup is unfinished", () => {
    expect(canAdminSendInitialSetup(unfinished)).toBe(true);
    expect(initialSetupActionLabel(unfinished)).toBe("Send initial setup email");
    expect(initialSetupActionLabel({ ...unfinished, setup_email_status: "Sent" })).toBe("Resend initial setup link");
  });

  it("uses the login email before a different HR staff email", () => {
    expect(accountSetupRecipient(unfinished)).toBe("login@example.com");
  });

  it("blocks resend for pending, disabled, or already-configured accounts", () => {
    expect(canAdminSendInitialSetup({ ...unfinished, activation_status: "Pending" })).toBe(false);
    expect(canAdminSendInitialSetup({ ...unfinished, account_status: 0 })).toBe(false);
    expect(canAdminSendInitialSetup({ ...unfinished, must_change_password: 0 })).toBe(false);
  });
});
