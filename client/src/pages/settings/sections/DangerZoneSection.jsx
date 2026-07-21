import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, LogOut, RotateCcw, Trash2, X, XCircle } from "lucide-react";
import {
  deactivateAccount,
  deleteAccount,
  fetchDeletionRequests,
  logoutAllSessions,
  resetSettings,
  reviewDeletionRequest
} from "../../../services/settingsService.js";
import { clearSession, getStoredSession } from "../../../services/sessionService.js";

const actionCopy = {
  deactivate: { title: "Deactivate Account", first: "Your account will be disabled and you will be signed out.", second: "Final confirmation: deactivate this account now?", confirm: "Deactivate" },
  delete: { title: "Request Account Deletion", first: "Enter your password to submit this request. Your account will remain active while it awaits admin review.", second: "Final confirmation: submit this deletion request to an administrator?", confirm: "Submit Request" },
  logout: { title: "Logout All Devices", first: "All active sessions across every device will be terminated.", second: "Final confirmation: sign out every device, including this one?", confirm: "Logout All" },
  reset: { title: "Reset Settings", first: "Your personal preferences, appearance, integrations and notification settings will return to defaults.", second: "Final confirmation: reset all personal settings now?", confirm: "Reset Settings" },
  approve: { title: "Approve Account Deletion", first: "Approval permanently deletes the selected user account.", second: "Final confirmation: permanently delete this user account?", confirm: "Approve & Delete" },
  reject: { title: "Reject Account Deletion", first: "The user account will remain active and the request will be closed.", second: "Final confirmation: reject this deletion request?", confirm: "Reject Request" }
};

export default function DangerZoneSection() {
  const isAdmin = getStoredSession()?.user?.role === "Admin";
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [password, setPassword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(isAdmin);

  useEffect(() => {
    if (isAdmin) loadRequests();
  }, [isAdmin]);

  async function loadRequests() {
    setRequestsLoading(true);
    try { setRequests((await fetchDeletionRequests()).requests || []); }
    catch (error) { showToast(error.message, "error"); }
    finally { setRequestsLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function openConfirmation(type, request = null) {
    setPassword("");
    setConfirmation({ type, stage: 1, request });
  }

  function continueConfirmation() {
    if (confirmation.type === "delete" && !password) {
      showToast("Password is required", "error");
      return;
    }
    setConfirmation((current) => ({ ...current, stage: 2 }));
  }

  async function executeAction() {
    setActionLoading(true);
    try {
      let result;
      if (confirmation.type === "deactivate") result = await deactivateAccount();
      if (confirmation.type === "delete") result = await deleteAccount(password);
      if (confirmation.type === "logout") result = await logoutAllSessions();
      if (confirmation.type === "reset") result = await resetSettings();
      if (["approve", "reject"].includes(confirmation.type)) {
        result = await reviewDeletionRequest(
          confirmation.request.request_id,
          confirmation.type === "approve" ? "approved" : "rejected"
        );
      }
      showToast(result?.message || "Action completed");
      const completedType = confirmation.type;
      setConfirmation(null);
      setPassword("");
      if (["approve", "reject"].includes(completedType)) await loadRequests();
      if (completedType === "reset") setTimeout(() => window.location.reload(), 1000);
      if (["deactivate", "logout"].includes(completedType)) {
        setTimeout(() => { clearSession(); window.location.replace("/login"); }, 1200);
      }
    } catch (error) { showToast(error.message, "error"); }
    finally { setActionLoading(false); }
  }

  const copy = confirmation ? actionCopy[confirmation.type] : null;

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}
      <div className="rounded-2xl border-2 border-rose-500/30 bg-rose-500/[0.04] p-6 shadow-lg shadow-rose-500/5">
        <div className="flex items-center gap-3"><AlertTriangle size={20} className="text-rose-400" /><h2 className="text-xl font-semibold text-rose-700">Danger Zone</h2></div>
        <p className="mt-1 text-sm text-rose-700/70">Sensitive actions require two confirmations before they run.</p>
        <div className="mt-6 space-y-4">
          <DangerAction icon={XCircle} title="Deactivate Account" description="Temporarily disable your account. Contact an administrator to reactivate it." buttonLabel="Deactivate" onClick={() => openConfirmation("deactivate")} />
          <DangerAction icon={Trash2} title="Request Account Deletion" description="Submit a deletion request. Only an administrator can approve and delete the account." buttonLabel="Request Deletion" onClick={() => openConfirmation("delete")} />
          <DangerAction icon={LogOut} title="Logout All Devices" description="Terminate active sessions across all devices." buttonLabel="Logout All" onClick={() => openConfirmation("logout")} />
          <DangerAction icon={RotateCcw} title="Reset Settings" description="Reset your personal settings to their defaults." buttonLabel="Reset" onClick={() => openConfirmation("reset")} />
        </div>
      </div>

      {isAdmin && (
        <div className="app-panel rounded-2xl p-6">
          <div className="flex items-center gap-3"><Trash2 size={19} className="text-[#d98686]" /><h3 className="text-lg font-semibold text-[#251E1F]">Account Deletion Approvals</h3></div>
          <p className="mt-1 text-sm text-[#7b6660]">Only administrators can approve permanent account deletion.</p>
          <div className="mt-5 space-y-3">
            {requestsLoading ? <div className="h-24 animate-pulse rounded-xl bg-[#FDD9CD]/30" /> : null}
            {!requestsLoading && !requests.filter((request) => request.status === "pending").length ? <p className="rounded-xl border border-[#ead3cc] bg-[#fff3ee]/60 p-4 text-sm text-[#7b6660]">No pending deletion requests.</p> : null}
            {requests.filter((request) => request.status === "pending").map((request) => (
              <div key={request.request_id} className="flex flex-col gap-3 rounded-xl border border-[#ead3cc] bg-[#fff3ee]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-sm font-semibold text-[#251E1F]">{request.user_name}</p><p className="truncate text-xs text-[#7b6660]">{request.user_email} · Requested {new Date(request.requested_at).toLocaleString()}</p></div>
                <div className="flex gap-2"><button type="button" onClick={() => openConfirmation("reject", request)} className="flex-1 rounded-lg border border-[#ead3cc] bg-white px-3 py-2 text-xs font-semibold text-[#7b6660] sm:flex-none">Reject</button><button type="button" onClick={() => openConfirmation("approve", request)} className="flex-1 rounded-lg bg-[#d98686] px-3 py-2 text-xs font-semibold text-white sm:flex-none">Approve</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#251E1F]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="app-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3"><AlertTriangle size={20} className="text-rose-500" /><h3 className="text-lg font-semibold text-[#251E1F]">{copy.title}</h3></div>
            <span className="mt-4 inline-flex rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700">Confirmation {confirmation.stage} of 2</span>
            <p className="mt-3 text-sm leading-6 text-[#7b6660]">{confirmation.stage === 1 ? copy.first : copy.second}</p>
            {confirmation.request && <p className="mt-3 rounded-xl bg-[#fff3ee] p-3 text-sm font-medium text-[#251E1F]">{confirmation.request.user_name} · {confirmation.request.user_email}</p>}
            {confirmation.type === "delete" && confirmation.stage === 1 && <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="mt-4 w-full rounded-xl border border-[#ead3cc] bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400" />}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setConfirmation(null); setPassword(""); }} disabled={actionLoading} className="rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660]">Cancel</button>
              <button type="button" onClick={confirmation.stage === 1 ? continueConfirmation : executeAction} disabled={actionLoading} className="rounded-xl bg-[#d98686] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{actionLoading ? <Loader2 size={15} className="mx-auto animate-spin" /> : confirmation.stage === 1 ? "Continue" : copy.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerAction({ icon: Icon, title, description, buttonLabel, onClick }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-rose-500/15 bg-rose-500/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Icon size={18} className="mt-0.5 shrink-0 text-rose-400" /><div><p className="text-sm font-medium text-[#251E1F]">{title}</p><p className="mt-0.5 text-xs text-rose-700/60">{description}</p></div></div><button type="button" onClick={onClick} className="w-full shrink-0 rounded-lg border border-rose-400/30 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/25 sm:w-auto">{buttonLabel}</button></div>;
}

function Toast({ toast }) {
  return <div className={`fixed right-6 top-24 z-[80] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"}`}><div className="flex items-center gap-2">{toast.type === "error" ? <X size={16} /> : <Check size={16} />}<span className="text-sm font-medium">{toast.message}</span></div></div>;
}
