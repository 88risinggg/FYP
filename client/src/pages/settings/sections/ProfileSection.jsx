import { useEffect, useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { fetchProfile, updateProfile } from "../../../services/settingsService.js";

export default function ProfileSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: "",
    display_name: "",
    email: "",
    mobile: "",
    job_title: "",
    department: "",
    preferred_language: "en",
    timezone: "Asia/Singapore",
    date_format: "DD/MM/YYYY",
    currency: "SGD",
    profile_picture: ""
  });
  const [readOnly, setReadOnly] = useState({
    employee_id: "",
    role_name: "",
    company_name: ""
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await fetchProfile();
      setForm({
        name: data.name || "",
        display_name: data.display_name || "",
        email: data.email || "",
        mobile: data.mobile || "",
        job_title: data.job_title || "",
        department: data.department || "",
        preferred_language: data.preferred_language || "en",
        timezone: data.timezone || "Asia/Singapore",
        date_format: data.date_format || "DD/MM/YYYY",
        currency: data.currency || "SGD",
        profile_picture: data.profile_picture || ""
      });
      setReadOnly({
        employee_id: data.employee_id || "N/A",
        role_name: data.role_name || "N/A",
        company_name: data.company_name || "N/A"
      });
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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, profile_picture: reader.result }));
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("Full Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      showToast("Profile updated successfully");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
          toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="app-panel rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-[#251E1F]">Profile</h2>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your personal information and preferences.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F38978]/15 ring-2 ring-[#F38978]/30">
                {form.profile_picture ? (
                  <img src={form.profile_picture} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-[#F38978]">{form.name?.charAt(0) || "U"}</span>
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#F38978] text-[#251E1F] shadow-lg transition hover:bg-[#E77463]">
                <Camera size={13} />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-[#251E1F]">Profile Picture</p>
              <p className="text-xs text-[#7b6660]">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name" name="name" value={form.name} onChange={handleChange} required />
            <Field label="Display Name" name="display_name" value={form.display_name} onChange={handleChange} />
            <Field label="Email" name="email" value={form.email} onChange={handleChange} type="email" />
            <Field label="Mobile Number" name="mobile" value={form.mobile} onChange={handleChange} />
            <Field label="Job Title" name="job_title" value={form.job_title} onChange={handleChange} />
            <Field label="Department" name="department" value={form.department} onChange={handleChange} />
            <SelectField label="Preferred Language" name="preferred_language" value={form.preferred_language} onChange={handleChange}
              options={[{ value: "en", label: "English" }, { value: "zh", label: "Chinese" }, { value: "ms", label: "Malay" }, { value: "ta", label: "Tamil" }]} />
            <SelectField label="Time Zone" name="timezone" value={form.timezone} onChange={handleChange}
              options={[{ value: "Asia/Singapore", label: "Asia/Singapore (GMT+8)" }, { value: "Asia/Hong_Kong", label: "Asia/Hong Kong (GMT+8)" }, { value: "UTC", label: "UTC (GMT+0)" }]} />
            <SelectField label="Date Format" name="date_format" value={form.date_format} onChange={handleChange}
              options={[{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }, { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }]} />
            <SelectField label="Currency" name="currency" value={form.currency} onChange={handleChange}
              options={[{ value: "SGD", label: "SGD - Singapore Dollar" }, { value: "USD", label: "USD - US Dollar" }, { value: "MYR", label: "MYR - Malaysian Ringgit" }]} />
          </div>

          {/* Read-only Fields */}
          <div className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F38978]/70">Read-only Information</p>
            <div className="grid gap-4 md:grid-cols-3">
              <ReadOnlyField label="Employee ID" value={readOnly.employee_id} />
              <ReadOnlyField label="User Role" value={readOnly.role_name} />
              <ReadOnlyField label="Company Name" value={readOnly.company_name} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="primary-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save Changes
            </button>
            <button type="button" onClick={loadProfile}
              className="rounded-xl border border-[#ead3cc] bg-white px-5 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", required = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}{required && <span className="text-rose-400"> *</span>}</label>
      <input type={type} name={name} value={value} onChange={onChange} required={required}
        className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition placeholder:text-[#7b6660]/40 focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30" />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#7b6660]">{label}</label>
      <select name={name} value={value} onChange={onChange}
        className="w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm text-[#251E1F] outline-none transition focus:border-[#F38978]/50 focus:ring-1 focus:ring-[#F38978]/30">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#fff3ee]">{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[#7b6660]/70">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#251E1F]">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="app-panel rounded-2xl p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 rounded bg-[#FDD9CD]/50" />
        <div className="h-4 w-64 rounded bg-white" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-white" />
              <div className="h-10 rounded-lg bg-[#FDD9CD]/30" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}