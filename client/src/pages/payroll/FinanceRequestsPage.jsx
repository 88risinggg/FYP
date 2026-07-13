import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "../../services/apiClient.js";
import ClaimManagementPage from "./ClaimManagementPage.jsx";

export default function FinanceRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [references, setReferences] = useState({});

  async function load() {
    try { setRequests(await apiRequest("/api/hr/finance-requests")); setError(""); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function releaseAdvance(id) {
    const paymentReference = (references[id] || "").trim();
    if (!paymentReference) return setError("Enter a payment reference before releasing the advance.");
    setBusy(id);
    try { await apiRequest(`/api/hr/finance-requests/${id}/approve`, { method: "PUT", body: JSON.stringify({ payment_reference: paymentReference }) }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  return <div className="space-y-8">
    <div>
      <h2 className="text-2xl font-semibold text-white">Employee Requests</h2>
      <p className="mt-1 text-sm text-[#d8c6e8]">Release HR-approved salary advances and expense reimbursements.</p>
    </div>
    {error && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
    <div className="neon-glass neon-border rounded-2xl p-6">
      <div className="flex items-center gap-3"><Banknote className="text-[#C77DFF]" /><div><h3 className="font-semibold text-white">Salary advance release queue</h3><p className="text-sm text-[#d8c6e8]">Requests shown here have already passed HR approval.</p></div></div>
      {loading ? <Loader2 className="mx-auto my-10 animate-spin text-[#C77DFF]" /> : requests.length === 0 ? <p className="py-10 text-center text-sm text-[#d8c6e8]">No salary advances in the finance queue.</p> : <div className="mt-5 space-y-3">{requests.map((request) => <div key={request.finance_request_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-4">
        <div><p className="font-semibold text-white">{request.staff_name || `Staff #${request.staff_id}`} · ${Number(request.amount).toFixed(2)}</p><p className="mt-1 text-xs text-[#d8c6e8]">{request.reason} · {request.advance_request_id} · {new Date(request.created_at).toLocaleDateString("en-SG")}</p></div>
        {request.status === "queued" ? <div className="flex flex-wrap gap-2"><input value={references[request.finance_request_id] || ""} onChange={(event) => setReferences({ ...references, [request.finance_request_id]: event.target.value })} placeholder="Payment reference" className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white" /><button disabled={busy === request.finance_request_id} onClick={() => releaseAdvance(request.finance_request_id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">{busy === request.finance_request_id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Release advance</button></div> : <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Released · {request.payment_reference || "reference unavailable"}</span>}
      </div>)}</div>}
    </div>
    <ClaimManagementPage role="Finance" />
  </div>;
}
