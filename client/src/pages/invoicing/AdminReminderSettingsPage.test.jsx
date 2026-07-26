import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import AdminReminderSettingsPage from "./AdminReminderSettingsPage.jsx";

vi.mock("../../services/adminReminderService.js", () => ({
  createReminderSetting: vi.fn(),
  fetchReminderSettings: vi.fn().mockResolvedValue({
    settings: [{
      id: 1,
      enabled: false,
      frequency: "Weekdays",
      reminderTime: "09:00",
      firstReminderDays: 1,
      secondReminderDays: 16,
      finalReminderDays: 31,
      emailSubject: "Reminder: {{invoice_number}}",
      emailBody: "Dear {{client_name}}, invoice {{invoice_number}} for {{amount_due}} was due on {{due_date}}."
    }],
    logs: [],
    summary: {}
  }),
  sendTestReminder: vi.fn(),
  updateReminderSetting: vi.fn()
}));

vi.mock("../../services/whatsappService.js", () => ({
  getWhatsAppConfig: vi.fn().mockResolvedValue({
    configured: true,
    is_enabled: true,
    connection_status: "connected",
    whatsapp_number: "+14155238886"
  }),
  getWhatsAppMessages: vi.fn().mockResolvedValue({ messages: [] }),
  getWhatsAppNotificationRules: vi.fn().mockResolvedValue({
    rules: [{ rule_type: "payment_reminder", is_enabled: true }]
  }),
  getWhatsAppTemplates: vi.fn().mockResolvedValue({
    templates: [{ id: 1, template_name: "Payment Reminder", is_default: true, is_active: true }]
  })
}));

describe("Admin Reminder Settings layout", () => {
  it("separates policy, email, WhatsApp and delivery logs into tabs", async () => {
    render(<MemoryRouter><AdminReminderSettingsPage /></MemoryRouter>);

    expect(await screen.findByText("Reminder Policy")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Policy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delivery Logs" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "WhatsApp" }));
    expect(await screen.findByText("WhatsApp Reminder Channel")).toBeTruthy();
    expect(screen.getByText("Credentials configured")).toBeTruthy();
    expect(screen.getByText("+14155238886")).toBeTruthy();
    expect(screen.getByText(/scheduled Admin reminder policy currently sends Email only/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delivery Logs" }));
    expect(screen.getByText("Reminder Delivery Logs")).toBeTruthy();
    expect(screen.getByText("No reminder deliveries match the selected filters.")).toBeTruthy();
  });
});
