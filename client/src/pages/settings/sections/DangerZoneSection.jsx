import { useState } from "react";
import { AlertTriangle, Check, Loader2, LogOut, RotateCcw, Trash2, X, XCircle } from "lucide-react";
import { deactivateAccount, deleteAccount, logoutAllSessions } from "../../../services/settingsService.js";
import { clearSession } from "../../../services/sessionService.js";

export default function DangerZoneSection() {
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null); // "deactivate" | "delete" | "logout" | "reset"
  const [password, setPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDeactivate() {
    setActionLoading(true);
    try {
      await deactivateAccount();
      showToast("Account deactivated");
      setModal(null);
      setTimeout(() => {
        clearSession();
        window.location.replace("/login");
      }, 1500);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(false); }
  }

  async function handleDelete() {
    if (!password) {
      showToast("Password is required", "error");
      return;
    }
    setActionLoading(true);
    try {
      await deleteAccount(password);
      showToast("Account deleted");
      setModal(null);
      setTimeout(() => {
        clearSession();
        window.location.replace("/login");
      }, 1500);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(false); }
  }

  async function handleLogoutAll() {
    setActionLoading(true);
    try {
      await logoutAllSessions();
      showToast("All sessions terminated");
      setModal(null);
      setTimeout(() => {
        clearSession();
        window.location.replace("/login");
      }, 1500);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(false); }
  }

  function handleReset() {
    setActionLoading(true);
    setTimeout(() => {
      showToast("Settings reset to defaults");
      setModal(null);
      setActionLoading(false);
    }, 1000);
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="rounded-2xl border-2 border-rose-500/30 bg-rose-500/[0.04] p-6 shadow-lg shadow-rose-500/5">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-rose-400" />
          <h2 className="text-xl font-semibold text-rose-200">Danger Zone</h2>
        </div>
        <p className="mt-1 text-sm text-rose-300/70">Irreversible and destructive actions. Please be certain.</p>

        <div className="mt-6 space-y-4">
          <DangerAction
            icon={XCircle}
            title="Deactivate Account"
            description="Temporarily disable your account. You can reactivate by contacting support."
            buttonLabel="Deactivate"
            onClick={() => setModal("deactivate")}
          />
          <DangerAction
            icon={Trash2}
            title="Delete Account"
            description="Permanently delete your account and all associated data. This cannot be undone."
            buttonLabel="Delete Account"
            onClick={() => setModal("delete")}
          />
          <DangerAction
            icon={LogOut}
            title="Logout All Devices"
            description="Terminate all active sessions across all devices."
            buttonLabel="Logout All"
            onClick={() => setModal("logout")}
          />
          <DangerAction
            icon={RotateCcw}
            title="Reset Settings"
            description="Reset all settings to their default values."
            buttonLabel="Reset"
            onClick={() => setModal("reset")}
          />
        </div>
      </div>

      {/* Confirmation Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-rose-500/20 bg-[#fff3ee] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-rose-400" />
              <h3 className="text-lg font-semibold text-white">
                {modal === "deactivate" && "Deactivate Account"}
                {modal === "delete" && "Delete Account"}
                {modal === "logout" && "Logout All Devices"}
                {modal === "reset" && "Reset Settings"}
              </h3>
            </div>
            <p className="mt-3 text-sm text-[#7b6660]">
              {modal === "deactivate" && "Your account will be deactivated immediately. Are you sure?"}
              {modal === "delete" && "This will permanently delete your account and all data. Enter your password to confirm."}
              {modal === "logout" && "All sessions will be terminated. You will be logged out everywhere."}
              {modal === "reset" && "All your settings will be reset to defaults. This cannot be undone."}
            </p>

            {modal === "delete" && (
              <input type="password" placeholder="Enter your password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-4 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-rose-400/50" />
            )}

            <div className="mt-5 flex gap-3">
              <button type="button" disabled={actionLoading}
                onClick={() => {
                  if (modal === "deactivate") handleDeactivate();
                  else if (modal === "delete") handleDelete();
                  else if (modal === "logout") handleLogoutAll();
                  else if (modal === "reset") handleReset();
                }}
                className="flex-1 rounded-xl bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50">
                {actionLoading ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Confirm"}
              </button>
              <button type="button" onClick={() => { setModal(null); setPassword(""); }}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-white/10">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerAction({ icon: Icon, title, description, buttonLabel, onClick }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rose-500/15 bg-rose-500/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-rose-400" />
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 text-xs text-rose-300/60">{description}</p>
        </div>
      </div>
      <button type="button" onClick={onClick}
        className="shrink-0 rounded-lg border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25">
        {buttonLabel}
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