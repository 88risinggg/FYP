import { useEffect, useState } from "react";

import { getStoredSession } from "../../services/sessionService.js";
import { apiRequest } from "../../services/apiClient.js";

export default function StaffProfile() {
  const session = getStoredSession();
  const token = session?.token;
  const userId = session?.user?.userId;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    async function load() {
      try {
        const data = await apiRequest(`/api/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (mounted) setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [userId, token]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function validate() {
    const newErrors = {};

    if (!profile?.name?.trim()) {
      newErrors.name = "Name is required";
    }

    if (!profile?.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      newErrors.email = "Invalid email format";
    }

    if (profile?.phone && !/^[0-9+\- ]{6,20}$/.test(profile.phone)) {
      newErrors.phone = "Invalid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSave() {
    if (!validate()) {
      showToast("Please fix the errors below", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: profile?.name,
        email: profile?.email,
        phone: profile?.phone,
        address: profile?.address
      };

      const data = await apiRequest(`/api/profile/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      setProfile(data);
      showToast("Profile saved successfully");
    } catch (err) {
      console.error(err);
      showToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-[#d8c6e8]">Loading profile…</div>;

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          toast.type === "error"
            ? "border-red-300/20 bg-red-400/10 text-red-100"
            : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
        }`}>
          {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput label="Name" name="name" value={profile?.name || ""} onChange={handleChange} error={errors.name} />
        <FieldInput label="Email" name="email" type="email" value={profile?.email || ""} onChange={handleChange} error={errors.email} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldInput label="Phone" name="phone" value={profile?.phone || ""} onChange={handleChange} error={errors.phone} />
        <ReadOnlyField label="Date of Birth" value={profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "-"} />
      </div>

      <FieldInput label="Address" name="address" value={profile?.address || ""} onChange={handleChange} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ReadOnlyField label="Department" value={profile?.department || "-"} />
        <ReadOnlyField label="Base Salary" value={profile?.salary ? `$${Number(profile.salary).toFixed(2)}` : "-"} />
        <ReadOnlyField label="Hire Date" value={profile?.hire_date ? new Date(profile.hire_date).toLocaleDateString() : "-"} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Bank" value={profile?.bank || "-"} />
        <ReadOnlyField label="Account No." value={profile?.account_no || "-"} />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#7B2FF7] px-4 py-2 font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
        <span className="text-xs text-[#d8c6e8]">Only name, email, phone, and address can be edited. Contact HR for other changes.</span>
      </div>
    </div>
  );
}

function FieldInput({ label, name, type = "text", value, onChange, error }) {
  return (
    <label className="block">
      <div className="text-xs text-[#d8c6e8]">{label}</div>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-white bg-transparent ${
          error ? "border-red-400/60" : "border-white/10"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <label className="block">
      <div className="text-xs text-[#d8c6e8]">{label}</div>
      <input
        value={value}
        readOnly
        className="mt-1 w-full cursor-not-allowed rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white/60"
      />
    </label>
  );
}
