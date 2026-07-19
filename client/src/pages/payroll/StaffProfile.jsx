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

  // Emergency contacts state
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', is_primary: false });
  const [contactError, setContactError] = useState('');

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

    async function loadContacts() {
      try {
        const data = await apiRequest(`/api/profile/${userId}/emergency-contacts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (mounted) setContacts(data);
      } catch (err) {
        console.error("Failed to load emergency contacts:", err);
        if (mounted) setContacts([]);
      } finally {
        if (mounted) setContactsLoading(false);
      }
    }

    load();
    loadContacts();
    return () => { mounted = false; };
  }, [userId, token]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Emergency contact helpers
  async function fetchContacts() {
    try {
      const data = await apiRequest(`/api/profile/${userId}/emergency-contacts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  }

  function resetContactForm() {
    setContactForm({ name: '', relationship: '', phone: '', is_primary: false });
    setContactError('');
    setShowAddForm(false);
    setEditingContact(null);
  }

  function validateContactPhone(phone) {
    return /^[0-9+\-() ]{6,20}$/.test(phone);
  }

  async function handleSaveContact() {
    setContactError('');

    if (!contactForm.name.trim()) { setContactError('Name is required'); return; }
    if (!contactForm.relationship.trim()) { setContactError('Relationship is required'); return; }
    if (!contactForm.phone.trim()) { setContactError('Phone is required'); return; }
    if (!validateContactPhone(contactForm.phone)) { setContactError('Invalid phone format (6–20 digits, +, -, (), spaces)'); return; }

    try {
      if (editingContact) {
        await apiRequest(`/api/profile/${userId}/emergency-contacts/${editingContact.contact_id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(contactForm)
        });
        showToast("Emergency contact updated");
      } else {
        await apiRequest(`/api/profile/${userId}/emergency-contacts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(contactForm)
        });
        showToast("Emergency contact added");
      }
      resetContactForm();
      fetchContacts();
    } catch (err) {
      const msg = err?.message || "Failed to save contact";
      setContactError(msg);
    }
  }

  async function handleDeleteContact(contactId) {
    if (!window.confirm("Delete this emergency contact?")) return;
    try {
      await apiRequest(`/api/profile/${userId}/emergency-contacts/${contactId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast("Emergency contact deleted");
      fetchContacts();
    } catch (err) {
      showToast("Failed to delete contact", "error");
    }
  }

  function handleEditContact(contact) {
    setContactForm({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      is_primary: contact.is_primary === 1
    });
    setEditingContact(contact);
    setShowAddForm(false);
    setContactError('');
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded bg-[#f0d2ca]/60 animate-pulse" />
            <div className="h-10 rounded-md bg-[#f0d2ca]/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-xl border border-red-300/40 bg-red-50 px-6 py-5">
        <p className="text-sm text-red-700">{fetchError}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); setFetchError(null); window.location.reload(); }}
          className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
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
            ? "border-red-300/40 bg-red-50 text-red-700"
            : "border-emerald-300/40 bg-emerald-50 text-emerald-700"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "error" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
            }`}>
              {toast.type === "error" ? "✕" : "✓"}
            </span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Personal Info */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-5">
        <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">Personal Info</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DisplayField label="Name" value={profile?.name || "-"} />
          <DisplayField label="Email" value={profile?.email || "-"} />
          <DisplayField label="Phone" value={profile?.phone || "-"} />
          <DisplayField label="Address" value={profile?.address || "-"} />
        </div>
      </div>

      {/* Bank Details */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-5">
        <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">Bank Details</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DisplayField label="Bank" value={profile?.bank || "-"} />
          <DisplayField label="Account No." value={profile?.account_no || "-"} />
        </div>
      </div>

      {/* Employment Info (read-only) */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-5">
        <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">Employment Info</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DisplayField label="Department" value={profile?.department || "-"} />
          <DisplayField label="Base Salary" value={profile?.salary ? `$${Number(profile.salary).toFixed(2)}` : "-"} />
          <DisplayField label="Employee Code" value={profile?.employee_code || "-"} />
          <DisplayField label="Hire Date" value={profile?.hire_date ? new Date(profile.hire_date).toLocaleDateString() : "-"} />
          <DisplayField label="Date of Birth" value={profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "-"} />
        </div>
        <p className="mt-3 text-xs text-[#7b6660]/60">Managed by HR. Contact HR to request changes to employment details.</p>
      </div>

      {/* Emergency Contacts */}
      <div className="rounded-xl border border-[#f0d2ca] bg-white/800 p-5">
        <h3 className="mb-3 text-lg font-semibold text-[#251E1F]">Emergency Contacts</h3>

        {contactsLoading ? (
          <div className="space-y-3">
            <div className="h-4 rounded bg-[#f0d2ca]/60 animate-pulse" style={{ width: "70%" }} />
            <div className="h-4 rounded bg-[#f0d2ca]/40 animate-pulse" style={{ width: "50%" }} />
          </div>
        ) : contacts.length === 0 && !showAddForm && !editingContact ? (
          <p className="text-sm text-[#7b6660]/60">No emergency contacts added yet</p>
        ) : (
          <div className="space-y-3">
            {contacts.map(contact => (
              <div key={contact.contact_id} className="rounded-lg border border-[#f0d2ca] bg-black/10 px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#251E1F]">
                      {contact.name}
                      <span className="ml-2 text-xs text-[#7b6660]/60">{contact.relationship}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#7b6660]">{contact.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.is_primary === 1 && (
                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-700">Primary</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditContact(contact)}
                      className="text-xs text-[#7b6660] hover:text-[#251E1F]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.contact_id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Contact button — only show if less than 3 and no form open */}
        {!showAddForm && !editingContact && contacts.length < 3 && !contactsLoading && (
          <button
            type="button"
            onClick={() => { resetContactForm(); setShowAddForm(true); }}
            className="mt-3 rounded-lg border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
          >
            + Add Contact
          </button>
        )}

        {/* Add/Edit form */}
        {(showAddForm || editingContact) && (
          <div className="mt-4 rounded-lg border border-[#f0d2ca] bg-black/10 p-4 space-y-3">
            <p className="text-sm font-medium text-[#251E1F]">{editingContact ? 'Edit Contact' : 'Add Emergency Contact'}</p>

            {contactError && (
              <p className="text-xs text-red-600">{contactError}</p>
            )}

            <label className="block">
              <span className="text-xs text-[#7b6660]">Name</span>
              <input
                type="text"
                value={contactForm.name}
                onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Contact full name"
                className="mt-1 w-full rounded-md border border-[#f0d2ca] px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#7b6660]">Relationship</span>
              <input
                type="text"
                value={contactForm.relationship}
                onChange={e => setContactForm(prev => ({ ...prev, relationship: e.target.value }))}
                placeholder="e.g. Spouse, Parent, Sibling"
                className="mt-1 w-full rounded-md border border-[#f0d2ca] px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[#7b6660]">Phone</span>
              <input
                type="text"
                value={contactForm.phone}
                onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+65 9123 4567"
                className="mt-1 w-full rounded-md border border-[#f0d2ca] px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20"
              />
              <p className="mt-1 text-[10px] text-[#7b6660]/50">Singapore format: +65 XXXX XXXX</p>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={contactForm.is_primary}
                onChange={e => setContactForm(prev => ({ ...prev, is_primary: e.target.checked }))}
                className="rounded border-[#ead3cc] bg-transparent"
              />
              <span className="text-xs text-[#7b6660]">Set as primary contact</span>
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={resetContactForm}
                className="flex-1 rounded-lg border border-[#f0d2ca] bg-white/800 px-4 py-2 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                className="flex-1 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-[#251E1F] hover:brightness-110"
              >
                {editingContact ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single Edit Button */}
      <div>
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-[#251E1F] hover:brightness-110"
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
      <div className="rounded-2xl border border-[#f0d2ca] bg-[#fff3ee] p-6 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <p className="text-lg font-semibold text-[#251E1F]">Edit Profile</p>
        <p className="mt-1 text-sm text-[#7b6660]">
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
          <div className="border-t border-[#f0d2ca] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#7b6660] mb-3">Bank Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModalField label="Bank Name" name="bank" value={form.bank} onChange={handleChange} error={errors.bank} placeholder="e.g. DBS, OCBC, UOB" />
              <ModalField label="Account Number" name="account_no" value={form.account_no} onChange={handleChange} error={errors.account_no} placeholder="e.g. 012-345678-9" />
            </div>
            <p className="mt-2 text-xs text-amber-700/70">Changing bank details will notify Finance/HR. Your next pay will be sent to the updated account.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#f0d2ca] bg-white/800 px-4 py-2.5 text-sm font-medium text-[#251E1F] hover:bg-[#FDD9CD]/45"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-semibold text-[#251E1F] hover:brightness-110 disabled:opacity-60"
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
    <div className="rounded-lg border border-[#f0d2ca] bg-black/10 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#7b6660]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#251E1F]">{value}</p>
    </div>
  );
}

function ModalField({ label, name, type = "text", value, onChange, error, placeholder }) {
  return (
    <label className="block">
      <span className="text-xs text-[#7b6660]">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-md border px-3 py-2 text-[#251E1F] bg-transparent placeholder:text-[#251E1F]/20 ${
          error ? "border-red-400/60" : "border-[#f0d2ca]"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </label>
  );
}
