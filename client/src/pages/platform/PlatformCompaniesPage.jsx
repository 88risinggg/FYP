/**
 * EVALUATION HEADER
 * FEATURE: PLATFORM / COMPANY
 * PURPOSE: Implements the Platform Companies Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import {
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { clearSession, enterSupportSession } from "../../services/sessionService.js";
import {
  activateSupportAccess,
  getPlatformSupportRequests,
  listPlatformCompanies,
  onboardPlatformCompany,
  provisionPlatformCompany,
  resendPlatformAdminSetup,
  requestSupportAccess,
} from "../../services/companyService.js";

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({
    workspaceId: "",
    name: "Vaniday",
    legalName: "Vaniday",
    registrationNumber: "",
    gstNumber: "",
    address: "",
    businessEmail: "",
    phone: "",
    website: "",
    adminName: "",
    adminEmail: "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(null);
  const load = async () => {
    const [companyResult, requestResult] = await Promise.all([listPlatformCompanies(), getPlatformSupportRequests()]);
    const loadedCompanies = companyResult.companies || [];
    setCompanies(loadedCompanies);
    setRequests(requestResult.requests || []);
    const pendingVaniday = loadedCompanies.find((company) => company.setupStatus === "pending_admin" && !company.userCount && company.name?.trim().toLowerCase() === "vaniday");
    if (pendingVaniday) setForm((current) => current.workspaceId ? current : ({ ...current, workspaceId: pendingVaniday.workspaceId, name: pendingVaniday.name || current.name, legalName: pendingVaniday.legalName || current.legalName }));
  };
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);
  const provision = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setProgress({ percent: 2, phase: "Validating company registration", status: "running", detail: "Checking the workspace and required business information." });
    const progressTimer = window.setInterval(() => setProgress((current) => {
      if (!current || current.status !== "running") return current;
      const next = Math.min(90, current.percent + Math.max(1, Math.ceil((90 - current.percent) / 8)));
      const phase = next < 28 ? "Validating company registration" : next < 52 ? "Saving business profile" : next < 73 ? "Creating tenant Admin" : "Preparing secure setup email";
      return { ...current, percent: next, phase };
    }), 350);
    try {
      const payload = {
        company: { name: form.name, legalName: form.legalName, registrationNumber: form.registrationNumber, gstNumber: form.gstNumber, address: form.address, email: form.businessEmail, phone: form.phone, website: form.website, timezone: "Asia/Singapore", currency: "SGD" },
        admin: { name: form.adminName, email: form.adminEmail },
        sourceCompanyId: 1,
        fullClone: form.name.trim().toLowerCase() === "vaniday",
      };
      const pendingWorkspace = companies.find((company) => company.setupStatus === "pending_admin" && !company.userCount && company.name?.trim().toLowerCase() === form.name.trim().toLowerCase());
      const workspaceId = form.workspaceId || pendingWorkspace?.workspaceId;
      const result = workspaceId ? await onboardPlatformCompany(workspaceId, payload) : await provisionPlatformCompany(payload);
      window.clearInterval(progressTimer);
      setProgress({ percent: 100, phase: "Company onboarding completed", status: result.setupEmail?.status === "failed" ? "warning" : "completed", temporaryPassword: result.setupEmail?.oneTimeTemporaryPassword, detail: result.setupEmail?.status === "sent" ? `Admin setup link and temporary password sent to ${result.setupEmail.recipient}.` : result.setupEmail?.status === "failed" ? "The company and Admin were saved, but email delivery failed. Copy the one-time password below and provide it to the Admin securely." : "The workspace and tenant Admin were saved successfully." });
      setMessage(
        result.setupEmail?.status === "sent"
          ? "Company onboarding completed and the Admin setup email was sent."
          : `Company saved. Setup email: ${result.setupEmail?.status || "not requested"}.`,
      );
      await load();
      setForm({ workspaceId: "", name: "", legalName: "", registrationNumber: "", gstNumber: "", address: "", businessEmail: "", phone: "", website: "", adminName: "", adminEmail: "" });
    } catch (error) {
      window.clearInterval(progressTimer);
      setMessage(error.message);
      setProgress((current) => ({ percent: current?.percent || 0, phase: "Onboarding could not be completed", status: "failed", detail: error.message }));
    } finally {
      setBusy(false);
    }
  };
  const prepareOnboarding = (company) => {
    setForm({ workspaceId: company.workspaceId, name: company.name || "", legalName: company.legalName || company.name || "", registrationNumber: company.registrationNumber || "", gstNumber: company.gstNumber || "", address: company.address || "", businessEmail: company.email || "", phone: company.phone || "", website: company.website || "", adminName: "", adminEmail: "" });
    setMessage(`Complete ${company.name}'s registration and invite its first Admin.`);
  };
  const support = async (company) => {
    const reason = window.prompt(
      `Why do you need temporary support access to ${company.name}?`,
    );
    if (!reason?.trim()) return;
    try {
      await requestSupportAccess({ companyId: company.companyId, reason });
      setMessage("Support request sent to the tenant Admin for approval.");
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };
  const enterSupport = async (request) => {
    setBusy(true);
    try {
      const result = await activateSupportAccess(request.grant_id);
      enterSupportSession(result.token, result.company, result.supportContext, result.expiresAt);
      location.href = "/module-selection";
    } catch (error) { setMessage(error.message); setBusy(false); }
  };
  const retryAdminSetup = async (company) => {
    setBusy(true); setMessage(""); setProgress({ percent: 10, phase: "Rotating temporary password", status: "running", detail: "Preparing a fresh first-login credential and setup link." });
    try {
      const result = await resendPlatformAdminSetup(company.workspaceId);
      setProgress({ percent: 100, phase: result.setupEmail?.status === "sent" ? "Admin setup email sent" : "Admin credential regenerated", status: result.setupEmail?.status === "sent" ? "completed" : "warning", temporaryPassword: result.setupEmail?.oneTimeTemporaryPassword, detail: result.setupEmail?.status === "sent" ? `A fresh setup email was sent to ${result.setupEmail.recipient}.` : "Email is still unavailable. Copy the new one-time password below and provide it securely to the tenant Admin." });
    } catch (error) { setProgress({ percent: 20, phase: "Admin setup retry failed", status: "failed", detail: error.message }); }
    finally { setBusy(false); }
  };
  return (
    <main className="min-h-screen bg-[#fff8f5] p-6 text-[#251E1F] lg:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F38978]">
              PayNivo platform
            </p>
            <h1 className="mt-1 text-3xl font-bold">Company workspaces</h1>
            <p className="mt-2 text-sm text-[#7b6660]">
              Manage tenant setup without opening employee, payroll, claim, or
              financial records.
            </p>
          </div>
          <button
            onClick={() => {
              clearSession();
              location.href = "/login";
            }}
            className="rounded-xl border border-[#f0d2ca] bg-white px-4 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </header>
        {message ? (
          <div className="mt-6 rounded-xl border border-[#2D7C83]/25 bg-[#2D7C83]/10 p-4 text-sm text-[#2D7C83]">
            {message}
          </div>
        ) : null}
        <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_24rem]">
          <section className="rounded-2xl border border-[#f0d2ca] bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Registered companies</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {companies.map((company) => (
                <article
                  key={company.workspaceId}
                  className="rounded-xl border border-[#f0d2ca] bg-[#fffaf8] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F38978]/10 text-[#F38978]">
                      <Building2 size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {company.status}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">{company.name}</h3>
                  <p className="mt-1 text-xs text-[#7b6660]">
                    {company.userCount} user(s) · {company.setupStatus}
                  </p>
                  <button
                    onClick={() => support(company)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <ShieldCheck size={14} />
                    Request support access
                  </button>
                  {company.setupStatus === "pending_admin" && !company.userCount ? <button onClick={() => prepareOnboarding(company)} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 size={14}/>Complete onboarding</button> : null}
                  {company.setupStatus === "admin_invited" ? <button disabled={busy} onClick={() => retryAdminSetup(company)} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2D7C83] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><ShieldCheck size={14}/>Retry Admin setup</button> : null}
                </article>
              ))}
            </div>
            <div className="mt-6 border-t border-[#f0d2ca] pt-5">
              <h2 className="font-semibold">Support access requests</h2>
              <div className="mt-3 space-y-2">
                {requests.length ? requests.map((request) => (
                  <div key={request.grant_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fffaf8] p-3 text-sm">
                    <div><p className="font-semibold">{request.display_name || request.company_name}</p><p className="text-xs text-[#7b6660]">{request.status} · {request.access_mode || "awaiting tenant review"}</p></div>
                    {request.status === "approved" ? <button disabled={busy} onClick={() => enterSupport(request)} className="rounded-lg bg-[#2D7C83] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Enter approved support session</button> : null}
                  </div>
                )) : <p className="text-sm text-[#7b6660]">No support requests yet.</p>}
              </div>
            </div>
          </section>
          <form
            onSubmit={provision}
            className="rounded-2xl border border-[#f0d2ca] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-[#F38978]" />
              <h2 className="font-semibold">{form.workspaceId ? "Complete company onboarding" : "Provision workspace"}</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#7b6660]">
              Record the company identity and invite its first tenant Admin. The Admin can maintain these details afterward.
            </p>
            {[
              ["Company name", "name"],
              ["Legal name", "legalName"],
              ["UEN / registration number", "registrationNumber"],
              ["GST registration number", "gstNumber"],
              ["Registered business address", "address"],
              ["Business email", "businessEmail"],
              ["Business phone", "phone"],
              ["Website", "website"],
              ["First Admin name", "adminName"],
              ["First Admin email", "adminEmail"],
            ].map(([label, key]) => (
              <label
                key={key}
                className="mt-4 block text-xs font-semibold text-[#7b6660]"
              >
                {label}
                <input
                  required={!['gstNumber','phone','website'].includes(key)}
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                  type={["adminEmail","businessEmail"].includes(key) ? "email" : "text"}
                  className="mt-1 w-full rounded-xl border border-[#f0d2ca] px-3 py-2.5 text-sm outline-none focus:border-[#F38978]"
                />
              </label>
            ))}
            <button
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F38978] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <CheckCircle2 size={17} />
              )}
              {form.workspaceId ? "Save and invite tenant Admin" : "Create isolated workspace"}
            </button>
          </form>
        </div>
      </div>
      {progress ? <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-[#251E1F]/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="onboarding-progress-title" className="w-full max-w-md rounded-2xl border border-[#f0d2ca] bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${progress.status === "failed" ? "bg-red-50 text-red-600" : progress.status === "warning" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{progress.status === "running" ? <Loader2 size={21} className="motion-safe:animate-spin"/> : progress.status === "failed" ? <span className="text-xl font-bold">!</span> : <CheckCircle2 size={22}/>}</span><div><h2 id="onboarding-progress-title" className="font-semibold text-[#251E1F]">{progress.phase}</h2><p className="mt-1 text-sm leading-5 text-[#7b6660]">{progress.detail}</p></div></div><div className="mt-6 flex items-center justify-between text-xs font-semibold"><span>Onboarding progress</span><span>{progress.percent}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#f6ddd6]"><div className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${progress.status === "failed" ? "bg-red-500" : progress.status === "warning" ? "bg-amber-500" : "bg-gradient-to-r from-[#F38978] to-emerald-500"}`} style={{ width: `${progress.percent}%` }}/></div><div className="mt-5 grid grid-cols-4 gap-1 text-center text-[10px] text-[#7b6660]">{["Validate","Business","Admin","Email"].map((item,index) => <div key={item} className={progress.percent >= [10,35,60,85][index] ? "font-semibold text-emerald-700" : ""}>{item}</div>)}</div>{progress.temporaryPassword ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">One-time temporary password</p><code className="mt-1 block select-all break-all text-sm font-bold text-[#251E1F]">{progress.temporaryPassword}</code><p className="mt-1 text-xs text-amber-800">Copy it now. It is shown only in this completion result and must be changed at first login.</p></div> : null}{progress.status !== "running" ? <button type="button" onClick={() => setProgress(null)} className="mt-6 w-full rounded-xl border border-[#f0d2ca] bg-white px-4 py-2.5 text-sm font-semibold">Close</button> : <p className="mt-5 text-center text-xs text-[#7b6660]">Keep this window open while the records are saved.</p>}</section></div> : null}
    </main>
  );
}
