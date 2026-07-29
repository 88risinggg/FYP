/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - SHARED
 * PURPOSE: Implements the Claim Management Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Loader2, ReceiptText, XCircle } from "lucide-react";
import { listPayrollRequests, openPayrollRequestAttachment, reviewPayrollRequest } from "../../services/payrollRequestService.js";

export default function ClaimManagementPage({ role }) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notes,setNotes]=useState({});
  const load=async()=>{setLoading(true);try{setItems(await listPayrollRequests());setError("");}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[role]);
  const act=async(item,action)=>{const reason=notes[item.id]||"";if(action==="reject"&&!reason.trim())return setError("Enter a rejection reason.");setBusy(item.id);try{await reviewPayrollRequest(item.id,"hr",action,{reason});await load();}catch(e){setError(e.message);}finally{setBusy("");}};
  if(role==="Finance") return null;
  return <div className="space-y-5"><div className="app-panel rounded-2xl p-5"><div className="flex items-center gap-3"><ReceiptText className="text-[#F38978]"/><div><h3 className="font-semibold">Payroll Requests & Outcomes</h3><p className="text-sm text-[#7b6660]">Review reimbursement, loan, and salary-advance evidence before Finance confirmation.</p></div></div></div>{error?<div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>:null}{loading?<Loader2 className="mx-auto my-12 animate-spin"/>:<div className="space-y-3">{items.map(item=><article key={item.id} className="app-panel rounded-2xl p-5"><div className="flex justify-between"><div><strong>{item.staffName} · {item.purpose}</strong><p className="mt-1 text-xs text-[#7b6660]">{item.requestType.replaceAll("_"," ")} · {item.id}</p></div><div className="text-right"><strong>${item.amount.toFixed(2)}</strong><p className="text-xs text-[#F38978]">{item.status.replaceAll("_"," ")}</p></div></div><p className="mt-3 rounded-lg bg-[#fff8f5] p-3 text-sm">{item.description}</p><div className="mt-3 flex flex-wrap gap-2">{item.attachments.map(file=><button key={file.id} onClick={()=>openPayrollRequestAttachment(item.id,file.id).catch(e=>setError(e.message))} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><FileText size={15}/>{file.name}</button>)}</div>{["pending_hr","returned_to_hr"].includes(item.status)?<div className="mt-4 border-t pt-4"><input value={notes[item.id]||""} onChange={e=>setNotes({...notes,[item.id]:e.target.value})} placeholder="HR comment or rejection reason" className="w-full rounded-lg border p-2.5"/><div className="mt-2 flex gap-2"><button disabled={busy===item.id} onClick={()=>act(item,"approve")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white">{busy===item.id?<Loader2 size={15} className="animate-spin"/>:<CheckCircle2 size={15}/>}Send to Finance</button><button disabled={busy===item.id} onClick={()=>act(item,"reject")} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-white"><XCircle size={15}/>Reject</button></div></div>:null}</article>)}</div>}</div>;
}
