import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Tags,
  Trash2
} from "lucide-react";

import {
  getAdminSubscriptionSettings,
  updateAdminSubscriptionSettings
} from "../../services/adminSubscriptionSettingsService.js";

const frequencies = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const subscriptionTabs = [
  { slug: "plans", key: "plans", label: "Plans & Pricing" },
  { slug: "billing-rules", key: "billingRules", label: "Billing Rules" },
  { slug: "automation", key: "automation", label: "Automation Settings" }
];

const emptySettings = {
  plans: [],
  billingRules: {
    requireApprovedPlan: false,
    lockPlanPricing: true,
    allowPause: true,
    allowCancellation: true,
    allowManualInvoiceGeneration: true,
    defaultAutoRenew: true
  },
  automation: {
    automaticInvoiceGeneration: true,
    autoSendMode: "finance_choice",
    renewalReminderDays: 7,
    notifyFinanceOnFailure: true
  }
};

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatSavedAt(value) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function validateSection(section, settings) {
  if (section === "plans") {
    if (!settings.plans.length) {
      return { valid: true, configured: false, note: "Add at least one active plan." };
    }
    const invalidPlan = settings.plans.find((plan) => (
      !String(plan.name || "").trim()
      || !Number.isFinite(Number(plan.price))
      || Number(plan.price) <= 0
      || !frequencies.includes(plan.billingFrequency)
    ));
    if (invalidPlan) {
      return { valid: false, configured: false, note: "Complete every plan name, price and billing frequency." };
    }
    if (!settings.plans.some((plan) => plan.active)) {
      return { valid: true, configured: false, note: "Activate at least one plan." };
    }
    return { valid: true, configured: true, note: "Active plans are ready for Finance." };
  }

  if (section === "automation") {
    const days = Number(settings.automation.renewalReminderDays);
    const validMode = ["finance_choice", "always", "never"].includes(settings.automation.autoSendMode);
    const validDays = Number.isInteger(days) && days >= 0 && days <= 90;
    return validMode && validDays
      ? { valid: true, configured: true, note: "Automation rules are valid." }
      : { valid: false, configured: false, note: "Choose a delivery mode and enter 0–90 reminder days." };
  }

  return { valid: true, configured: true, note: "Billing permissions and defaults are ready." };
}

function statusMeta(status) {
  if (status === "complete") {
    return {
      label: "Complete",
      icon: CheckCircle2,
      badge: "bg-emerald-100 text-emerald-700",
      iconClass: "text-emerald-600"
    };
  }
  if (status === "unsaved") {
    return {
      label: "Unsaved changes",
      icon: AlertTriangle,
      badge: "bg-amber-100 text-amber-800",
      iconClass: "text-amber-600"
    };
  }
  if (status === "needs-attention") {
    return {
      label: "Needs attention",
      icon: AlertTriangle,
      badge: "bg-rose-100 text-rose-700",
      iconClass: "text-rose-600"
    };
  }
  return {
    label: "Not started",
    icon: Circle,
    badge: "bg-slate-100 text-slate-600",
    iconClass: "text-slate-400"
  };
}

function Toggle({ label, note, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-5 rounded-xl border border-[#f2d5cc]/70 bg-white/80 p-4">
      <span>
        <span className="block text-sm font-bold text-[#251E1F]">{label}</span>
        {note ? <span className="mt-1 block text-xs leading-5 text-[#7b6660]">{note}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 accent-[#F38978]"
      />
    </label>
  );
}

function Field({ label, children, note }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#251E1F]">{label}</span>
      <div className="mt-1">{children}</div>
      {note ? <span className="mt-1 block text-xs text-[#7b6660]">{note}</span> : null}
    </label>
  );
}

function PlansPanel({ plans, onChange }) {
  function addPlan() {
    onChange([
      ...plans,
      {
        id: `plan-${Date.now()}`,
        name: "",
        description: "",
        price: "",
        billingFrequency: "Monthly",
        active: true,
        autoRenewDefault: true
      }
    ]);
  }

  function updatePlan(index, field, value) {
    onChange(plans.map((plan, planIndex) => (
      planIndex === index ? { ...plan, [field]: value } : plan
    )));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#251E1F]">Plans & Pricing</h2>
          <p className="mt-1 text-sm text-[#7b6660]">
            Define the approved plans that the existing Finance subscription workflow can use.
          </p>
        </div>
        <button
          type="button"
          onClick={addPlan}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-bold text-white hover:bg-[#e47767]"
        >
          <Plus size={16} /> Add Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e8c8bf] bg-white/60 px-6 py-12 text-center">
          <Tags className="mx-auto text-[#F38978]" />
          <p className="mt-3 text-sm font-bold text-[#251E1F]">No plans configured</p>
          <p className="mt-1 text-xs text-[#7b6660]">Finance can continue using its current manual plan fields until enforcement is enabled.</p>
        </div>
      ) : (
        plans.map((plan, index) => (
          <article key={plan.id || index} className="rounded-2xl border border-[#f2d5cc]/70 bg-white/85 p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Plan Name">
                <input
                  value={plan.name}
                  onChange={(event) => updatePlan(index, "name", event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#ead3cc] px-3 text-sm outline-none focus:border-[#F38978]"
                  placeholder="e.g. Premium"
                />
              </Field>
              <Field label="Price (SGD)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={plan.price}
                  onChange={(event) => updatePlan(index, "price", event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#ead3cc] px-3 text-sm outline-none focus:border-[#F38978]"
                />
              </Field>
              <Field label="Billing Frequency">
                <select
                  value={plan.billingFrequency}
                  onChange={(event) => updatePlan(index, "billingFrequency", event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm outline-none focus:border-[#F38978]"
                >
                  {frequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}
                </select>
              </Field>
              <div className="flex items-end justify-between gap-3">
                <label className="flex h-11 items-center gap-2 text-sm font-semibold text-[#5a3f39]">
                  <input
                    type="checkbox"
                    checked={plan.active}
                    onChange={(event) => updatePlan(index, "active", event.target.checked)}
                    className="h-4 w-4 accent-[#F38978]"
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => onChange(plans.filter((_, planIndex) => planIndex !== index))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                  aria-label={`Remove ${plan.name || "plan"}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <Field label="Description">
                <input
                  value={plan.description}
                  onChange={(event) => updatePlan(index, "description", event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#ead3cc] px-3 text-sm outline-none focus:border-[#F38978]"
                  placeholder="Description used for recurring invoice items"
                />
              </Field>
              <label className="flex items-end gap-2 pb-3 text-sm font-semibold text-[#5a3f39]">
                <input
                  type="checkbox"
                  checked={plan.autoRenewDefault}
                  onChange={(event) => updatePlan(index, "autoRenewDefault", event.target.checked)}
                  className="h-4 w-4 accent-[#F38978]"
                />
                Auto-renew by default
              </label>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function BillingRulesPanel({ rules, onChange }) {
  const setRule = (field, value) => onChange({ ...rules, [field]: value });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#251E1F]">Billing Rules</h2>
        <p className="mt-1 text-sm text-[#7b6660]">Control what the existing Finance subscription actions are allowed to do.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Toggle label="Require an approved plan" note="When enabled, Finance must enter a plan name configured in Plans & Pricing." checked={rules.requireApprovedPlan} onChange={(value) => setRule("requireApprovedPlan", value)} />
        <Toggle label="Lock approved plan pricing" note="An approved plan's price and frequency override values submitted by Finance." checked={rules.lockPlanPricing} onChange={(value) => setRule("lockPlanPricing", value)} />
        <Toggle label="Allow subscriptions to be paused" checked={rules.allowPause} onChange={(value) => setRule("allowPause", value)} />
        <Toggle label="Allow subscriptions to be cancelled" checked={rules.allowCancellation} onChange={(value) => setRule("allowCancellation", value)} />
        <Toggle label="Allow manual invoice generation" note="Controls the existing Generate Invoice Now action." checked={rules.allowManualInvoiceGeneration} onChange={(value) => setRule("allowManualInvoiceGeneration", value)} />
        <Toggle label="Default new subscriptions to auto-renew" note="Used when the existing workflow does not provide an explicit choice." checked={rules.defaultAutoRenew} onChange={(value) => setRule("defaultAutoRenew", value)} />
      </div>
    </div>
  );
}

function AutomationPanel({ automation, onChange }) {
  const setValue = (field, value) => onChange({ ...automation, [field]: value });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#251E1F]">Automation Settings</h2>
        <p className="mt-1 text-sm text-[#7b6660]">Configure the backend scheduler used by Finance subscriptions.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Toggle label="Automatically generate recurring invoices" note="If disabled, the scheduler skips subscriptions for this company." checked={automation.automaticInvoiceGeneration} onChange={(value) => setValue("automaticInvoiceGeneration", value)} />
        <Toggle label="Notify Finance when automation fails" checked={automation.notifyFinanceOnFailure} onChange={(value) => setValue("notifyFinanceOnFailure", value)} />
        <Field label="Automatic invoice delivery" note="This is enforced by the backend without adding new controls to the Finance page.">
          <select
            value={automation.autoSendMode}
            onChange={(event) => setValue("autoSendMode", event.target.value)}
            className="h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm outline-none focus:border-[#F38978]"
          >
            <option value="finance_choice">Use Finance selection</option>
            <option value="always">Always send automatically</option>
            <option value="never">Always save as draft</option>
          </select>
        </Field>
        <Field label="Renewal reminder lead time (days)" note="Accepted range: 0–90 days.">
          <input
            type="number"
            min="0"
            max="90"
            value={automation.renewalReminderDays}
            onChange={(event) => setValue("renewalReminderDays", Number(event.target.value))}
            className="h-11 w-full rounded-lg border border-[#ead3cc] px-3 text-sm outline-none focus:border-[#F38978]"
          />
        </Field>
      </div>
    </div>
  );
}

export default function AdminSubscriptionSettingsPage({ activeSection = "plans" }) {
  const location = useLocation();
  const [settings, setSettings] = useState(emptySettings);
  const [savedSettings, setSavedSettings] = useState(emptySettings);
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentSection = subscriptionTabs.some((tab) => tab.slug === activeSection)
    ? activeSection
    : "plans";
  const routePrefix = location.pathname.startsWith("/admin")
    ? "/admin/subscription-settings"
    : "/dashboard/invoicing/admin/subscription-settings";
  const sectionStates = subscriptionTabs.map((tab) => {
    const validation = validateSection(tab.slug, settings);
    const dirty = !valuesMatch(settings[tab.key], savedSettings[tab.key]);
    const status = !validation.valid
      ? "needs-attention"
      : dirty
        ? "unsaved"
        : savedAt && validation.configured
          ? "complete"
          : "not-started";
    return { ...tab, ...validation, dirty, status };
  });
  const hasUnsavedChanges = sectionStates.some((section) => section.dirty);
  const hasInvalidChanges = sectionStates.some((section) => !section.valid);
  const canSave = !savedAt || hasUnsavedChanges;
  const completedSteps = sectionStates.filter((section) => section.status === "complete").length;
  const progressPercent = Math.round((completedSteps / subscriptionTabs.length) * 100);

  useEffect(() => {
    getAdminSubscriptionSettings()
      .then((data) => {
        const loadedSettings = {
          plans: data.plans || [],
          billingRules: { ...emptySettings.billingRules, ...(data.billingRules || {}) },
          automation: { ...emptySettings.automation, ...(data.automation || {}) }
        };
        setSettings(cloneSettings(loadedSettings));
        setSavedSettings(cloneSettings(loadedSettings));
        setSavedAt(data.updatedAt || null);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function warnBeforeLeaving(event) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  async function save() {
    if (hasInvalidChanges) {
      setError("Complete the fields marked Needs attention before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await updateAdminSubscriptionSettings(settings);
      const saved = {
        plans: data.plans || [],
        billingRules: data.billingRules,
        automation: data.automation
      };
      setSettings(cloneSettings(saved));
      setSavedSettings(cloneSettings(saved));
      setSavedAt(data.updatedAt || new Date().toISOString());
      setMessage("Subscription settings saved and linked to the Finance subscription workflow.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setSettings(cloneSettings(savedSettings));
    setMessage("Unsaved changes were discarded.");
    setError("");
  }

  if (loading) {
    return <div className="flex min-h-[20rem] items-center justify-center"><Loader2 className="animate-spin text-[#F38978]" /></div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F38978]">Subscription Settings</p>
          <h1 className="mt-1 text-2xl font-bold text-[#251E1F]">Subscription Settings</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnsavedChanges ? (
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dfc3bb] bg-white px-4 py-2.5 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ee] disabled:opacity-60"
            >
              <RotateCcw size={16} /> Discard Changes
            </button>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || !canSave || hasInvalidChanges}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#251E1F] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4b3834] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {hasUnsavedChanges ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>You have unsaved subscription configuration changes.</span>
        </div>
      ) : null}

      <nav
        aria-label="Subscription settings sections"
        className="flex gap-1 overflow-x-auto rounded-xl border border-[#f2d5cc]/70 bg-white/75 p-1.5 shadow-sm"
      >
        {subscriptionTabs.map((tab) => {
          const tabState = sectionStates.find((section) => section.slug === tab.slug);
          return (
            <NavLink
              key={tab.slug}
              to={`${routePrefix}/${tab.slug}`}
              end
              className={({ isActive }) => {
                const selected = isActive || (currentSection === tab.slug && location.pathname === routePrefix);
                return `whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  selected
                    ? "bg-[#FDD9CD] text-[#E8573D] shadow-sm"
                    : "text-[#6f4f47] hover:bg-[#fff3ee] hover:text-[#E8573D]"
                }`;
              }}
            >
              {tab.label}
              {tabState?.dirty ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500" aria-label="Unsaved changes" /> : null}
            </NavLink>
          );
        })}
      </nav>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="rounded-2xl border border-[#f2d5cc]/70 bg-[#fff9f7]/70 p-5 shadow-sm sm:p-6">
          {currentSection === "billing-rules" ? (
            <BillingRulesPanel rules={settings.billingRules} onChange={(billingRules) => setSettings({ ...settings, billingRules })} />
          ) : currentSection === "automation" ? (
            <AutomationPanel automation={settings.automation} onChange={(automation) => setSettings({ ...settings, automation })} />
          ) : (
            <PlansPanel plans={settings.plans} onChange={(plans) => setSettings({ ...settings, plans })} />
          )}
        </div>

        <aside className="rounded-2xl border border-[#f2d5cc]/70 bg-white/90 p-5 shadow-sm xl:sticky xl:top-20">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F38978]">Configuration Status</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-[#251E1F]">{completedSteps} of {subscriptionTabs.length}</p>
              <p className="text-xs font-semibold text-[#7b6660]">steps completed</p>
            </div>
            <span className="text-sm font-bold text-[#E8573D]">{progressPercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f4e3de]">
            <div className="h-full rounded-full bg-[#F38978] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mt-5 space-y-3">
            {sectionStates.map((section) => {
              const meta = statusMeta(section.status);
              const StatusIcon = meta.icon;
              const isCurrent = currentSection === section.slug;
              return (
                <NavLink
                  key={section.slug}
                  to={`${routePrefix}/${section.slug}`}
                  className={`block rounded-xl border p-3 transition ${
                    isCurrent
                      ? "border-[#F38978] bg-[#fff3ee]"
                      : "border-[#f2d5cc]/70 bg-white hover:border-[#e8b8ac]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon size={18} className={`mt-0.5 shrink-0 ${meta.iconClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[#251E1F]">{section.label}</p>
                        {isCurrent ? <span className="rounded-full bg-[#FDD9CD] px-2 py-0.5 text-[10px] font-bold uppercase text-[#E8573D]">Current</span> : null}
                      </div>
                      <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <p className="mt-2 text-xs leading-5 text-[#7b6660]">{section.note}</p>
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </div>

          <div className="mt-5 border-t border-[#f2d5cc]/70 pt-4">
            <p className="text-xs font-bold text-[#7b6660]">Last saved</p>
            <p className="mt-1 text-sm font-bold text-[#251E1F]">{formatSavedAt(savedAt)}</p>
          </div>
        </aside>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        {currentSection === "automation" ? <Bot size={19} className="mt-0.5 shrink-0" /> : <CalendarClock size={19} className="mt-0.5 shrink-0" />}
        <p>GST, invoice numbering, payment terms and template appearance continue to come from Invoice Settings.</p>
      </div>
    </section>
  );
}
