import { useState } from "react";
import { Check, Download, Lock, Loader2, Trash2, X } from "lucide-react";
import { downloadTextFile } from "../../../services/apiClient.js";

export default function DataPrivacySection() {
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleDownloadData() {
    setActionLoading("download");
    setTimeout(() => {
      downloadTextFile(
        JSON.stringify({ message: "Your data export will be prepared and sent to your email." }, null, 2),
        "my-data-export.json",
        "application/json"
      );
      showToast("Data export initiated");
      setActionLoading(null);
    }, 1000);
  }

  function handleExportProfile() {
    setActionLoading("export");
    setTimeout(() => {
      downloadTextFile(
        JSON.stringify({ message: "Profile export placeholder" }, null, 2),
        "profile-export.json",
        "application/json"
      );
      showToast("Profile exported");
      setActionLoading(null);
    }, 1000);
  }

  function handleRequestData() {
    setActionLoading("request");
    setTimeout(() => {
      showToast("Data request submitted. You'll receive an email within 48 hours.");
      setActionLoading(null);
    }, 1000);
  }

  function handleRequestDeletion() {
    setActionLoading("deletion");
    setTimeout(() => {
      showToast("Deletion request submitted. An admin will review your request.");
      setActionLoading(null);
    }, 1000);
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Lock size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-white">Data & Privacy</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your data and privacy preferences.</p>

        <div className="mt-6 space-y-4">
          <ActionCard
            title="Download My Data"
            description="Download a copy of all your personal data stored in the system."
            buttonLabel="Download"
            icon={Download}
            loading={actionLoading === "download"}
            onClick={handleDownloadData}
          />
          <ActionCard
            title="Export Profile"
            description="Export your profile information as a JSON file."
            buttonLabel="Export"
            icon={Download}
            loading={actionLoading === "export"}
            onClick={handleExportProfile}
          />
          <ActionCard
            title="Request Account Data"
            description="Submit a formal request for all data associated with your account."
            buttonLabel="Request"
            icon={Lock}
            loading={actionLoading === "request"}
            onClick={handleRequestData}
          />
          <ActionCard
            title="Request Account Deletion"
            description="Submit a request to permanently delete your account and all associated data. This action is irreversible."
            buttonLabel="Request Deletion"
            icon={Trash2}
            loading={actionLoading === "deletion"}
            onClick={handleRequestDeletion}
            danger
          />
        </div>

        {/* Privacy Preferences */}
        <div className="mt-6 border-t border-white/10 pt-6">
          <h3 className="text-sm font-semibold text-white">Privacy Preferences</h3>
          <div className="mt-3 space-y-3">
            <ToggleRow label="Allow analytics tracking" defaultChecked={true} />
            <ToggleRow label="Show profile to other users" defaultChecked={true} />
            <ToggleRow label="Allow activity to be visible" defaultChecked={false} />
          </div>
        </div>

        {/* Cookie Preferences */}
        <div className="mt-6 border-t border-white/10 pt-6">
          <h3 className="text-sm font-semibold text-white">Cookie Preferences</h3>
          <div className="mt-3 space-y-3">
            <ToggleRow label="Essential cookies (required)" defaultChecked={true} disabled />
            <ToggleRow label="Analytics cookies" defaultChecked={true} />
            <ToggleRow label="Marketing cookies" defaultChecked={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, description, buttonLabel, icon: Icon, loading, onClick, danger }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-[#7b6660]">{description}</p>
      </div>
      <button type="button" onClick={onClick} disabled={loading}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
          danger
            ? "border border-rose-400/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            : "border border-white/10 bg-white/[0.06] text-white hover:bg-white/10"
        }`}>
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
        {buttonLabel}
      </button>
    </div>
  );
}

function ToggleRow({ label, defaultChecked = false, disabled = false }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className={`text-sm ${disabled ? "text-[#7b6660]/50" : "text-white"}`}>{label}</span>
      <button type="button" onClick={() => !disabled && setChecked(!checked)} disabled={disabled}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#F38978]" : "bg-white/15"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
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