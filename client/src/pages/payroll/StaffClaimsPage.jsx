/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - STAFF
 * PURPOSE: Implements the Staff Claims Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { FileCheck2, Loader2, Paperclip, ReceiptText, Upload } from "lucide-react";
import { listPayrollRequests, openPayrollRequestAttachment, submitPayrollRequest } from "../../services/payrollRequestService.js";
import ClaimWorkflowProgress from "../../components/payroll/ClaimWorkflowProgress.jsx";
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_STYLES } from "../../utils/claimWorkflow.js";

export default function StaffClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const claimTypes = ["Medical", "Transport", "Meal", "Internet", "Travel", "Office Purchase", "Other"];
  const [form, setForm] = useState({ claim_type: "Transport", customPurpose: "", amount: "", expense_date: "", description: "", evidence: [] });

  async function loadClaims() {
    try {
      const requests = await listPayrollRequests();
      setClaims(requests.map((item) => ({ ...item, claim_id: item.id, claim_type: item.purpose, expense_date: item.submittedAt, hr_comments: item.hrDecision?.comments, finance_comments: item.financeDecision?.comments, payment_reference: item.disbursement?.reference, proof_original_name: item.attachments?.[0]?.name })));
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
    if (!form.evidence.length) return setMessage({ type: "error", text: "Attach at least one receipt or supporting document." });
    if (form.claim_type === "Other" && !form.customPurpose.trim()) return setMessage({ type: "error", text: "Enter the reimbursement purpose." });
    const data = new FormData();
    data.append("requestType", "reimbursement"); data.append("purpose", form.claim_type === "Other" ? form.customPurpose.trim() : form.claim_type); data.append("amount", form.amount); data.append("expenseDate", form.expense_date); data.append("description", form.description); form.evidence.forEach(file => data.append("evidence", file));
    setSubmitting(true);
    setMessage(null);
    try {
      await submitPayrollRequest(data);
      setForm({ claim_type: "Transport", customPurpose: "", amount: "", expense_date: "", description: "", evidence: [] });
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
            <select value={form.claim_type} onChange={(e) => setForm({ ...form, claim_type: e.target.value })} className="mt-1 w-full rounded-md border border-[#f0d2ca] bg-transparent px-3 py-2 text-[#251E1F] outline-none focus:border-[#F38978]">
              {claimTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          {form.claim_type === "Other" ? <label className="text-sm text-[#7b6660]">Reimbursement purpose<input required value={form.customPurpose} onChange={(e) => setForm({ ...form, customPurpose: e.target.value })} className="mt-1 w-full rounded-md border border-[#f0d2ca] px-3 py-2" placeholder="Describe what you are requesting reimbursement for"/></label> : null}
          <label className="text-sm text-[#7b6660]">Amount (SGD)
            <input required type="number" min="0.01" max="100000" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="mt-1 w-full rounded-md border border-[#f0d2ca] bg-transparent px-3 py-2 text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#F38978]" />
          </label>
          <label className="text-sm text-[#7b6660]">Expense date
            <input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="mt-1 w-full rounded-md border border-[#f0d2ca] bg-transparent px-3 py-2 text-[#251E1F] outline-none focus:border-[#F38978]" />
          </label>
          <label className="text-sm text-[#7b6660]">Evidence (up to 5 PDF/JPG/PNG files; 5MB each)
            <span className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-[#F38978]/40 bg-[#F38978]/5 px-3 py-2.5 text-[#251E1F]">
              <Upload size={16} className="text-[#F38978]" />
              <input required multiple type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setForm({ ...form, evidence: Array.from(e.target.files || []).slice(0,5) })} className="min-w-0 max-w-full truncate text-xs text-[#7b6660]" />
            </span>
          </label>
          <label className="text-sm text-[#7b6660] md:col-span-2">Business purpose / description
            <textarea required minLength={5} maxLength={1000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the business purpose of this expense..." className="mt-1 w-full rounded-md border border-[#f0d2ca] bg-transparent px-3 py-2 text-[#251E1F] placeholder-[#7b6660]/40 outline-none focus:border-[#F38978]" />
          </label>
          <button disabled={submitting} className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#F38978] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />} Submit claim
          </button>
        </form>
      </div>

      {/* Claim History */}
      <div className="app-panel rounded-2xl p-6">
        <h3 className="font-semibold text-[#251E1F]">Payroll Requests & Outcomes</h3>
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
                  <div className="min-w-0">
                    <p className="font-semibold text-[#251E1F]">{claim.claim_type} · ${Number(claim.amount).toFixed(2)}</p>
                    <p className="mt-1 text-xs text-[#7b6660]">{new Date(claim.expense_date).toLocaleDateString("en-SG")} · {claim.description}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${CLAIM_STATUS_STYLES[claim.status] || "border-[#f0d2ca] text-[#7b6660]"}`}>
                    {CLAIM_STATUS_LABELS[claim.status] || claim.status}
                  </span>
                </div>
                <ClaimWorkflowProgress status={claim.status} />
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <button disabled={!claim.attachments?.[0]} onClick={() => openPayrollRequestAttachment(claim.id, claim.attachments[0].id).catch((error) => setMessage({ type: "error", text: error.message }))} className="inline-flex min-w-0 max-w-full items-center gap-1 text-[#F38978] hover:text-[#F38978] transition disabled:opacity-50">
                    <Paperclip size={14} />{claim.proof_original_name}
                  </button>
                  {claim.hr_comments && <span className="min-w-0 break-words text-[#7b6660]">HR: {claim.hr_comments}</span>}
                  {claim.finance_comments && <span className="min-w-0 break-words text-[#7b6660]">Finance: {claim.finance_comments}</span>}
                  {claim.payment_reference && <span className="min-w-0 break-words font-medium text-emerald-600">Ref: {claim.payment_reference}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
