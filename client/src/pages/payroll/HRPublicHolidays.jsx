import { useEffect, useState } from "react";
import { Calendar, Plus, Search, Edit2, Trash2, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import {
  getPublicHolidays,
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
} from "../../services/publicHolidayService.js";

function isHolidayActive(status) {
  return status === "Active" || status === 1 || status === "1";
}

function StatusBadge({ active }) {
  return active ? (
    <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
      Active
    </span>
  ) : (
    <span className="rounded-full border border-gray-300/30 bg-gray-300/10 px-3 py-1 text-xs font-semibold text-gray-300">
      Inactive
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function HRPublicHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    holiday_name: "",
    holiday_date: "",
    description: "",
    status: "Active",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  async function fetchHolidays() {
    setLoading(true);
    try {
      const data = await getPublicHolidays();
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load public holidays:", err);
      showToast("Failed to load public holidays.", "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function resetForm() {
    setFormData({ holiday_name: "", holiday_date: "", description: "", status: "Active" });
    setFormError("");
    setEditingId(null);
    setShowForm(false);
  }

  function handleAdd() {
    resetForm();
    setShowForm(true);
  }

  function handleEdit(holiday) {
    setEditingId(holiday.holiday_id);
    setFormData({
      holiday_name: holiday.holiday_name,
      holiday_date: holiday.holiday_date ? new Date(holiday.holiday_date).toISOString().split("T")[0] : "",
      description: holiday.description || "",
      status: holiday.status || "Active",
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    setFormError("");

    if (!formData.holiday_name.trim()) {
      setFormError("Holiday name is required.");
      return;
    }
    if (!formData.holiday_date) {
      setFormError("Holiday date is required.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updatePublicHoliday(editingId, formData);
        showToast("Public holiday updated successfully.");
      } else {
        await createPublicHoliday(formData);
        showToast("Public holiday created successfully.");
      }
      resetForm();
      await fetchHolidays();
    } catch (err) {
      const msg = err.message || "Failed to save public holiday.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    try {
      await deletePublicHoliday(id);
      showToast("Public holiday deleted successfully.");
      setDeleteConfirmId(null);
      await fetchHolidays();
    } catch (err) {
      showToast(err.message || "Failed to delete public holiday.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleStatus(holiday) {
    try {
      const newStatus = isHolidayActive(holiday.status) ? "Inactive" : "Active";
      await updatePublicHoliday(holiday.holiday_id, {
        holiday_name: holiday.holiday_name,
        holiday_date: new Date(holiday.holiday_date).toISOString().split("T")[0],
        description: holiday.description || "",
        status: newStatus,
      });
      showToast(`Holiday ${newStatus === "Active" ? "activated" : "deactivated"} successfully.`);
      await fetchHolidays();
    } catch (err) {
      showToast(err.message || "Failed to update status.", "error");
    }
  }

  // Filter holidays by search query
  const filtered = holidays.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.holiday_name.toLowerCase().includes(q) ||
      (h.description && h.description.toLowerCase().includes(q)) ||
      formatDate(h.holiday_date).toLowerCase().includes(q)
    );
  });

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-white/80 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "error"
              ? "border-red-400/30 bg-red-500/20 text-red-200"
              : "border-emerald-400/30 bg-emerald-500/20 text-emerald-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F38978]/10 text-[#F38978]">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#251E1F]">Public Holidays</h3>
            <p className="text-xs text-[#7b6660]">
              Manage public holidays — leave calculations exclude active holidays automatically.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2D7C83] to-[#F38978] px-4 py-2.5 text-sm font-semibold text-[#251E1F] shadow-lg shadow-[#F38978]/20 transition hover:opacity-90"
        >
          <Plus size={16} />
          Add Holiday
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7b6660]/50" />
        <input
          type="text"
          placeholder="Search holidays by name, description, or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 py-2.5 pl-10 pr-4 text-sm text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#2D7C83]/50 focus:ring-1 focus:ring-[#2D7C83]/30"
        />
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[#251E1F]">
            {editingId ? "Edit Public Holiday" : "Add New Public Holiday"}
          </h4>

          {formError && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7b6660]">
                Holiday Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.holiday_name}
                onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                placeholder="e.g. National Day"
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2.5 text-sm text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#2D7C83]/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7b6660]">
                Holiday Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.holiday_date}
                onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2.5 text-sm text-[#251E1F] outline-none focus:border-[#2D7C83]/50 [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#7b6660]">
              Description (optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              className="w-full rounded-lg border border-[#f0d2ca] bg-white/80 px-3 py-2.5 text-sm text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#2D7C83]/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[#7b6660]">Status:</label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: formData.status === "Active" ? "Inactive" : "Active" })}
              className="flex items-center gap-2 text-sm"
            >
              {formData.status === "Active" ? (
                <>
                  <ToggleRight size={22} className="text-emerald-400" />
                  <span className="text-emerald-300 text-xs font-medium">Active</span>
                </>
              ) : (
                <>
                  <ToggleLeft size={22} className="text-gray-400" />
                  <span className="text-gray-400 text-xs font-medium">Inactive</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <Check size={14} />
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 rounded-lg bg-white/80 px-4 py-2 text-sm font-medium text-[#7b6660] hover:bg-[#FDD9CD]/45"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Holidays Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#f0d2ca] bg-white/80 p-10 text-center">
          <Calendar size={32} className="mx-auto text-[#7b6660]/30" />
          <p className="mt-3 text-sm text-[#7b6660]/50">
            {searchQuery ? "No holidays match your search." : "No public holidays configured yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#f0d2ca] bg-white/80">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#f0d2ca]">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#7b6660]/60">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#7b6660]/60">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#7b6660]/60">Description</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#7b6660]/60">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#7b6660]/60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((holiday) => (
                <tr
                  key={holiday.holiday_id}
                  className="border-b border-[#f0d2ca] transition hover:bg-white/80"
                >
                  <td className="px-4 py-3 font-medium text-[#251E1F]">{holiday.holiday_name}</td>
                  <td className="px-4 py-3 text-[#7b6660]">{formatDate(holiday.holiday_date)}</td>
                  <td className="px-4 py-3 text-[#7b6660]/70">{holiday.description || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={isHolidayActive(holiday.status)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(holiday)}
                        title={isHolidayActive(holiday.status) ? "Deactivate" : "Activate"}
                        className="rounded-lg p-1.5 text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                      >
                        {isHolidayActive(holiday.status) ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} className="text-gray-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(holiday)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-[#7b6660] hover:bg-[#FDD9CD]/45 hover:text-[#251E1F]"
                      >
                        <Edit2 size={15} />
                      </button>
                      {deleteConfirmId === holiday.holiday_id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(holiday.holiday_id)}
                            disabled={deleting}
                            className="rounded-lg bg-red-500/20 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                          >
                            {deleting ? "..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-lg bg-white/80 px-2 py-1 text-xs font-medium text-[#7b6660] hover:bg-[#FDD9CD]/45"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(holiday.holiday_id)}
                          title="Delete"
                          className="rounded-lg p-1.5 text-[#7b6660] hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Footer */}
      <div className="flex items-center justify-between text-xs text-[#7b6660]/50">
        <span>
          {filtered.length} of {holidays.length} holiday{holidays.length !== 1 ? "s" : ""}
          {searchQuery ? " (filtered)" : ""}
        </span>
        <span>
          Active: {holidays.filter((h) => isHolidayActive(h.status)).length} | Inactive: {holidays.filter((h) => !isHolidayActive(h.status)).length}
        </span>
      </div>
    </div>
  );
}
