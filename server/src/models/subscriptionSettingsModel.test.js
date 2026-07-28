jest.mock("../config/db", () => ({
  pool: {
    query: jest.fn()
  }
}));

const {
  findActivePlan,
  getSubscriptionSettings,
  normalizeSubscriptionSettings
} = require("./subscriptionSettingsModel");
const { pool } = require("../config/db");

describe("subscription settings", () => {
  test("normalizes the Admin plan template fields used by Finance subscriptions", () => {
    const settings = normalizeSubscriptionSettings({
      plans: [{
        name: "Premium",
        billingFrequency: "Yearly",
        active: true
      }]
    });

    expect(settings.plans[0]).toMatchObject({
      name: "Premium",
      billingFrequency: "Yearly",
      active: true
    });
    expect(settings.plans[0]).not.toHaveProperty("price");
    expect(settings.plans[0]).not.toHaveProperty("autoRenewDefault");
    expect(findActivePlan(settings, "premium")).toEqual(settings.plans[0]);
  });

  test("rejects duplicate plan names regardless of letter case", () => {
    expect(() => normalizeSubscriptionSettings({
      plans: [
        { name: "Basic" },
        { name: "basic" }
      ]
    })).toThrow(/unique/i);
  });

  test("inactive plans are not available to the Finance workflow", () => {
    const settings = normalizeSubscriptionSettings({
      plans: [{ name: "Legacy", active: false }]
    });

    expect(findActivePlan(settings, "Legacy")).toBeNull();
  });

  test("keeps automated safeguards enabled and customer pricing unlocked", () => {
    const settings = normalizeSubscriptionSettings({
      billingRules: {
        lockPlanPricing: true,
        allowPause: false
      },
      automation: {
        automaticInvoiceGeneration: false,
        notifyFinanceOnFailure: false
      }
    });

    expect(settings.billingRules.lockPlanPricing).toBe(false);
    expect(settings.billingRules.allowPause).toBe(true);
    expect(settings.automation.automaticInvoiceGeneration).toBe(true);
    expect(settings.automation.notifyFinanceOnFailure).toBe(true);
  });

  test("adds active customer-subscription usage counts to plan templates", async () => {
    pool.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[
        {
          plans_json: JSON.stringify([
            { id: "plan-1", name: "Premium", billingFrequency: "Monthly", active: true }
          ]),
          billing_rules_json: JSON.stringify({}),
          automation_settings_json: JSON.stringify({}),
          updated_at: "2026-07-28 10:00:00"
        }
      ]])
      .mockResolvedValueOnce([[
        { plan_key: "premium", usage_count: 3 }
      ]]);

    const settings = await getSubscriptionSettings(1);

    expect(settings.plans[0]).toMatchObject({
      id: "plan-1",
      name: "Premium",
      usageCount: 3
    });
  });
});
