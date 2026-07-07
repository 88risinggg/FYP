import { useEffect, useState } from "react";

import { getStoredSession } from "../../services/sessionService.js";
import { apiRequest } from "../../services/apiClient.js";

export default function StaffProfile({ onProfileSaved }) {
  const session = getStoredSession();
  const token = session?.token;
  const userId = session?.user?.userId;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    async function load() {
      try {
        setFetchError(null);
        const data = await apiRequest(`/api/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (mounted) setProfile(data);
      } catch (err) {
        console.error(err);
        if (mounted) setFetchError("Failed to load profile. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [userId, token]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
            <div className="h-10 rounded-md bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-6 py-5">
        <p className="text-sm text-red-200">{fetchError}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); setFetchError(null); window.location.reload(); }}
          className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toast notification — fixed position, prominent */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md rounded-xl border px-5 py-4 shadow-2xl backdrop-blur-sm animate-[slideDown_0.3s_ease-out] ${
          toast.type === "error"
            ? "border-red-400/30 bg-red-950/90 text-red-100"
            : "border-emerald-400/30 bg-emerald-950/90 text-emerald-100"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "error" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
            }`}>
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Personal Info */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-lg font-semibold text-white">Personal Info</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DisplayField label="Name" value={profile?.name || "-"} />
          <DisplayField label="Email" value={profile?.email || "-"} />
          <DisplayField label="Phone" value={profile?.phone || "-"} />
          <DisplayField label="Address" value={profile?.address || "-"} />
        </div>
      </div>

      {/* Bank Details */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-lg font-semibold text-white">Bank Details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DisplayField label="Bank" value={profile?.bank || "-"} />
          <DisplayField label="Account No." value={profile?.account_no || "-"} />
        </div>
      </div>

      {/* Employment Info (read-only) */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-lg font-semibold text-white">Employment Info</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DisplayField label="Department" value={profile?.department || "-"} />
          <DisplayField label="Base Salary" value={profile?.salary ? `$${Number(profile.salary).toFixed(2)}` : "-"} />
          <DisplayField label="Employee Code" value={profile?.employee_code || "-"} />
          <DisplayField label="Hire Date" value={profile?.hire_date ? new Date(profile.hire_date).toLocaleDateString() : "-"} />
          <DisplayField label="Date of Birth" value={profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "-"} />
        </div>
        <p className="mt-3 text-xs text-[#d8c6e8]/60">Managed by HR. Contact HR to request changes to employment details.</p>
      </div>

      {/* Single Edit Button */}
      <div>
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="rounded-lg bg-[#7B2FF7] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Edit Profile
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal
          profile={profile}
          token={token}
          userId={userId}
          onClose={() => setShowEditModal(false)}
          onSaved={(updatedProfile) => {
            setProfile(updatedProfile);
            setShowEditModal(false);
            showToast("Profile updated successfully. Relevant departments have been notified.");
            if (onProfileSaved) onProfileSaved();
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}
    </div>
  );
}

/* ─── Edit Profile Modal ─── */
function EditProfileModal({ profile, token, userId, onClose, onSaved, onError }) {
  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    address: profile?.address || "",
    bank: profile?.bank || "",
    account_no: profile?.account_no || ""
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  function validate() {
    const newErrors = {};

    if (!form.name?.trim()) newErrors.name = "Name is required";

    if (!form.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email format";
    }

    if (form.phone && !/^[0-9+\- ]{6,20}$/.test(form.phone)) {
      newErrors.phone = "Invalid phone number";
    }

    if (form.bank && !form.account_no?.trim()) {
      newErrors.account_no = "Account number is required when bank is provided";
    }

    if (form.account_no && !form.bank?.trim()) {
      newErrors.bank = "Bank name is required when account number is provided";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        bank: form.bank,
        account_no: form.account_no
      };

      const data = await apiRequest(`/api/profile/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      onSaved(data);
    } catch (err) {
      console.error(err);
      onError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-2xl border border-white/10 bg-[#12071f] p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <p className="text-lg font-semibold text-white">Edit Profile</p>
        <p className="mt-1 text-sm text-[#d8c6e8]">
          Update your personal and bank details. Relevant departments will be notified of changes.
        </p>

        <div className="mt-5 space-y-4">
          {/* Personal fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ModalField label="Name" name="name" value={form.name} onChange={handleChange} error={errors.name} />
            <ModalField label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ModalField label="Phone" name="phone" value={form.phone} onChange={handleChange} error={errors.phone} placeholder="e.g. +65 9123 4567" />
            <ModalField label="Address" name="address" value={form.address} onChange={handleChange} />
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#d8c6e8] mb-3">Bank Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModalField label="Bank Name" name="bank" value={form.bank} onChange={handleChange} error={errors.bank} placeholder="e.g. DBS, OCBC, UOB" />
              <ModalField label="Account Number" name="account_no" value={form.account_no} onChange={handleChange} error={errors.account_no} placeholder="e.g. 012-345678-9" />
            </div>
            <p className="mt-2 text-xs text-amber-300/70">Changing bank details will notify Finance/HR. Your next pay will be sent to the updated account.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-[#7B2FF7] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Components ─── */
function DisplayField({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#d8c6e8]">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function ModalField({ label, name, type = "text", value, onChange, error, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs text-[#d8c6e8]">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-white bg-transparent placeholder:text-white/20 ${
          error ? "border-red-400/60" : "border-white/10"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}
