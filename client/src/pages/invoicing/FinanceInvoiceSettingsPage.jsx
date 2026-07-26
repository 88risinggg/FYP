/**
 * Finance Invoice Settings Page (Read-Only)
 *
 * Displays the Admin-configured invoice settings in a read-only format
 * so Finance users can reference numbering, email, payment, and tax
 * configuration without needing to contact the Admin.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  Clock3,
  FileText,
  Globe,
  Hash,
  Loader2,
  Lock,
  Mail,
  Settings2,
  Shield
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(d);
}

function formatDateTime(value) {
  if (!value) return "Not saved yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not saved yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function SettingsCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978] ring-1 ring-[#F38978]/20">
          <Icon size={20} />
        </div>
        <h3 className="text-base font-bold text-[#251E1F]">{title}</h3>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#7b6660]">
          <Lock size={12} className="text-[#F38978]" />
          Admin Controlled
        </span>
      </div>
      {children}
    </section>
  );
}

function ReadOnlyField({ label, value, note }) {
  return (
    <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#251E1F]">{value || "-"}</p>
      {note ? <p className="mt-1 text-xs text-[#7b6660]">{note}</p> : null}
    </div>
  );
}

function MessageBanner({ type, children }) {
  const styles = type === "error"
    ? "border-rose-400/30 bg-rose-500/10 text-rose-700"
    : "border-[#F38978]/30 bg-[#FDD9CD]/20 text-[#6f4f47]";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${styles}`}>
      {children}
    </div>
  );
}

const tabs = [
  { label: "General", slug: "general", icon: Settings2 },
  { label: "Numbering", slug: "numbering", icon: Hash },
  { label: "Email", slug: "email", icon: Mail },
  { label: "Payments", slug: "payments", icon: Banknote },
  { label: "Tax / GST", slug: "gst", icon: FileText },
  { label: "Reminders", slug: "reminders", icon: Bell }
];

export default function FinanceInvoiceSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [gstRates, setGstRates] = useState([]);
  const [reminderRules, setReminderRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      setLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("authToken");
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/api/invoices/settings`, { headers });
        if (!res.ok) throw new Error("Failed to load invoice settings.");
        const data = await res.json();
        if (active) {
          setSettings(data.settings || null);
          setGstRates(data.gstRates || []);
          setReminderRules(data.reminderRules || []);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSettings();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center gap-2 text-sm font-semibold text-[#7b6660]">
        <Loader2 size={18} className="animate-spin" />
        Loading invoice settings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <MessageBanner type="error">{error}</MessageBanner>
      </div>
    );
  }

  const s = settings || {};
  const general = s.general || {};
  const branding = s.branding || {};
  const seqRules = s.sequenceRules || {};
  const updatedAt = s.updated_at || s.updatedAt;

  return (
    <section
      className="min-h-screen text-[#251E1F]"
      style={{
        backgroundImage:
          "linear-gradient(90deg, #FDD9CD 0%, #fff8f5 15%, #fffaf8 58%, #FDD9CD 100%)"
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
        {/* Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#F38978]">Invoice Configuration</p>
            <h1 className="mt-1 text-2xl font-bold text-[#251E1F]">Invoice Settings</h1>
            <p className="mt-1 text-sm text-[#7b6660]">
              Read-only view of invoice configuration managed by Admin.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#7b6660]">
            <Lock size={14} className="text-[#F38978]" />
            <span>Last updated: {formatDateTime(updatedAt)}</span>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="flex flex-wrap gap-1 rounded-xl border border-[#f0d2ca] bg-white/80 p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.slug;
            return (
              <button
                key={tab.slug}
                type="button"
                onClick={() => setActiveTab(tab.slug)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#F38978] text-white shadow-md"
                    : "text-[#7b6660] hover:bg-[#FDD9CD]/40 hover:text-[#251E1F]"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Admin-only notice */}
        <div className="flex items-center gap-3 rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/20 px-4 py-3">
          <Shield size={18} className="shrink-0 text-[#F38978]" />
          <p className="text-sm text-[#6f4f47]">
            These settings are managed by the Admin team. Contact your administrator to request changes.
          </p>
        </div>

        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <SettingsCard title="General Configuration" icon={Globe}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Default Currency" value={general.defaultCurrency || s.defaultCurrency || "SGD"} />
                <ReadOnlyField label="Default Language" value="English" />
                <ReadOnlyField label="Default Tax" value={general.defaultTax || "GST_9"} />
                <ReadOnlyField label="Price Display" value={general.priceDisplay || "tax_exclusive"} />
                <ReadOnlyField label="Payment Terms" value={general.paymentTerms || s.paymentTerms || "Net 30"} />
                <ReadOnlyField label="Due Period" value={`${s.dueDays ?? 30} days`} />
                <ReadOnlyField label="Late Fee" value={`${general.lateFeeValue ?? s.lateFeePercent ?? 0}% (${general.lateFeeType || "percent"})`} />
                <ReadOnlyField label="Online View Link" value="Always Enabled" note="Included when invoices are sent." />
                <ReadOnlyField label="WhatsApp Notifications" value="Always Enabled" note="Configured system-wide." />
              </div>
            </SettingsCard>

            <SettingsCard title="Branding" icon={Settings2}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Company Name" value={s.companyName} />
                <ReadOnlyField label="Brand Color" value={branding.brandColor || "#F38978"} />
                <ReadOnlyField label="Show Company Details" value={branding.showCompanyDetailsOnInvoice !== false ? "Yes" : "No"} />
                <ReadOnlyField label="Company Logo" value={branding.companyLogoUrl ? "Uploaded" : "Not set"} />
              </div>
            </SettingsCard>
          </div>
        )}

        {/* Numbering Tab */}
        {activeTab === "numbering" && (
          <div className="space-y-5">
            <SettingsCard title="Invoice Numbering" icon={Hash}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Invoice Prefix" value={s.invoicePrefix || "INV"} />
                <ReadOnlyField label="Invoice Year" value={s.invoiceYear || new Date().getFullYear()} />
                <ReadOnlyField label="Separator Style" value={s.separatorStyle || "hyphen"} />
                <ReadOnlyField label="Invoice Format" value={s.invoiceFormat || "{PREFIX}-{YYYY}-{NNNN}"} />
                <ReadOnlyField label="Next Invoice Number" value={s.nextInvoiceNumber || 1} />
                <ReadOnlyField
                  label="Preview"
                  value={s.previewInvoiceNumber || buildPreview(s)}
                  note="Next invoice will use this number."
                />
              </div>
            </SettingsCard>

            <SettingsCard title="Sequence Rules" icon={Settings2}>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Yearly Reset" value={seqRules.yearlyReset ? "Enabled" : "Disabled"} note="Restart numbering when year changes." />
                <ReadOnlyField label="Allow Manual Override" value={seqRules.allowManualOverride ? "Enabled" : "Disabled"} note="Admins can adjust numbers before sending." />
              </div>
            </SettingsCard>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === "email" && (
          <div className="space-y-5">
            <SettingsCard title="Email Configuration" icon={Mail}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Sender Name" value={s.senderName} />
                <ReadOnlyField label="Reply-To Email" value={s.replyToEmail} />
                <ReadOnlyField label="Finance Email" value={s.financeEmail} />
                <ReadOnlyField label="Support Email" value={s.supportEmail} />
                <ReadOnlyField label="Attach PDF Invoice" value={s.attachPdfInvoice !== false ? "Yes" : "No"} />
              </div>
            </SettingsCard>

            <SettingsCard title="Email Templates" icon={FileText}>
              <div className="space-y-4">
                <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Subject Template</p>
                  <p className="mt-2 text-sm font-mono text-[#251E1F] whitespace-pre-wrap">
                    {s.emailSubjectTemplate || "Invoice {{invoice_number}} from {{company_name}}"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Body Template</p>
                  <p className="mt-2 text-sm font-mono text-[#251E1F] whitespace-pre-wrap">
                    {s.emailBodyTemplate || "Dear {{customer_name}},\n\nYour invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}.\n\nThank you,\n{{company_name}}"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#ead3cc]/60 bg-[#FDD9CD]/10 px-4 py-3">
                  <p className="text-xs font-semibold text-[#7b6660]">
                    Available placeholders: <code className="text-[#F38978]">{"{{invoice_number}}"}</code>, <code className="text-[#F38978]">{"{{customer_name}}"}</code>, <code className="text-[#F38978]">{"{{amount_due}}"}</code>, <code className="text-[#F38978]">{"{{due_date}}"}</code>, <code className="text-[#F38978]">{"{{company_name}}"}</code>, <code className="text-[#F38978]">{"{{online_view_url}}"}</code>, <code className="text-[#F38978]">{"{{payment_url}}"}</code>
                  </p>
                </div>
              </div>
            </SettingsCard>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-5">
            <SettingsCard title="Company Details" icon={Settings2}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Company Name" value={s.companyName} />
                <ReadOnlyField label="Registration Number" value={s.companyRegistrationNumber} />
                <ReadOnlyField label="Company Address" value={s.companyAddress} />
                <ReadOnlyField label="Registered Office" value={s.registeredOfficeAddress} />
              </div>
            </SettingsCard>

            <SettingsCard title="Bank Details" icon={Banknote}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Account Holder" value={s.bankAccountHolderName} />
                <ReadOnlyField label="Bank Name" value={s.bankName} />
                <ReadOnlyField label="Account Number" value={s.bankAccountNumber} />
                <ReadOnlyField label="BIC / SWIFT" value={s.bicSwift} />
                <ReadOnlyField label="PayNow Identifier" value={s.paynowIdentifier} />
              </div>
            </SettingsCard>

            <SettingsCard title="Payment Instructions" icon={FileText}>
              <div className="space-y-4">
                <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Payment Reference Instruction</p>
                  <p className="mt-2 text-sm text-[#251E1F] whitespace-pre-wrap">{s.paymentReferenceInstruction || "-"}</p>
                </div>
                <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Payout Statement</p>
                  <p className="mt-2 text-sm text-[#251E1F] whitespace-pre-wrap">{s.payoutStatement || "-"}</p>
                </div>
                <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Computer Generated Statement</p>
                  <p className="mt-2 text-sm text-[#251E1F] whitespace-pre-wrap">{s.computerGeneratedStatement || "-"}</p>
                </div>
              </div>
            </SettingsCard>
          </div>
        )}

        {/* GST Tab */}
        {activeTab === "gst" && (
          <div className="space-y-5">
            <SettingsCard title="Tax Configuration" icon={FileText}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ReadOnlyField label="Tax Type" value={s.taxType || s.taxName || "GST"} />
                <ReadOnlyField label="Tax Rate" value={`${s.defaultTaxRate ?? s.taxPercentage ?? 9}%`} />
                <ReadOnlyField label="Tax Inclusive" value={s.taxInclusive || general.priceDisplay === "tax_inclusive" ? "Yes" : "No"} />
                <ReadOnlyField label="Tax Enabled" value={s.taxEnabled !== false ? "Yes" : "No"} />
              </div>
            </SettingsCard>

            {/* Current & Scheduled GST */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Current Active GST</p>
                <p className="mt-3 text-4xl font-bold text-[#251E1F]">
                  {s.defaultTaxRate ?? s.taxPercentage ?? 9}%
                </p>
                <p className="mt-2 text-xs text-[#7b6660]">Applied to all new invoices</p>
              </div>
              <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5 shadow-[0_10px_28px_rgba(37,30,31,0.06)]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#F38978]">Next Scheduled Change</p>
                <p className="mt-3 text-4xl font-bold text-[#251E1F]">
                  {s.nextScheduledGstRate ? `${Number(s.nextScheduledGstRate.ratePercentage)}%` : "None"}
                </p>
                <p className="mt-2 text-xs text-[#7b6660]">
                  {s.nextScheduledGstRate ? `Effective from ${formatDate(s.nextScheduledGstRate.effectiveFrom)}` : "No upcoming changes"}
                </p>
              </div>
            </div>

            {/* GST Rate History Table */}
            <SettingsCard title="GST Rate History" icon={Clock3}>
              {gstRates.length === 0 ? (
                <p className="py-6 text-center text-sm font-semibold text-[#7b6660]">No GST rates configured.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[#f0d2ca]">
                  <div className="overflow-x-auto">
                    <table className="min-w-[600px] w-full text-left text-sm">
                      <thead className="bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
                        <tr>
                          <th className="px-4 py-3">Tax Code</th>
                          <th className="px-4 py-3">Tax Name</th>
                          <th className="px-4 py-3">Rate</th>
                          <th className="px-4 py-3">Effective From</th>
                          <th className="px-4 py-3">Effective To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5e2dc] bg-white">
                        {gstRates.map((rate) => (
                          <tr key={rate.id || rate.gst_rate_id} className="align-middle">
                            <td className="px-4 py-3 font-bold text-[#251E1F]">{rate.taxCode || rate.tax_code || "-"}</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rate.taxName || rate.tax_name || "-"}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-[#FDD9CD]/55 px-2.5 py-1 text-xs font-bold text-[#251E1F]">
                                {Number(rate.ratePercentage || rate.rate_percentage || 0)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#7b6660]">{formatDate(rate.effectiveFrom || rate.effective_from)}</td>
                            <td className="px-4 py-3 text-[#7b6660]">{(rate.effectiveTo || rate.effective_to) ? formatDate(rate.effectiveTo || rate.effective_to) : "Ongoing"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </SettingsCard>
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === "reminders" && (
          <div className="space-y-5">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Active Rules</p>
                    <p className="mt-2 text-2xl font-bold text-[#251E1F]">{reminderRules.filter((r) => r.enabled || r.is_enabled).length}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
                    <Bell size={20} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Total Rules</p>
                    <p className="mt-2 text-2xl font-bold text-[#251E1F]">{reminderRules.length}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
                    <Settings2 size={20} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Delivery Channel</p>
                    <p className="mt-2 text-lg font-bold text-[#251E1F]">{reminderRules[0]?.deliveryChannel || reminderRules[0]?.delivery_channel || "Email"}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
                    <Mail size={20} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#f0d2ca] bg-white/95 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Disabled Rules</p>
                    <p className="mt-2 text-2xl font-bold text-[#251E1F]">{reminderRules.filter((r) => !(r.enabled || r.is_enabled)).length}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F38978]/12 text-[#F38978]">
                    <AlertTriangle size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Reminder Rules Table */}
            <SettingsCard title="Reminder Schedule Rules" icon={Bell}>
              {reminderRules.length === 0 ? (
                <p className="py-6 text-center text-sm font-semibold text-[#7b6660]">No reminder rules configured.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[#f0d2ca]">
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead className="bg-[#fff8f5] text-xs font-bold uppercase text-[#7b6660]">
                        <tr>
                          <th className="px-4 py-3">Rule Name</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Frequency</th>
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Timezone</th>
                          <th className="px-4 py-3">1st Reminder</th>
                          <th className="px-4 py-3">2nd Reminder</th>
                          <th className="px-4 py-3">Final</th>
                          <th className="px-4 py-3">Channel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5e2dc] bg-white">
                        {reminderRules.map((rule, idx) => (
                          <tr key={rule.id || rule.reminder_setting_id || idx} className="align-middle">
                            <td className="px-4 py-3 font-bold text-[#251E1F]">{rule.name || rule.ruleName || rule.rule_name || `Rule ${idx + 1}`}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                                rule.enabled || rule.is_enabled
                                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-700"
                                  : "border-slate-400/30 bg-slate-500/10 text-slate-600"
                              }`}>
                                {rule.enabled || rule.is_enabled ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.frequency || "Daily"}</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.reminderTime || rule.reminder_time || "09:00"}</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.timezone || "Asia/Singapore"}</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.firstReminderDays || rule.first_reminder_days || "-"} days</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.secondReminderDays || rule.second_reminder_days || "-"} days</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.finalReminderDays || rule.final_reminder_days || "-"} days</td>
                            <td className="px-4 py-3 text-[#7b6660]">{rule.deliveryChannel || rule.delivery_channel || "Email"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </SettingsCard>

            {/* Reminder Timeline Preview (uses first active rule) */}
            {reminderRules.length > 0 && (
              <SettingsCard title="Reminder Timeline Preview" icon={Clock3}>
                <div className="flex flex-wrap items-center gap-4">
                  {[
                    { label: "Invoice Due Date", value: "Day 0" },
                    { label: "1st Reminder", value: `${reminderRules[0]?.firstReminderDays || reminderRules[0]?.first_reminder_days || 1} days overdue` },
                    { label: "2nd Reminder", value: `${reminderRules[0]?.secondReminderDays || reminderRules[0]?.second_reminder_days || 16} days overdue` },
                    { label: "Final Reminder", value: `${reminderRules[0]?.finalReminderDays || reminderRules[0]?.final_reminder_days || 31}+ days overdue` }
                  ].map((step, idx, arr) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F38978]/15 text-[#F38978] ring-1 ring-[#F38978]/25">
                          <Bell size={16} />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#251E1F]">{step.label}</p>
                        <p className="text-xs text-[#7b6660]">{step.value}</p>
                      </div>
                      {idx < arr.length - 1 && <div className="hidden sm:block h-px w-8 bg-[#f0d2ca]" />}
                    </div>
                  ))}
                </div>
              </SettingsCard>
            )}

            {/* Reminder Options (from first rule) */}
            {reminderRules.length > 0 && (
              <SettingsCard title="Reminder Options" icon={Settings2}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReadOnlyField label="Send to unpaid invoices only" value={reminderRules[0]?.unpaidOnly || reminderRules[0]?.unpaid_only ? "Yes" : "No"} />
                  <ReadOnlyField label="Stop when invoice paid" value={reminderRules[0]?.stopWhenPaid || reminderRules[0]?.stop_when_paid ? "Yes" : "No"} />
                  <ReadOnlyField label="Exclude cancelled invoices" value={reminderRules[0]?.excludeCancelled || reminderRules[0]?.exclude_cancelled ? "Yes" : "No"} />
                  <ReadOnlyField label="Include PDF attachment" value={reminderRules[0]?.includePdf || reminderRules[0]?.include_pdf ? "Yes" : "No"} />
                </div>
              </SettingsCard>
            )}

            {/* Email Template (read-only from first rule) */}
            {reminderRules.length > 0 && (reminderRules[0]?.emailSubject || reminderRules[0]?.email_subject) && (
              <SettingsCard title="Reminder Email Template" icon={Mail}>
                <div className="space-y-4">
                  <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Template Name</p>
                    <p className="mt-1 text-sm font-semibold text-[#251E1F]">{reminderRules[0]?.templateName || reminderRules[0]?.template_name || "Overdue Invoice Reminder"}</p>
                  </div>
                  <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Subject</p>
                    <p className="mt-2 text-sm font-mono text-[#251E1F]">{reminderRules[0]?.emailSubject || reminderRules[0]?.email_subject || "-"}</p>
                  </div>
                  <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b6660]">Body</p>
                    <pre className="mt-2 text-sm text-[#251E1F] whitespace-pre-wrap font-sans">{reminderRules[0]?.emailBody || reminderRules[0]?.email_body || "-"}</pre>
                  </div>
                  <div className="rounded-lg border border-[#ead3cc]/60 bg-[#FDD9CD]/10 px-4 py-3">
                    <p className="text-xs font-semibold text-[#7b6660]">
                      Available placeholders: <code className="text-[#F38978]">{"{{client_name}}"}</code>, <code className="text-[#F38978]">{"{{invoice_number}}"}</code>, <code className="text-[#F38978]">{"{{amount_due}}"}</code>, <code className="text-[#F38978]">{"{{due_date}}"}</code>, <code className="text-[#F38978]">{"{{overdue_days}}"}</code>, <code className="text-[#F38978]">{"{{company_name}}"}</code>, <code className="text-[#F38978]">{"{{payment_link}}"}</code>
                    </p>
                  </div>
                </div>
              </SettingsCard>
            )}

            {/* Admin-only notice */}
            <div className="rounded-xl border border-[#f0d2ca] bg-[#FDD9CD]/15 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#F38978]" />
                <div>
                  <p className="text-sm font-semibold text-[#251E1F]">Reminder Management</p>
                  <p className="mt-1 text-xs text-[#7b6660]">
                    Reminder rules are created and managed by Admin. Reminders are sent automatically based on invoice due dates and the rules configured above. Contact your administrator to add, modify, or delete reminder rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

function buildPreview(settings) {
  const prefix = settings.invoicePrefix || "INV";
  const year = String(settings.invoiceYear || new Date().getFullYear());
  const format = settings.invoiceFormat || "{PREFIX}-{YYYY}-{NNNN}";
  const num = String(settings.nextInvoiceNumber || 1).padStart(4, "0");

  return format
    .replaceAll("{PREFIX}", prefix)
    .replaceAll("{YYYY}", year)
    .replaceAll("{YY}", year.slice(-2))
    .replaceAll("{NNNN}", num);
}
