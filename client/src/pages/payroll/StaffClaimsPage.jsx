import { useEffect, useState } from "react";
import { FileCheck2, Loader2, Paperclip, ReceiptText, Upload } from "lucide-react";
import { CLAIM_TYPES, getClaims, openClaimProof, submitClaim } from "../../services/claimService.js";
import ClaimWorkflowProgress from "../../components/payroll/ClaimWorkflowProgress.jsx";
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_STYLES } from "../../utils/claimWorkflow.js";

export default function StaffClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({ claim_type: "Transport", amount: "", expense_date: "", description: "", proof: null });

  async function loadClaims() {
    try {
      setClaims(await getClaims());
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClaims(); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!form.proof) return setMessage({ type: "error", text: "Attach a receipt or supporting document." });
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    setSubmitting(true);
    setMessage(null);
    try {
      await submitClaim(data);
      setForm({ claim_type: "Transport", amount: "", expense_date: "", description: "", proof: null });
      formElement.reset();
      setMessage({ type: "success", text: "Claim submitted to HR for review." });
      await loadClaims();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-xl border p-4 text-sm ${message.type === "error" ? "border-red-300/40 bg-[#FDD9CD] text-red-700" : "border-emerald-300/40 bg-[#FFF6F2] text-emerald-700"}`}>
          {message.text}
        </div>
      )}

      {/* Submit Form */}
      <div className="app-panel rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <ReceiptText className="mt-0.5 text-[#F38978]" />
          <div>
            <h3 className="font-semibold text-[#251E1F]">Submit an expense claim</h3>
            <p className="mt-1 text-sm text-[#7b6660]">A receipt or supporting document is required for compliance review.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-[#7b6660]">Claim type
            <select value={form.claim_type} onChange={(e) => setForm({ ...form, claim_type: e.target.value })} className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-[#251E1F] outline-none focus:border-[#F38978]">
              {CLAIM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="text-sm text-[#7b6660]">Amount (SGD)
            <input required type="number" min="0.01" max="100000" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#F38978]" />
          </label>
          <label className="text-sm text-[#7b6660]">Expense date
            <input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-[#251E1F] outline-none focus:border-[#F38978]" />
          </label>
          <label className="text-sm text-[#7b6660]">Proof (PDF, JPG or PNG; max 5MB)
            <span className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-[#F38978]/40 bg-[#F38978]/5 px-3 py-2.5 text-[#251E1F]">
              <Upload size={16} className="text-[#F38978]" />
              <input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setForm({ ...form, proof: e.target.files?.[0] || null })} className="min-w-0 text-xs text-[#7b6660]" />
            </span>
          </label>
          <label className="text-sm text-[#7b6660] md:col-span-2">Business purpose / description
            <textarea required minLength={5} maxLength={1000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the business purpose of this expense..." className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2.5 text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#F38978]" />
          </label>
          <button disabled={submitting} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Submit claim
          </button>
        </form>
      </div>

      {/* Claim History */}
      <div className="app-panel rounded-2xl p-6">
        <h3 className="font-semibold text-[#251E1F]">Claim history</h3>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[#F38978]" size={24} />
          </div>
        ) : claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ReceiptText size={32} className="text-[#7b6660]/30" />
            <p className="mt-3 text-sm text-[#7b6660]">No claims submitted yet.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {claims.map((claim) => (
              <div key={claim.claim_id} className="rounded-xl border border-[#f0d2ca] bg-white/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#251E1F]">{claim.claim_type} · ${Number(claim.amount).toFixed(2)}</p>
                    <p className="mt-1 text-xs text-[#7b6660]">{new Date(claim.expense_date).toLocaleDateString("en-SG")} · {claim.description}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${CLAIM_STATUS_STYLES[claim.status] || "border-[#f0d2ca] text-[#7b6660]"}`}>
                    {CLAIM_STATUS_LABELS[claim.status] || claim.status}
                  </span>
                </div>
                <ClaimWorkflowProgress status={claim.status} />
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <button onClick={() => openClaimProof(claim.claim_id).catch((error) => setMessage({ type: "error", text: error.message }))} className="inline-flex items-center gap-1 text-[#F38978] hover:text-[#F38978] transition">
                    <Paperclip size={14} />{claim.proof_original_name}
                  </button>
                  {claim.hr_comments && <span className="text-[#7b6660]">HR: {claim.hr_comments}</span>}
                  {claim.finance_comments && <span className="text-[#7b6660]">Finance: {claim.finance_comments}</span>}
                  {claim.payment_reference && <span className="text-emerald-600 font-medium">Ref: {claim.payment_reference}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
