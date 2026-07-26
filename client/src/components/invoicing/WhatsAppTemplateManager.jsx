/**
 * WhatsApp Message Template Manager
 *
 * Full CRUD interface for managing WhatsApp message templates.
 * Supports placeholder insertion, template preview, and default selection.
 * Accessible from the WhatsApp Settings page.
 */

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Star,
  Trash2,
  X
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function getHeaders() {
  const token = localStorage.getItem("authToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function WhatsAppTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState(null);
  const [filterType, setFilterType] = useState("");

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const url = filterType
        ? `${API_BASE}/api/whatsapp-notifications/templates?template_type=${filterType}`
        : `${API_BASE}/api/whatsapp-notifications/templates`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        if (data.placeholders) setPlaceholders(data.placeholders);
        if (data.types) setTypes(data.types);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(template) {
    setMessage(null);
    try {
      const isNew = !template.id;
      const url = isNew
        ? `${API_BASE}/api/whatsapp-notifications/templates`
        : `${API_BASE}/api/whatsapp-notifications/templates/${template.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(template)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: isNew ? "Template created." : "Template updated." });
        setEditing(null);
        setIsCreating(false);
        await loadTemplates();
      } else {
        setMessage({ type: "error", text: data.message || "Failed to save." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this template? Default templates cannot be deleted.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/templates/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Template deleted." });
        await loadTemplates();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.message || "Cannot delete." });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  async function handleSetDefault(id) {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp-notifications/templates/${id}/default`, {
        method: "PUT",
        headers: getHeaders()
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Set as default." });
        await loadTemplates();
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-sm text-[#7b6660]">
        <Loader2 size={16} className="animate-spin" /> Loading templates...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Message Banner */}
      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          message.type === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-700" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700"
        }`}>
          {message.type === "error" ? <AlertCircle size={14} className="inline mr-1" /> : <CheckCircle2 size={14} className="inline mr-1" />}
          {message.text}
        </div>
      )}

      {/* Header + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setTimeout(loadTemplates, 0); }}
            className="rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setIsCreating(true); setEditing({ template_name: "", template_type: types[0] || "custom", message_body: "", is_active: true }); }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/30 transition hover:bg-[#e87562]"
        >
          <Plus size={16} />
          New Template
        </button>
      </div>

      {/* Placeholders Reference */}
      {placeholders.length > 0 && (
        <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] p-3">
          <p className="text-xs font-bold uppercase text-[#7b6660] mb-2">Available Placeholders</p>
          <div className="flex flex-wrap gap-2">
            {placeholders.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1 rounded-md border border-[#f0d2ca] bg-white px-2 py-1 text-xs font-mono text-[#7b6660]" title={p.description}>
                {`{{${p.key}}}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editing && (
        <TemplateEditor
          template={editing}
          types={types}
          placeholders={placeholders}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsCreating(false); }}
          isNew={isCreating}
        />
      )}

      {/* Template List */}
      <div className="grid gap-3">
        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#f0d2ca] px-4 py-8 text-center text-sm text-[#7b6660]">
            No templates found. Create one to get started.
          </div>
        ) : (
          templates.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border border-[#f0d2ca] bg-white p-4 hover:border-[#F38978]/40 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#251E1F]">{tpl.template_name}</h4>
                    {tpl.is_default ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        <Star size={10} /> Default
                      </span>
                    ) : null}
                    {!tpl.is_active && (
                      <span className="rounded-full border border-slate-400/30 bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#7b6660]">
                    Type: <span className="font-medium">{(tpl.template_type || "").replace(/_/g, " ")}</span>
                  </p>
                  <pre className="mt-2 max-h-20 overflow-y-auto rounded-md bg-[#fff8f5] border border-[#ead3cc] p-2 text-xs text-[#7b6660] whitespace-pre-wrap font-sans">
                    {tpl.message_body}
                  </pre>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!tpl.is_default && (
                    <button type="button" onClick={() => handleSetDefault(tpl.id)} title="Set as default" className="rounded-md p-1.5 text-amber-600 hover:bg-amber-500/10">
                      <Star size={14} />
                    </button>
                  )}
                  <button type="button" onClick={() => { setEditing(tpl); setIsCreating(false); }} title="Edit" className="rounded-md p-1.5 text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]">
                    <Edit3 size={14} />
                  </button>
                  {!tpl.is_default && (
                    <button type="button" onClick={() => handleDelete(tpl.id)} title="Delete" className="rounded-md p-1.5 text-rose-500 hover:bg-rose-500/10">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Template Editor (inline) ─────────────────────────────────────────────────

function TemplateEditor({ template, types, placeholders, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({
    id: template.id || null,
    template_name: template.template_name || "",
    template_type: template.template_type || "custom",
    message_body: template.message_body || "",
    is_active: template.is_active !== false
  });
  const [saving, setSaving] = useState(false);

  function insertPlaceholder(key) {
    setForm((prev) => ({
      ...prev,
      message_body: prev.message_body + `{{${key}}}`
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.template_name.trim() || !form.message_body.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-[#F38978]/30 bg-[#fff8f5] p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-[#251E1F]">{isNew ? "Create Template" : "Edit Template"}</h4>
        <button type="button" onClick={onCancel} className="rounded-md p-1.5 text-[#7b6660] hover:bg-[#FDD9CD]/30">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase text-[#7b6660]">Template Name</span>
            <input
              type="text"
              value={form.template_name}
              onChange={(e) => setForm((p) => ({ ...p, template_name: e.target.value }))}
              placeholder="e.g., Invoice Reminder"
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[#7b6660]">Template Type</span>
            <select
              value={form.template_type}
              onChange={(e) => setForm((p) => ({ ...p, template_type: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978]"
            >
              {types.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase text-[#7b6660]">Message Body</span>
          <textarea
            value={form.message_body}
            onChange={(e) => setForm((p) => ({ ...p, message_body: e.target.value }))}
            rows={6}
            placeholder="Hello {{CustomerName}},\n\nYour invoice {{InvoiceNumber}} is ready..."
            className="mt-1 w-full rounded-lg border border-[#f0d2ca] bg-white px-3 py-2 text-sm text-[#251E1F] outline-none focus:border-[#F38978] resize-none font-mono"
            required
          />
        </label>

        {/* Quick Placeholder Buttons */}
        <div>
          <p className="text-xs font-bold uppercase text-[#7b6660] mb-2">Insert Placeholder</p>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => insertPlaceholder(p.key)}
                className="rounded-md border border-[#f0d2ca] bg-white px-2 py-1 text-xs font-mono text-[#7b6660] hover:bg-[#FDD9CD]/30 hover:text-[#251E1F]"
                title={p.description}
              >
                {p.key}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 text-sm text-[#251E1F]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-[#f0d2ca] accent-[#F38978]"
            />
            Active
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="rounded-lg border border-[#f0d2ca] px-4 py-2 text-sm font-semibold text-[#7b6660] hover:bg-[#FDD9CD]/30">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#F38978]/30 hover:bg-[#e87562] disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isNew ? "Create" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
