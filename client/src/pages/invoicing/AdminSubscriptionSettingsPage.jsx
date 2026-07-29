/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - ADMIN
 * PURPOSE: Implements the Admin Subscription Settings Page screen and its page-level interactions.
 * LAYER: Frontend page - renders a complete screen and coordinates its user interactions.
 * FIND RELATED CODE: Trace its imports for UI components and frontend services used by this screen.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  FileStack,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tags,
  X
} from "lucide-react";

import {
  getAdminSubscriptionSettings,
  updateAdminSubscriptionSettings
} from "../../services/adminSubscriptionSettingsService.js";

const frequencies = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const pageSize = 8;

function normalizePlans(plans = []) {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name || "",
    description: plan.description || "",
    billingFrequency: frequencies.includes(plan.billingFrequency)
      ? plan.billingFrequency
      : "Monthly",
    active: plan.active !== false,
    usageCount: Number(plan.usageCount || 0)
  }));
}

function emptyPlan() {
  return {
    id: `plan-${Date.now()}`,
    name: "",
    description: "",
    billingFrequency: "Monthly",
    active: true
  };
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  const tones = {
    coral: "bg-[#fff3ee] text-[#E8573D]",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600"
  };

  return (
    <div className="rounded-2xl border border-[#f2d5cc]/70 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={19} />
        </span>
        <div>
          <p className="text-2xl font-bold text-[#251E1F]">{value}</p>
          <p className="text-xs font-semibold text-[#7b6660]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function PlanDrawer({ drawer, saving, error, onChange, onClose, onSave }) {
  if (!drawer) return null;

  const plan = drawer.plan;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={saving ? undefined : onClose}
        aria-label="Close plan editor"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-drawer-title"
        className="relative z-10 flex h-full w-full max-w-lg flex-col bg-[#fffaf8] shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#f2d5cc] bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F38978]">
              Plan Template
            </p>
            <h2 id="plan-drawer-title" className="mt-1 text-xl font-bold text-[#251E1F]">
              {drawer.mode === "create" ? "Create Plan Template" : "Edit Plan Template"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-[#7b6660] hover:bg-[#fff3ee] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {drawer.mode === "edit" && plan.usageCount > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-bold">
                Used by {plan.usageCount} active customer subscription{plan.usageCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-xs leading-5">
                Changes apply to future subscriptions only. Existing customer prices,
                billing dates and subscription details remain unchanged.
              </p>
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-bold text-[#251E1F]">Plan name *</span>
            <input
              type="text"
              value={plan.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="Example: Monthly Beauty Package"
              className="mt-2 h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
            />
            <span className="mt-1.5 block text-xs text-[#7b6660]">
              Use a short name that Finance can recognise easily.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-[#251E1F]">Description</span>
            <textarea
              value={plan.description}
              onChange={(event) => onChange("description", event.target.value)}
              rows={5}
              placeholder="Explain when Finance should use this plan"
              className="mt-2 w-full rounded-lg border border-[#ead3cc] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
            />
            <span className="mt-1.5 block text-xs text-[#7b6660]">
              Optional. Do not include customer-specific prices or private details.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-[#251E1F]">Default billing frequency</span>
            <select
              value={plan.billingFrequency}
              onChange={(event) => onChange("billingFrequency", event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-[#ead3cc] bg-white px-3 text-sm outline-none focus:border-[#F38978] focus:ring-2 focus:ring-[#F38978]/15"
            >
              {frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>{frequency}</option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-[#7b6660]">
              Finance can confirm the final frequency for each customer subscription.
            </span>
          </label>

          <div className="rounded-xl border border-[#ead3cc] bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#251E1F]">Plan status</p>
                <p className="mt-1 text-xs leading-5 text-[#7b6660]">
                  Active plans are available for new subscriptions. Inactive plans remain saved
                  but should not be used for new customers.
                </p>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={plan.active}
                  onChange={(event) => onChange("active", event.target.checked)}
                  className="h-4 w-4 accent-[#F38978]"
                />
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  plan.active
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {plan.active ? "Active" : "Inactive"}
                </span>
              </label>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#f2d5cc] bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#dfc3bb] px-4 py-2.5 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ee] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#251E1F] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4b3834] disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? "Saving..." : "Save Plan Template"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function ImpactConfirmationModal({ confirmation, saving, onCancel, onConfirm }) {
  if (!confirmation) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="impact-warning-title"
        aria-describedby="impact-warning-description"
        className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle size={22} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              Change Impact Warning
            </p>
            <h2 id="impact-warning-title" className="mt-1 text-xl font-bold text-[#251E1F]">
              Confirm plan changes
            </h2>
          </div>
        </div>

        <div id="impact-warning-description" className="mt-5 space-y-3 text-sm leading-6 text-[#6f4f47]">
          <p>
            <strong className="text-[#251E1F]">{confirmation.planName}</strong> is currently
            used by <strong className="text-[#251E1F]">{confirmation.usageCount} active customer
            subscription{confirmation.usageCount === 1 ? "" : "s"}</strong>.
          </p>
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
            These changes apply to future subscriptions only. Existing customer prices,
            billing dates and subscription details will remain unchanged.
          </p>
          <p>Do you want to continue and save this Plan Template?</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-[#dfc3bb] px-4 py-2.5 text-sm font-bold text-[#6f4f47] hover:bg-[#fff3ee] disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? "Saving..." : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSubscriptionSettingsPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [impactConfirmation, setImpactConfirmation] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getAdminSubscriptionSettings()
      .then((data) => setPlans(normalizePlans(data.plans || [])))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, frequencyFilter, sortBy]);

  const stats = useMemo(() => ({
    total: plans.length,
    active: plans.filter((plan) => plan.active).length,
    inactive: plans.filter((plan) => !plan.active).length
  }), [plans]);

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = plans.filter((plan) => {
      const matchesSearch = !query
        || plan.name.toLowerCase().includes(query)
        || plan.description.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" ? plan.active : !plan.active);
      const matchesFrequency = frequencyFilter === "all"
        || plan.billingFrequency === frequencyFilter;

      return matchesSearch && matchesStatus && matchesFrequency;
    });

    return [...result].sort((left, right) => {
      if (sortBy === "frequency") {
        return left.billingFrequency.localeCompare(right.billingFrequency)
          || left.name.localeCompare(right.name);
      }
      if (sortBy === "status") {
        return Number(right.active) - Number(left.active)
          || left.name.localeCompare(right.name);
      }
      return left.name.localeCompare(right.name);
    });
  }, [plans, search, statusFilter, frequencyFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visiblePlans = filteredPlans.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function openCreateDrawer() {
    setDrawer({ mode: "create", index: null, plan: emptyPlan() });
    setError("");
    setMessage("");
  }

  function openEditDrawer(plan) {
    setDrawer({
      mode: "edit",
      index: plans.findIndex((item) => item.id === plan.id),
      plan: { ...plan }
    });
    setError("");
    setMessage("");
  }

  function updateDrawer(field, value) {
    setDrawer((current) => ({
      ...current,
      plan: { ...current.plan, [field]: value }
    }));
    setError("");
  }

  async function persistPlans(nextPlans, mode) {
    setSaving(true);
    setError("");
    try {
      const data = await updateAdminSubscriptionSettings({ plans: nextPlans });
      setPlans(normalizePlans(data.plans || []));
      setImpactConfirmation(null);
      setDrawer(null);
      setMessage(
        mode === "create"
          ? "Plan template created successfully."
          : "Plan template updated successfully."
      );
    } catch (saveError) {
      setError(saveError.message);
      setImpactConfirmation(null);
    } finally {
      setSaving(false);
    }
  }

  async function saveDrawer() {
    const name = String(drawer.plan.name || "").trim();
    if (!name) {
      setError("Plan name is required.");
      return;
    }

    const duplicate = plans.some((plan, index) => (
      index !== drawer.index && plan.name.trim().toLowerCase() === name.toLowerCase()
    ));
    if (duplicate) {
      setError("Plan names must be unique.");
      return;
    }

    const cleanPlan = {
      ...drawer.plan,
      name,
      description: String(drawer.plan.description || "").trim()
    };
    const nextPlans = drawer.mode === "create"
      ? [...plans, cleanPlan]
      : plans.map((plan, index) => (index === drawer.index ? cleanPlan : plan));

    if (drawer.mode === "edit" && cleanPlan.usageCount > 0) {
      setImpactConfirmation({
        nextPlans,
        mode: drawer.mode,
        planName: cleanPlan.name,
        usageCount: cleanPlan.usageCount
      });
      return;
    }

    await persistPlans(nextPlans, drawer.mode);
  }

  if (loading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center">
        <Loader2 className="animate-spin text-[#F38978]" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F38978]">
            Subscription Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#251E1F]">Plan Library</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#7b6660]">
            Manage reusable subscription templates for Finance without changing
            customer-specific prices or billing details.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateDrawer}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#e47767]"
        >
          <Plus size={16} /> Create Plan Template
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Plans" value={stats.total} icon={FileStack} tone="coral" />
        <SummaryCard label="Active Plans" value={stats.active} icon={CheckCircle2} tone="green" />
        <SummaryCard label="Inactive Plans" value={stats.inactive} icon={CircleOff} tone="slate" />
      </div>

      {message ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      ) : null}

      {!drawer && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#f2d5cc]/70 bg-white/90 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#f2d5cc]/70 bg-[#fff9f7] p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b7c74]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plan name or description"
              className="h-10 w-full rounded-lg border border-[#ead3cc] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#F38978]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-lg border border-[#ead3cc] bg-white px-3 text-sm text-[#6f4f47]"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={frequencyFilter}
            onChange={(event) => setFrequencyFilter(event.target.value)}
            className="h-10 rounded-lg border border-[#ead3cc] bg-white px-3 text-sm text-[#6f4f47]"
            aria-label="Filter by billing frequency"
          >
            <option value="all">All frequencies</option>
            {frequencies.map((frequency) => (
              <option key={frequency} value={frequency}>{frequency}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="h-10 rounded-lg border border-[#ead3cc] bg-white px-3 text-sm text-[#6f4f47]"
            aria-label="Sort plans"
          >
            <option value="name">Sort: Plan name</option>
            <option value="frequency">Sort: Frequency</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>

        {visiblePlans.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Tags className="mx-auto text-[#F38978]" />
            <p className="mt-3 text-sm font-bold text-[#251E1F]">
              {plans.length === 0 ? "No plan templates yet" : "No matching plans"}
            </p>
            <p className="mt-1 text-xs text-[#7b6660]">
              {plans.length === 0
                ? "Create the first reusable plan template for Finance."
                : "Try changing the search or filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#f2d5cc]/70 bg-white text-xs uppercase tracking-wide text-[#7b6660]">
                  <th className="px-5 py-3 font-bold">Plan name</th>
                  <th className="px-5 py-3 font-bold">Description</th>
                  <th className="px-5 py-3 font-bold">Default frequency</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlans.map((plan) => (
                  <tr key={plan.id} className="border-b border-[#f2d5cc]/50 last:border-0 hover:bg-[#fffaf8]">
                    <td className="px-5 py-4 font-bold text-[#251E1F]">{plan.name}</td>
                    <td className="max-w-sm px-5 py-4 text-[#6f4f47]">
                      <p className="line-clamp-2">{plan.description || "No description"}</p>
                    </td>
                    <td className="px-5 py-4 text-[#6f4f47]">{plan.billingFrequency}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        plan.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(plan)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#ead3cc] bg-white px-3 py-2 text-xs font-bold text-[#6f4f47] hover:border-[#F38978] hover:text-[#E8573D]"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[#f2d5cc]/70 bg-[#fff9f7] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-[#7b6660]">
            Showing {visiblePlans.length} of {filteredPlans.length} plans
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-[#ead3cc] bg-white p-2 text-[#6f4f47] disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-20 text-center text-xs font-bold text-[#6f4f47]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-[#ead3cc] bg-white p-2 text-[#6f4f47] disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        Admin manages reusable templates only. Customer price, purchased items, billing dates,
        auto-renewal, pause, resume and cancellation remain Finance responsibilities.
      </div>

      <PlanDrawer
        drawer={drawer}
        saving={saving}
        error={drawer ? error : ""}
        onChange={updateDrawer}
        onClose={() => {
          if (!saving) {
            setImpactConfirmation(null);
            setDrawer(null);
            setError("");
          }
        }}
        onSave={saveDrawer}
      />

      <ImpactConfirmationModal
        confirmation={impactConfirmation}
        saving={saving}
        onCancel={() => setImpactConfirmation(null)}
        onConfirm={() => persistPlans(
          impactConfirmation.nextPlans,
          impactConfirmation.mode
        )}
      />
    </section>
  );
}
