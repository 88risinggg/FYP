import { useEffect, useState } from "react";
import { Check, Link2, Loader2, RefreshCw, Unlink, X } from "lucide-react";
import { fetchConnectedAccounts, connectAccount, disconnectAccount } from "../../../services/settingsService.js";

const providers = [
  { id: "google", name: "Google", color: "text-red-400", bg: "bg-red-500/10" },
  { id: "microsoft", name: "Microsoft", color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "xero", name: "Xero", color: "text-sky-400", bg: "bg-sky-500/10" },
  { id: "quickbooks", name: "QuickBooks", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "slack", name: "Slack", color: "text-[#F38978]", bg: "bg-[#FDD9CD]/45" }
];

export default function ConnectedAccountsSection() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await fetchConnectedAccounts();
      setAccounts(data);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleConnect(provider) {
    setActionLoading(provider);
    try {
      await connectAccount(provider, { account_email: "user@example.com" });
      showToast(`${provider} connected successfully`);
      await loadAccounts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDisconnect(provider) {
    setActionLoading(provider);
    try {
      await disconnectAccount(provider);
      showToast(`${provider} disconnected`);
      await loadAccounts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(d) {
    if (!d) return "-";
    return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  }

  function getConnectedProvider(providerId) {
    return accounts.find((a) => a.provider === providerId);
  }

  return (
    <div className="space-y-6">
      {toast && <Toast toast={toast} />}

      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <Link2 size={20} className="text-[#F38978]" />
          <h2 className="text-xl font-semibold text-[#251E1F]">Connected Accounts</h2>
        </div>
        <p className="mt-1 text-sm text-[#7b6660]">Manage your connected third-party services.</p>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[#FDD9CD]/30" />
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {providers.map((provider) => {
              const connected = getConnectedProvider(provider.id);
              const isLoading = actionLoading === provider.id;

              return (
                <div key={provider.id} className="flex flex-col gap-3 rounded-xl border border-[#ead3cc] bg-[#fff3ee]/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${provider.bg}`}>
                      <span className={`text-sm font-bold ${provider.color}`}>{provider.name.charAt(0)}</span>
                    </div>
                    <div>
                    <p className="text-sm font-medium text-[#251E1F]">{provider.name}</p>
                      {connected ? (
                        <p className="text-xs text-[#7b6660]">
                          {connected.account_email || "Connected"} &middot; Last sync: {formatDate(connected.last_sync)}
                        </p>
                      ) : (
                        <p className="text-xs text-[#7b6660]/60">Not connected</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {connected ? (
                      <>
                        <button type="button" onClick={() => handleConnect(provider.id)} disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#ead3cc] bg-white px-3 py-1.5 text-xs font-semibold text-[#7b6660] transition hover:bg-[#FDD9CD]/50 hover:text-[#251E1F] disabled:opacity-50">
                          <RefreshCw size={12} /> Reconnect
                        </button>
                        <button type="button" onClick={() => handleDisconnect(provider.id)} disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20 disabled:opacity-50">
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />} Disconnect
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => handleConnect(provider.id)} disabled={isLoading}
                        className="primary-button inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold disabled:opacity-50">
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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