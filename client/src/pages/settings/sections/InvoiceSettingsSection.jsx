import { useEffect, useState } from "react";
import { Check, FileText, Loader2, X } from "lucide-react";
import { fetchInvoiceSettings, updateInvoiceSettings } from "../../../services/settingsService.js";

export default function InvoiceSettingsSection() {
  const [form, setForm] = useState({
    invoice_prefix: "INV",
    next_invoice_number: 1,
    default_due_days: 30,
    default_currency: "SGD",
    tax_rate: 9,
    payment_terms: "Net 30",
    auto_generate_pdf: true,
    auto_email_invoice: false,
    late_payment_reminder: true,
    invoice_footer: "",
    invoice_notes: "",
    invoice_template: "standard"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await fetchInvoiceSettings();
      if (data && Object.keys(data).length > 0) {
        setForm((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateInvoiceSettings(form);
      showToast("Invoice settings saved");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-64 rounded-lg bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Invoice Settings</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Configure default invoice generation parameters.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Invoice Prefix" name="invoice_prefix" value={form.invoice_prefix} onChange={handleChange} />
            <Field label="Next Invoice Number" name="next_invoice_number" value={form.next_invoice_number} onChange={handleChange} type="number" />
            <Field label="Default Due Days" name="default_due_days" value={form.default_due_days} onChange={handleChange} type="number" />
            <SelectField label="Default Currency" name="default_currency" value={form.default_currency} onChange={handleChange}
              options={[{ value: "SGD", label: "SGD" }, { value: "USD", label: "USD" }, { value: "MYR", label: "MYR" }, { value: "EUR", label: "EUR" }]} />
            <Field label="Tax Rate (%)" name="tax_rate" value={form.tax_rate} onChange={handleChange} type="number" />
            <Field label="Payment Terms" name="payment_terms" value={form.payment_terms} onChange={handleChange} />
            <SelectField label="Invoice Template" name="invoice_template" value={form.invoice_template} onChange={handleChange}
              options={[{ value: "standard", label: "Standard" }, { value: "modern", label: "Modern" }, { value: "minimal", label: "Minimal" }, { value: "professional", label: "Professional" }]} />
          </div>

          {/* Toggle Options */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Automation</p>
            <ToggleRow label="Auto Generate PDF" name="auto_generate_pdf" checked={form.auto_generate_pdf} onChange={handleChange} />
            <ToggleRow label="Auto Email Invoice" name="auto_email_invoice" checked={form.auto_email_invoice} onChange={handleChange} />
            <ToggleRow label="Late Payment Reminder" name="late_payment_reminder" checked={form.late_payment_reminder} onChange={handleChange} />
          </div>

          {/* Text Areas */}
          <div className="grid gap-4 md:grid-cols-2">
            <TextArea label="Invoice Footer" name="invoice_footer" value={form.invoice_footer} onChange={handleChange} />
            <TextArea label="Invoice Notes" name="invoice_notes" value={form.invoice_notes} onChange={handleChange} />
          </div>

          <button type="submit" disabled={saving}
            className="primary-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Save Settings
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange}
        className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}</label>
      <select name={name} value={value} onChange={onChange}
        className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30">
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#fff3ee]">{o.label}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, name, value, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}</label>
      <textarea name={name} value={value || ""} onChange={onChange} rows={3}
        className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition resize-none focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
    </div>
  );
}

function ToggleRow({ label, name, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3">
      <span className="text-sm text-[#251E1F]">{label}</span>
      <label className="relative cursor-pointer">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
        <div className="h-6 w-11 rounded-full bg-[#f0d2ca] transition peer-checked:bg-[#F38978]" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[22px]" />
      </label>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}