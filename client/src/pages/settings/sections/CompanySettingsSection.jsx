import { useEffect, useState } from "react";
import { Building2, Camera, Check, Loader2, X } from "lucide-react";
import { fetchCompanySettings, updateCompanySettings } from "../../../services/settingsService.js";

export default function CompanySettingsSection() {
  const [form, setForm] = useState({
    company_logo: "",
    company_name: "",
    registration_number: "",
    gst_number: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    default_currency: "SGD",
    financial_year: "Jan - Dec",
    fiscal_start_date: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const data = await fetchCompanySettings();
      if (data && Object.keys(data).length > 0) {
        setForm((prev) => ({ ...prev, ...data }));
      }
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, company_logo: reader.result }));
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCompanySettings(form);
      showToast("Company settings saved");
    } catch (err) { showToast(err.message, "error"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-64 rounded-lg bg-white/[0.04]" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-white">Company Settings</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your organization details.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* Company Logo */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-[#F38978]/10 ring-2 ring-[#F38978]/25">
                {form.company_logo ? (
                  <img src={form.company_logo} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 size={24} className="text-[#F38978]" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#F38978] text-white shadow transition hover:bg-[#E77463]">
                <Camera size={11} />
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Company Logo</p>
              <p className="text-xs text-[#7b6660]">Upload your company logo (PNG, SVG)</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company Name" name="company_name" value={form.company_name} onChange={handleChange} />
            <Field label="Registration Number" name="registration_number" value={form.registration_number} onChange={handleChange} />
            <Field label="GST Number" name="gst_number" value={form.gst_number} onChange={handleChange} />
            <Field label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            <Field label="Email" name="email" value={form.email} onChange={handleChange} type="email" />
            <Field label="Website" name="website" value={form.website} onChange={handleChange} />
            <SelectField label="Default Currency" name="default_currency" value={form.default_currency} onChange={handleChange}
              options={[{ value: "SGD", label: "SGD" }, { value: "USD", label: "USD" }, { value: "MYR", label: "MYR" }]} />
            <Field label="Financial Year" name="financial_year" value={form.financial_year} onChange={handleChange} />
            <Field label="Fiscal Start Date" name="fiscal_start_date" value={form.fiscal_start_date} onChange={handleChange} type="date" />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">Address</label>
              <textarea name="address" value={form.address || ""} onChange={handleChange} rows={2}
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition resize-none focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
            </div>
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
      <input type={type} name={name} value={value || ""} onChange={onChange}
        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}</label>
      <select name={name} value={value} onChange={onChange}
        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30">
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#fff3ee]">{o.label}</option>)}
      </select>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-200" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}