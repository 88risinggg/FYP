/**
 * EVALUATION HEADER
 * FEATURE: SETTINGS - SHARED
 * PURPOSE: Implements the Data Privacy Section screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { Check, Download, Lock, Loader2, Trash2, X } from "lucide-react";
import { downloadTextFile } from "../../../services/apiClient.js";
import {
  deleteAccount,
  exportPersonalData,
  fetchPrivacySettings,
  fetchProfile,
  requestAccountData,
  updatePrivacySettings
} from "../../../services/settingsService.js";
import { reportSettingsSaveResult } from "../../../services/settingsEvents.js";

const defaults = {
  analytics_tracking: true,
  profile_visible: true,
  activity_visible: false,
  analytics_cookies: true,
  marketing_cookies: false
};

export default function DataPrivacySection() {
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [modal, setModal] = useState(null);
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchPrivacySettings()
      .then((data) => setPreferences(Object.fromEntries(Object.entries(defaults).map(([key]) => [key, Boolean(data[key])]))))
      .catch((error) => showToast(error.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function toggle(key) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  async function savePreferences() {
    setActionLoading("save");
    try {
      await updatePrivacySettings(preferences);
      showToast("Privacy preferences saved");
      reportSettingsSaveResult(true);
    } catch (error) {
      showToast(error.message, "error");
      reportSettingsSaveResult(false);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDownloadData() {
    setActionLoading("download");
    try {
      const data = await exportPersonalData();
      downloadTextFile(JSON.stringify(data, null, 2), `paynivo-personal-data-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      showToast("Personal data downloaded");
    } catch (error) { showToast(error.message, "error"); }
    finally { setActionLoading(null); }
  }

  async function handleExportProfile() {
    setActionLoading("export");
    try {
      const profile = await fetchProfile();
      downloadTextFile(JSON.stringify(profile, null, 2), "paynivo-profile.json", "application/json");
      showToast("Profile exported");
    } catch (error) { showToast(error.message, "error"); }
    finally { setActionLoading(null); }
  }

  async function confirmRequest() {
    if (modal === "deletion" && !password) {
      showToast("Enter your password to request account deletion", "error");
      return;
    }
    setActionLoading(modal);
    try {
      const result = modal === "deletion" ? await deleteAccount(password) : await requestAccountData();
      showToast(result.message);
      setModal(null);
      setPassword("");
    } catch (error) { showToast(error.message, "error"); }
    finally { setActionLoading(null); }
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="h-80 animate-pulse rounded-xl bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3"><Lock size={20} className="text-[#F38978]" /><h2 className="text-xl font-semibold text-[#251E1F]">Data & Privacy</h2></div>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your data and privacy preferences.</p>

        <div className="mt-6 space-y-4">
          <ActionCard title="Download My Data" description="Download a copy of your personal data and saved preferences." buttonLabel="Download" icon={Download} loading={actionLoading === "download"} onClick={handleDownloadData} />
          <ActionCard title="Export Profile" description="Export your profile information as a JSON file." buttonLabel="Export" icon={Download} loading={actionLoading === "export"} onClick={handleExportProfile} />
          <ActionCard title="Request Account Data" description="Submit a formal request for all data associated with your account." buttonLabel="Request" icon={Lock} loading={actionLoading === "data-request"} onClick={() => setModal("data-request")} />
          <ActionCard title="Request Account Deletion" description="Submit an account deletion request for administrator review and approval." buttonLabel="Request Deletion" icon={Trash2} loading={actionLoading === "deletion"} onClick={() => setModal("deletion")} danger />
        </div>

        <PreferenceGroup title="Privacy Preferences">
          <ToggleRow label="Allow analytics tracking" checked={preferences.analytics_tracking} onChange={() => toggle("analytics_tracking")} />
          <ToggleRow label="Show profile to other users" checked={preferences.profile_visible} onChange={() => toggle("profile_visible")} />
          <ToggleRow label="Allow activity to be visible" checked={preferences.activity_visible} onChange={() => toggle("activity_visible")} />
        </PreferenceGroup>
        <PreferenceGroup title="Cookie Preferences">
          <ToggleRow label="Essential cookies (required)" checked disabled />
          <ToggleRow label="Analytics cookies" checked={preferences.analytics_cookies} onChange={() => toggle("analytics_cookies")} />
          <ToggleRow label="Marketing cookies" checked={preferences.marketing_cookies} onChange={() => toggle("marketing_cookies")} />
        </PreferenceGroup>
        <button type="button" data-settings-save onClick={savePreferences} disabled={actionLoading === "save"}>Save privacy preferences</button>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#251E1F]/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="app-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#251E1F]">{modal === "deletion" ? "Request account deletion?" : "Submit formal data request?"}</h3>
            <p className="mt-2 text-sm leading-6 text-[#7b6660]">
              {modal === "deletion" ? "Your account will not be deleted now. An administrator must review and approve this request first." : "An administrator will receive and process your formal account-data request."}
            </p>
            {modal === "deletion" && <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="mt-4 w-full rounded-xl border border-[#ead3cc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#F38978]" />}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setModal(null); setPassword(""); }} className="rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660]">Cancel</button>
              <button type="button" onClick={confirmRequest} disabled={Boolean(actionLoading)} className={modal === "deletion" ? "rounded-xl bg-[#d98686] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" : "settings-save-button rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"}>
                {actionLoading ? "Submitting..." : "Confirm Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreferenceGroup({ title, children }) {
  return <div className="mt-6 border-t border-[#ead3cc] pt-6"><h3 className="text-sm font-semibold text-[#251E1F]">{title}</h3><div className="mt-3 space-y-3">{children}</div></div>;
}

function ActionCard({ title, description, buttonLabel, icon: Icon, loading, onClick, danger }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium text-[#251E1F]">{title}</p><p className="mt-0.5 text-xs text-[#7b6660]">{description}</p></div><button type="button" onClick={onClick} disabled={loading} className={`inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition disabled:opacity-50 sm:w-auto ${danger ? "border border-rose-400/20 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20" : "border border-[#ead3cc] bg-white text-[#251E1F] hover:bg-[#FDD9CD]/50"}`}>{loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}{buttonLabel}</button></div>;
}

function ToggleRow({ label, checked, onChange, disabled = false }) {
  return <div className="flex items-center justify-between rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-3"><span className={`min-w-0 text-sm ${disabled ? "text-[#7b6660]/50" : "text-[#251E1F]"}`}>{label}</span><button type="button" data-settings-control onClick={onChange} disabled={disabled} className={`relative ml-3 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#F38978]" : "bg-[#f0d2ca]"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}><span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} /></button></div>;
}

function Toast({ toast }) {
  return <div className={`fixed right-6 top-24 z-[80] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"}`}><div className="flex items-center gap-2">{toast.type === "error" ? <X size={16} /> : <Check size={16} />}<span className="text-sm font-medium">{toast.message}</span></div></div>;
}
