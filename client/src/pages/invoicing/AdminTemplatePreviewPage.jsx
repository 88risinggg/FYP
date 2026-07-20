import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Palette, Type, FileText, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Admin Template Preview Page
 *
 * Provides a live preview of the invoice PDF template.
 * Admin can change colors, fonts, display toggles and immediately
 * see the result in an iframe without saving.
 */
export default function AdminTemplatePreviewPage() {
  const [settings, setSettings] = useState({
    companyName: "PayNivo Pte Ltd",
    uenNumber: "202312345A",
    gstRegistrationNumber: "M1-2023456-7",
    companyAddress: "1 Raffles Place, #20-01, Singapore 048616",
    companyPhone: "+65 6123 4567",
    companyEmail: "finance@paynivo.com",
    companyWebsite: "www.paynivo.com",
    primaryColor: "#061e4b",
    secondaryColor: "#ff5a52",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeBase: 12,
    invoicePrefix: "INV",
    currencySymbol: "S$",
    currencyFormat: "symbol_before",
    displayDateFormat: "DD MMM YYYY",
    decimalPrecision: 2,
    taxEnabled: true,
    taxName: "GST",
    taxPercentage: 9,
    taxInclusive: false,
    watermarkEnabled: true,
    qrCodeDisplay: true,
    bankDetailsDisplay: true,
    paynowDisplay: true,
    signatureDisplay: false,
    bankAccountHolderName: "PayNivo Pte Ltd",
    bankName: "DBS Bank",
    bankAccountNumber: "012-345678-9",
    bicSwift: "DBSSSGSG",
    paynowIdentifier: "202312345A",
    paymentReferenceInstruction: "Please include your invoice number as the payment reference.",
    paymentTerms: "Net 30",
    invoiceBorderStyle: "modern",
    itemTableStyle: "striped",
    footerNote: "Thank you for your business.",
    computerGeneratedStatement: "This is a computer-generated invoice. No signature is required.",
    termsAndConditions: "",
    defaultNotes: ""
  });
  const [previewStatus, setPreviewStatus] = useState("Sent");
  const [previewHtml, setPreviewHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef(null);
  const debounceRef = useRef(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("session") || "{}").token;
      const res = await fetch(`${API_BASE}/api/admin/invoicing/invoice-settings/template-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings, previewStatus })
      });
      if (res.ok) {
        const html = await res.text();
        setPreviewHtml(html);
      }
    } catch (err) {
      console.error("Preview fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [settings, previewStatus]);

  // Auto-refresh preview with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPreview, 600);
    return () => clearTimeout(debounceRef.current);
  }, [fetchPreview]);

  // Write HTML to iframe
  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      doc.write(previewHtml);
      doc.close();
    }
  }, [previewHtml]);

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function toggleSetting(key) {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Panel — Settings Controls */}
      <div className="w-[380px] border-r bg-white overflow-y-auto p-4 space-y-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-600" />
          Template Configuration
        </h2>
        <p className="text-xs text-gray-500">Changes reflect instantly in the preview. Settings are NOT saved until you click Save in Invoice Settings.</p>

        {/* Status Preview Selector */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Preview Status</label>
          <select
            value={previewStatus}
            onChange={e => setPreviewStatus(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
          >
            {["Draft", "Sent", "Viewed", "Paid", "Overdue"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Colors */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wide">Colors</legend>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Primary</label>
              <input type="color" value={settings.primaryColor} onChange={e => updateSetting("primaryColor", e.target.value)} className="w-full h-8 rounded cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Secondary</label>
              <input type="color" value={settings.secondaryColor} onChange={e => updateSetting("secondaryColor", e.target.value)} className="w-full h-8 rounded cursor-pointer" />
            </div>
          </div>
        </fieldset>

        {/* Typography */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wide">Typography</legend>
          <div>
            <label className="text-xs text-gray-500">Font Family</label>
            <select value={settings.fontFamily} onChange={e => updateSetting("fontFamily", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="'Georgia', serif">Georgia</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Segoe UI', sans-serif">Segoe UI</option>
              <option value="'Inter', sans-serif">Inter</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Base Font Size: {settings.fontSizeBase}pt</label>
            <input type="range" min="8" max="16" value={settings.fontSizeBase} onChange={e => updateSetting("fontSizeBase", Number(e.target.value))} className="w-full" />
          </div>
        </fieldset>

        {/* Company */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wide">Company Info</legend>
          <input placeholder="Company Name" value={settings.companyName} onChange={e => updateSetting("companyName", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
          <input placeholder="UEN Number" value={settings.uenNumber} onChange={e => updateSetting("uenNumber", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
          <input placeholder="GST Registration" value={settings.gstRegistrationNumber} onChange={e => updateSetting("gstRegistrationNumber", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
          <input placeholder="Address" value={settings.companyAddress} onChange={e => updateSetting("companyAddress", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <input placeholder="Phone" value={settings.companyPhone} onChange={e => updateSetting("companyPhone", e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm" />
            <input placeholder="Email" value={settings.companyEmail} onChange={e => updateSetting("companyEmail", e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm" />
          </div>
        </fieldset>

        {/* Tax */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wide">Tax</legend>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleSetting("taxEnabled")} className="text-purple-600">
              {settings.taxEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
            </button>
            <span className="text-sm">{settings.taxEnabled ? "Tax Enabled" : "Tax Disabled"}</span>
          </div>
          {settings.taxEnabled && (
            <div className="flex gap-2">
              <input placeholder="Tax Name" value={settings.taxName} onChange={e => updateSetting("taxName", e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm" />
              <input type="number" placeholder="%" value={settings.taxPercentage} onChange={e => updateSetting("taxPercentage", Number(e.target.value))} className="w-20 border rounded px-2 py-1.5 text-sm" />
            </div>
          )}
        </fieldset>

        {/* Display Toggles */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wide">Display</legend>
          {[
            ["watermarkEnabled", "Watermark"],
            ["qrCodeDisplay", "QR Code"],
            ["bankDetailsDisplay", "Bank Details"],
            ["paynowDisplay", "PayNow"],
            ["signatureDisplay", "Signature"]
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{label}</span>
              <button onClick={() => toggleSetting(key)} className="text-purple-600">
                {settings[key] ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
              </button>
            </div>
          ))}
        </fieldset>

        {/* Layout */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-gray-700 uppercase tracking-wide">Layout</legend>
          <div>
            <label className="text-xs text-gray-500">Border Style</label>
            <select value={settings.invoiceBorderStyle} onChange={e => updateSetting("invoiceBorderStyle", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Table Style</label>
            <select value={settings.itemTableStyle} onChange={e => updateSetting("itemTableStyle", e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="striped">Striped</option>
              <option value="bordered">Bordered</option>
              <option value="clean">Clean</option>
            </select>
          </div>
        </fieldset>

        <button onClick={fetchPreview} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh Preview
        </button>
      </div>

      {/* Right Panel — Live Preview */}
      <div className="flex-1 bg-gray-100 p-6 overflow-auto flex items-start justify-center">
        <div className="relative bg-white shadow-xl rounded-lg overflow-hidden" style={{ width: "210mm", minHeight: "297mm" }}>
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="Invoice Preview"
            className="w-full border-0"
            style={{ height: "297mm", transform: "scale(0.85)", transformOrigin: "top left", width: "118%" }}
          />
        </div>
      </div>
    </div>
  );
}
