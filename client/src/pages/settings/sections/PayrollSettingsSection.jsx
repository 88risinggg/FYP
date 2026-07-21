import { useEffect, useState } from "react";
import { Check, Loader2, Wallet, X } from "lucide-react";
import { fetchPayrollSettings, updatePayrollSettings } from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

export default function PayrollSettingsSection() {
  const [form, setForm] = useState({
    payroll_frequency: "monthly",
    salary_payment_day: 25,
    cpf_contribution: true,
    tax_settings: "",
    working_hours: 44,
    overtime_enabled: true,
    payroll_approval_required: true,
    payslip_template: "standard",
    payroll_lock: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchPayrollSettings();
      if (data && Object.keys(data).length > 0) {
        setForm((prev) => ({ ...prev, ...data, cpf_contribution: !!data.cpf_contribution, overtime_enabled: !!data.overtime_enabled, payroll_approval_required: !!data.payroll_approval_required, payroll_lock: !!data.payroll_lock }));
      }
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
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
      await updatePayrollSettings(form);
      showToast("Payroll settings saved");
      reportSettingsSaveResult(true);
    } catch (err) { showToast(err.message, "error"); reportSettingsSaveResult(false); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-64 rounded-lg bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Wallet size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Payroll Settings</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Configure payroll processing parameters.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SelectField label="Payroll Frequency" name="payroll_frequency" value={form.payroll_frequency} onChange={handleChange}
              options={[{ value: "weekly", label: "Weekly" }, { value: "bi-weekly", label: "Bi-Weekly" }, { value: "monthly", label: "Monthly" }]} />
            <Field label="Salary Payment Day" name="salary_payment_day" value={form.salary_payment_day} onChange={handleChange} type="number" />
            <Field label="Working Hours (per week)" name="working_hours" value={form.working_hours} onChange={handleChange} type="number" />
            <SelectField label="Payslip Template" name="payslip_template" value={form.payslip_template} onChange={handleChange}
              options={[{ value: "standard", label: "Standard" }, { value: "detailed", label: "Detailed" }, { value: "compact", label: "Compact" }]} />
            <div className="md:col-span-2 lg:col-span-3">
              <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">Tax Settings</label>
              <textarea name="tax_settings" value={form.tax_settings || ""} onChange={handleChange} rows={2}
                className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition resize-none focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30"
                placeholder="Tax configuration details..." />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Options</p>
            <ToggleRow label="CPF Contribution" name="cpf_contribution" checked={form.cpf_contribution} onChange={handleChange} />
            <ToggleRow label="Overtime Enabled" name="overtime_enabled" checked={form.overtime_enabled} onChange={handleChange} />
            <ToggleRow label="Payroll Approval Required" name="payroll_approval_required" checked={form.payroll_approval_required} onChange={handleChange} />
            <ToggleRow label="Payroll Lock" name="payroll_lock" checked={form.payroll_lock} onChange={handleChange} />
          </div>

          <button type="submit" data-settings-save disabled={saving}
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

function ToggleRow({ label, name, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3">
      <span className="text-sm text-[#251E1F]">{label}</span>
      <label className="relative cursor-pointer">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
        <div className="h-6 w-11 shrink-0 rounded-full bg-[#f0d2ca] transition peer-checked:bg-[#F38978]" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
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
