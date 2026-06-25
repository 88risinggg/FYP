import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Hash,
  Mail,
  Percent,
  Save,
  Settings2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchInvoiceSettings,
  saveInvoiceSettings
} from "../../services/adminInvoiceSettingsService.js";

const defaultForm = {
  invoicePrefix: "INV",
  nextInvoiceNumber: 1,
  numberingStyle: "PREFIX-DATE-NUMBER",
  dateFormat: "YYYYMM",
  defaultCurrency: "SGD",
  taxType: "GST",
  defaultTaxRate: 9,
  pricesIncludeTax: false,
  paymentTerms: "Net 30",
  dueDays: 30,
  lateFeePercent: 0,
  gracePeriodDays: 0,
  companyName: "",
  companyAddress: "",
  supportEmail: "",
  footerNote: "Thank you for your business."
};

function formatDatePart(dateFormat) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  if (dateFormat === "YYMM") return `${year.slice(-2)}${month}`;
  if (dateFormat === "YYYYMMDD") return `${year}${month}${day}`;
  return `${year}${month}`;
}

function buildPreviewNumber(form) {
  const prefix = form.invoicePrefix || "INV";
  const nextNumber = String(form.nextInvoiceNumber || 1).padStart(4, "0");
  const datePart = formatDatePart(form.dateFormat);

  if (form.numberingStyle === "PREFIX-NUMBER") return `${prefix}-${nextNumber}`;
  if (form.numberingStyle === "DATE-PREFIX-NUMBER") return `${datePart}-${prefix}-${nextNumber}`;
  return `${prefix}-${datePart}-${nextNumber}`;
}

function buildSampleDueDate(form) {
  const date = new Date();
  date.setDate(date.getDate() + Number(form.dueDays || 30));
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium" }).format(date);
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#d8c6e8]">{label}</span>
      {children}
    </label>
  );
}

export default function AdminInvoiceSettingsPage() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [isConfigured, setIsConfigured] = useState(false);

  const previewInvoiceNumber = useMemo(() => buildPreviewNumber(form), [form]);
  const sampleDueDate = useMemo(() => buildSampleDueDate(form), [form]);

  async function loadSettings() {
    setLoading(true);
    setErrors([]);

    try {
      const data = await fetchInvoiceSettings();
      setForm({ ...defaultForm, ...(data.settings || {}) });
      setIsConfigured(Boolean(data.isConfigured));
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    const nextErrors = [];
    if (!form.invoicePrefix.trim()) nextErrors.push("Invoice prefix is required.");
    if (!Number(form.nextInvoiceNumber) || Number(form.nextInvoiceNumber) < 1) nextErrors.push("Next invoice number must be at least 1.");
    if (!form.defaultCurrency.trim()) nextErrors.push("Default currency is required.");
    if (!form.taxType.trim()) nextErrors.push("Tax type is required.");
    if (Number(form.defaultTaxRate) < 0) nextErrors.push("Default tax rate cannot be negative.");
    if (!form.paymentTerms.trim()) nextErrors.push("Payment terms are required.");
    if (!Number(form.dueDays) || Number(form.dueDays) < 1) nextErrors.push("Invoice due period must be at least 1 day.");
    if (Number(form.lateFeePercent) < 0) nextErrors.push("Late fee percent cannot be negative.");
    if (Number(form.gracePeriodDays) < 0) nextErrors.push("Grace period days cannot be negative.");
    if (!form.companyName.trim()) nextErrors.push("Company name is required.");
    if (!form.companyAddress.trim()) nextErrors.push("Company address is required.");
    if (!form.supportEmail.trim()) nextErrors.push("Support email is required.");
    return nextErrors;
  }

  async function handleSave(event) {
    event.preventDefault();
    const nextErrors = validateForm();
    setErrors(nextErrors);
    setMessage("");
    if (nextErrors.length > 0) return;

    setSaving(true);
    try {
      const data = await saveInvoiceSettings({
        ...form,
        nextInvoiceNumber: Number(form.nextInvoiceNumber),
        defaultTaxRate: Number(form.defaultTaxRate),
        dueDays: Number(form.dueDays),
        lateFeePercent: Number(form.lateFeePercent),
        gracePeriodDays: Number(form.gracePeriodDays)
      });
      setForm({ ...defaultForm, ...data.settings });
      setIsConfigured(true);
      setMessage("Invoice settings saved successfully.");
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="neon-glass neon-border rounded-lg p-8 text-center text-[#d8c6e8]">
        Loading invoice settings...
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-[#C77DFF]">Admin Configure Invoice Standards</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Automated Invoicing System - Invoice Settings
          </h2>
          <p className="mt-2 text-sm text-[#d8c6e8]">
            Configure numbering, currency, payment terms, tax defaults, and company invoice details.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-[#d8c6e8]">
          <CheckCircle2 size={16} className={isConfigured ? "text-emerald-200" : "text-amber-200"} />
          {isConfigured ? "Settings saved in MySQL" : "Using defaults until saved"}
        </span>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errors.map((error) => <p key={error}>{error}</p>)}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center gap-3">
              <Hash className="text-[#C77DFF]" size={22} />
              <h3 className="text-lg font-semibold text-white">Invoice Numbering</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Invoice prefix">
                <input value={form.invoicePrefix} onChange={(event) => setField("invoicePrefix", event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Next invoice number">
                <input type="number" min="1" value={form.nextInvoiceNumber} onChange={(event) => setField("nextInvoiceNumber", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Numbering style">
                <select value={form.numberingStyle} onChange={(event) => setField("numberingStyle", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none">
                  <option value="PREFIX-DATE-NUMBER">Prefix-Date-Number</option>
                  <option value="PREFIX-NUMBER">Prefix-Number</option>
                  <option value="DATE-PREFIX-NUMBER">Date-Prefix-Number</option>
                </select>
              </Field>
              <Field label="Date format">
                <select value={form.dateFormat} onChange={(event) => setField("dateFormat", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#140026] px-3 py-2 text-sm text-white outline-none">
                  <option value="YYYYMM">YYYYMM</option>
                  <option value="YYMM">YYMM</option>
                  <option value="YYYYMMDD">YYYYMMDD</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center gap-3">
              <BadgeDollarSign className="text-[#C77DFF]" size={22} />
              <h3 className="text-lg font-semibold text-white">Currency, Tax, and Terms</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Default currency">
                <input value={form.defaultCurrency} onChange={(event) => setField("defaultCurrency", event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Tax type">
                <input value={form.taxType} onChange={(event) => setField("taxType", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Default tax rate (%)">
                <input type="number" min="0" step="0.01" value={form.defaultTaxRate} onChange={(event) => setField("defaultTaxRate", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Payment terms">
                <input value={form.paymentTerms} onChange={(event) => setField("paymentTerms", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Invoice due period (days)">
                <input type="number" min="1" value={form.dueDays} onChange={(event) => setField("dueDays", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Late fee percent">
                <input type="number" min="0" step="0.01" value={form.lateFeePercent} onChange={(event) => setField("lateFeePercent", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Grace period days">
                <input type="number" min="0" value={form.gracePeriodDays} onChange={(event) => setField("gracePeriodDays", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white">
                <input type="checkbox" checked={form.pricesIncludeTax} onChange={(event) => setField("pricesIncludeTax", event.target.checked)} className="h-4 w-4 accent-[#C77DFF]" />
                Prices include tax
              </label>
            </div>
          </section>

          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center gap-3">
              <Building2 className="text-[#C77DFF]" size={22} />
              <h3 className="text-lg font-semibold text-white">Company Invoice Details</h3>
            </div>
            <div className="grid gap-4">
              <Field label="Company name">
                <input value={form.companyName} onChange={(event) => setField("companyName", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Company address">
                <textarea rows="3" value={form.companyAddress} onChange={(event) => setField("companyAddress", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Support email">
                <input type="email" value={form.supportEmail} onChange={(event) => setField("supportEmail", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="Footer note">
                <textarea rows="3" value={form.footerNote} onChange={(event) => setField("footerNote", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none" />
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="neon-glass neon-border rounded-lg p-5">
            <div className="mb-5 flex items-center gap-3">
              <FileText className="text-[#C77DFF]" size={22} />
              <h3 className="text-lg font-semibold text-white">New Invoice Preview</h3>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                <p className="text-xs font-semibold uppercase text-[#d8c6e8]">Invoice number</p>
                <p className="mt-1 text-2xl font-semibold text-white">{previewInvoiceNumber}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
                <p className="text-xs font-semibold uppercase text-[#d8c6e8]">Due date sample</p>
                <p className="mt-1 text-lg font-semibold text-white">{sampleDueDate}</p>
              </div>
              <div className="grid gap-3 text-sm text-[#d8c6e8]">
                <p className="flex items-center gap-2"><CalendarDays size={16} className="text-[#C77DFF]" /> Due in {form.dueDays || 0} days</p>
                <p className="flex items-center gap-2"><Percent size={16} className="text-[#C77DFF]" /> {form.taxType || "Tax"} at {form.defaultTaxRate || 0}%</p>
                <p className="flex items-center gap-2"><Mail size={16} className="text-[#C77DFF]" /> {form.supportEmail || "support@example.com"}</p>
              </div>
              <button type="submit" disabled={saving} className="neon-button inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
                <Save size={16} />
                {saving ? "Saving..." : "Save Invoice Settings"}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-sky-300/20 bg-sky-400/10 p-5">
            <div className="mb-2 flex items-center gap-2 text-sky-100">
              <Settings2 size={18} />
              <p className="font-semibold">How this applies</p>
            </div>
            <p className="text-sm text-sky-100/85">
              The API returns the preview invoice number and due date from saved settings. The project currently has no invoice creation API yet, so the future invoice generation flow should call these settings before inserting new invoices.
            </p>
          </section>
        </aside>
      </form>
    </section>
  );
}
