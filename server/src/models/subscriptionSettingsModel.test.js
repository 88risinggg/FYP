jest.mock("../config/db", () => ({
  pool: {
    query: jest.fn()
  }
}));

const {
  findActivePlan,
  normalizeSubscriptionSettings
} = require("./subscriptionSettingsModel");

describe("subscription settings", () => {
  test("normalizes plan and automation values used by Finance subscriptions", () => {
    const settings = normalizeSubscriptionSettings({
      plans: [{
        name: "Premium",
        price: "199.90",
        billingFrequency: "Yearly",
        active: true
      }],
      billingRules: {
        requireApprovedPlan: true,
        lockPlanPricing: true
      },
      automation: {
        automaticInvoiceGeneration: true,
        autoSendMode: "always",
        renewalReminderDays: 14
      }
    });

    expect(settings.plans[0]).toMatchObject({
      name: "Premium",
      price: 199.9,
      billingFrequency: "Yearly",
      active: true
    });
    expect(settings.billingRules.requireApprovedPlan).toBe(true);
    expect(settings.automation.autoSendMode).toBe("always");
    expect(settings.automation.renewalReminderDays).toBe(14);
    expect(findActivePlan(settings, "premium")).toEqual(settings.plans[0]);
  });

  test("rejects duplicate plan names regardless of letter case", () => {
    expect(() => normalizeSubscriptionSettings({
      plans: [
        { name: "Basic", price: 10 },
        { name: "basic", price: 20 }
      ]
    })).toThrow(/unique/i);
  });

  test("inactive plans are not available to the Finance workflow", () => {
    const settings = normalizeSubscriptionSettings({
      plans: [{ name: "Legacy", price: 50, active: false }]
    });

    expect(findActivePlan(settings, "Legacy")).toBeNull();
  });
});
