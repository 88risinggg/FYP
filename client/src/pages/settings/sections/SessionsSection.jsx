import { useEffect, useState } from "react";
import { Check, Loader2, LogOut, Monitor, Smartphone, X } from "lucide-react";
import { fetchSessions, terminateSession, logoutAllSessions } from "../../../services/settingsService.js";

export default function SessionsSection() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch (err) { showToast(err.message, "error"); }
    finally { setLoading(false); }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleTerminate(sessionId) {
    setActionLoading(sessionId);
    try {
      await terminateSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      showToast("Session terminated");
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(null); }
  }

  async function handleLogoutAll() {
    setActionLoading("all");
    try {
      await logoutAllSessions();
      setSessions([]);
      showToast("All sessions terminated");
      setConfirmLogoutAll(false);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(null); }
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  }

  if (loading) {
    return <div className="app-panel rounded-2xl p-6"><div className="animate-pulse h-48 rounded-lg bg-[#FDD9CD]/30" /></div>;
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor size={20} className="text-[#F38978]" />
            <h2 className="text-xl font-semibold text-[#251E1F]">Login Sessions</h2>
          </div>
          <button type="button" onClick={() => setConfirmLogoutAll(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20">
            <LogOut size={13} /> Logout All Devices
          </button>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">View and manage your active login sessions.</p>

        {sessions.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[#ead3cc] bg-[#fff3ee]/70 px-4 py-8 text-center text-sm text-[#7b6660]">
            No active sessions recorded.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {sessions.map((session) => (
              <div key={session.session_id} className="flex flex-col gap-3 rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#7b6660]">
                    {session.device?.toLowerCase().includes("mobile") ? <Smartphone size={18} /> : <Monitor size={18} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#251E1F]">
                      {session.browser || "Unknown"} on {session.os || "Unknown"}
                      {session.is_current ? <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">CURRENT</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7b6660]">
                      {session.device || "Unknown device"} &middot; {session.ip_address || "N/A"} &middot; {session.location || "Unknown location"}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7b6660]/60">Login: {formatDate(session.login_time)}</p>
                  </div>
                </div>
                {!session.is_current && (
                  <button type="button" onClick={() => handleTerminate(session.session_id)} disabled={actionLoading === session.session_id}
                    className="shrink-0 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20 disabled:opacity-50">
                    {actionLoading === session.session_id ? <Loader2 size={12} className="animate-spin" /> : "Terminate"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Logout All Modal */}
      {confirmLogoutAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#ead3cc] bg-[#fff3ee] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#251E1F]">Logout All Devices</h3>
            <p className="mt-2 text-sm text-[#7b6660]">This will terminate all active sessions including your current one. You will need to log in again.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={handleLogoutAll} disabled={actionLoading === "all"}
                className="flex-1 rounded-xl bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-500/30 disabled:opacity-50">
                {actionLoading === "all" ? "Logging out..." : "Confirm Logout All"}
              </button>
              <button type="button" onClick={() => setConfirmLogoutAll(false)}
                className="flex-1 rounded-xl border border-[#ead3cc] bg-white px-4 py-2.5 text-sm font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed right-6 top-24 z-50 animate-[slideDown_0.3s_ease] rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
      toast.type === "error" ? "border-rose-400/20 bg-rose-500/15 text-rose-700" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-700"
    }`}>
      <div className="flex items-center gap-2">
        {toast.type === "error" ? <X size={16} /> : <Check size={16} />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}