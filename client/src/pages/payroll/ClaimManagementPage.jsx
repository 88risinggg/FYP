import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ReceiptText, XCircle } from "lucide-react";
import { getClaims, openClaimProof, processClaimByFinance, reviewClaimByHr } from "../../services/claimService.js";

const labels = { pending_hr: "Pending HR", hr_approved: "Awaiting Finance", hr_rejected: "HR Rejected", released: "Released", finance_rejected: "Finance Rejected" };

export default function ClaimManagementPage({ role }) {
  const isFinance = role === "Finance";
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [comments, setComments] = useState({});
  const [references, setReferences] = useState({});

  async function load() {
    setLoading(true);
    try { setClaims(await getClaims()); setError(""); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [role]);

  const pendingCount = useMemo(() => claims.filter((c) => c.status === (isFinance ? "hr_approved" : "pending_hr")).length, [claims, isFinance]);

  async function act(claim, action) {
    const note = comments[claim.claim_id] || "";
    const reference = references[claim.claim_id] || "";
    if (action === "reject" && !note.trim()) return setError("Enter a reason before rejecting a claim.");
    if (isFinance && action === "release" && !reference.trim()) return setError("Enter a payment reference before releasing funds.");
    setBusyId(claim.claim_id);
    try {
      if (isFinance) await processClaimByFinance(claim.claim_id, action, { comments: note, payment_reference: reference });
      else await reviewClaimByHr(claim.claim_id, action, note);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  }

  return (
    <div className="space-y-5">
      <div className="app-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><ReceiptText className="text-[#F38978]" /><div><h3 className="font-semibold text-[#251E1F]">{isFinance ? "Claim reimbursement queue" : "Employee claim review"}</h3><p className="text-sm text-[#7b6660]">{isFinance ? "Verify HR-approved claims and record the fund release." : "Check the supporting proof before approving a claim for Finance."}</p></div></div>
          <span className="rounded-full border border-[#F38978]/30 bg-[#F38978]/10 px-3 py-1 text-sm text-[#6F4F47]">{pendingCount} awaiting action</span>
        </div>
      </div>
      {error && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
      {loading ? <Loader2 className="mx-auto my-16 animate-spin text-[#F38978]" /> : claims.length === 0 ? <div className="app-panel rounded-2xl py-16 text-center text-[#7b6660]">No claims in this queue.</div> : (
        <div className="space-y-4">{claims.map((claim) => {
          const actionable = claim.status === (isFinance ? "hr_approved" : "pending_hr");
          return <div key={claim.claim_id} className="app-panel rounded-2xl p-5">
            <div className="flex flex-wrap justify-between gap-4">
              <div><p className="text-lg font-semibold text-[#251E1F]">{claim.staff_name}</p><p className="mt-1 text-sm text-[#7b6660]">{claim.claim_type} · {new Date(claim.expense_date).toLocaleDateString("en-SG")} · {claim.claim_id}</p></div>
              <div className="text-right"><p className="text-xl font-semibold text-[#251E1F]">${Number(claim.amount).toFixed(2)}</p><span className="text-xs text-[#F38978]">{labels[claim.status]}</span></div>
            </div>
            <p className="mt-4 rounded-xl border border-[#f0d2ca] bg-black/10 p-3 text-sm text-[#7b6660]">{claim.description}</p>
            <button onClick={() => openClaimProof(claim.claim_id).catch((err) => setError(err.message))} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#F38978] hover:text-[#251E1F]"><ExternalLink size={15} />Review proof: {claim.proof_original_name}</button>
            {claim.hr_comments && <p className="mt-3 text-xs text-[#7b6660]">HR comments: {claim.hr_comments}</p>}
            {claim.finance_comments && <p className="mt-1 text-xs text-[#7b6660]">Finance comments: {claim.finance_comments}</p>}
            {actionable && <div className="mt-5 grid gap-3 border-t border-[#f0d2ca] pt-4 md:grid-cols-2">
              {isFinance && <input value={references[claim.claim_id] || ""} onChange={(e) => setReferences({ ...references, [claim.claim_id]: e.target.value })} placeholder="Payment / bank reference (required to release)" className="rounded-lg border border-[#f0d2ca] bg-transparent px-3 py-2.5 text-sm text-[#251E1F]" />}
              <input value={comments[claim.claim_id] || ""} onChange={(e) => setComments({ ...comments, [claim.claim_id]: e.target.value })} placeholder={isFinance ? "Finance note or rejection reason" : "HR comment or rejection reason"} className="rounded-lg border border-[#f0d2ca] bg-transparent px-3 py-2.5 text-sm text-[#251E1F]" />
              <div className="flex gap-2 md:col-span-2">
                <button disabled={busyId === claim.claim_id} onClick={() => act(claim, isFinance ? "release" : "approve")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">{busyId === claim.claim_id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}{isFinance ? "Release funds" : "Approve for Finance"}</button>
                <button disabled={busyId === claim.claim_id} onClick={() => act(claim, "reject")} className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 disabled:opacity-50"><XCircle size={15} />Reject</button>
              </div>
            </div>}
          </div>;
        })}</div>
      )}
    </div>
  );
}
