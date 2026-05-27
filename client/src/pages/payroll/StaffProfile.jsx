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

    return () => {
      mounted = false;
    };
  }, [userId, token]);

  function handleChange(e) {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: profile?.name,
        email: profile?.email,
        salary: profile?.salary,
        ssn: profile?.ssn,
        date_of_birth: profile?.date_of_birth,
        department: profile?.department
      };

      const data = await apiRequest(`/api/profile/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      setProfile(data);
      alert("Profile saved");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-[#d8c6e8]">Loading profile…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="text-xs text-[#d8c6e8]">Name</div>
          <input name="name" value={profile?.name || ""} onChange={handleChange} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-white" />
        </label>

        <label className="block">
          <div className="text-xs text-[#d8c6e8]">Email</div>
          <input name="email" value={profile?.email || ""} onChange={handleChange} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-white" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <div className="text-xs text-[#d8c6e8]">Salary</div>
          <input name="salary" type="number" value={profile?.salary ?? ""} onChange={handleChange} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-white" />
        </label>

        <label className="block">
          <div className="text-xs text-[#d8c6e8]">Date of Birth</div>
          <input name="date_of_birth" type="date" value={profile?.date_of_birth ?? ""} onChange={handleChange} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-white" />
        </label>

        <label className="block">
          <div className="text-xs text-[#d8c6e8]">SSN</div>
          <input name="ssn" value={profile?.ssn || ""} onChange={handleChange} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-white" />
        </label>
      </div>

      <label className="block">
        <div className="text-xs text-[#d8c6e8]">Department</div>
        <input name="department" value={profile?.department || ""} onChange={handleChange} className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-white" />
      </label>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-[#7B2FF7] px-4 py-2 font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
