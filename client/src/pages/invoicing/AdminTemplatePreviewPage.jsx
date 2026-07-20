import { useEffect, useRef, useState } from "react";
import {
  Eye, Palette, RefreshCw, ToggleLeft, ToggleRight, AlertCircle
} from "lucide-react";

import InvoiceTemplate from "../../components/invoicing/InvoiceTemplate.jsx";
import { getInvoiceSettings } from "../../services/adminInvoiceSettingsService.js";

// =====================================================
// Sample Invoice Data for Preview
// =====================================================

const SAMPLE_INVOICE = {
  invoice_id: 0,
  invoiceId: "INV-2026-000001",
  status: "Sent",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  customer_name: "John Tan",
  customer_email: "john@email.com",
  customer_address: "123 Orchard Road, #04-01, Singapore 238858",
  service_provider: "Premium Hair Studio",
  shop_title: "Premium Hair Studio",
  total_amount: 54.50,
  amount_paid: 0,
  notes: "",
  items: [
    { description: "Haircut - Men's Premium Cut", quantity: 1, unit_price: 50.00, amount: 50.00 },
    { description: "Hair Wash & Conditioning Treatment", quantity: 1, unit_price: 4.50, amount: 4.50 },
  ],
};

// =====================================================
// Zoom Levels
// =====================================================

const ZOOM_LEVELS = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
  { label: "125%", value: 1.25 },
  { label: "Fit", value: "fit" },
];

/**
 * Admin Template Preview Page
 *
 * Provides a live WYSIWYG preview of the invoice template.
 * Uses the shared InvoiceTemplate component — the same one used for
 * PDF generation, invoice detail, and customer-facing views.
 *
 * Settings changes reflect instantly without saving.
 */
export default function AdminTemplatePreviewPage() {
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewStatus, setPreviewStatus] = useState("Sent");
  const [zoom, setZoom] = useState("fit");
  const previewContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Load settings from server
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getInvoiceSettings();
        const s = data.settings || data;
        setSettings({
          companyName: s.companyName || s.company_name || "Vaniday",
          uenNumber: s.uenNumber || s.uen_number || "",
          gstRegistrationNumber: s.gstRegistrationNumber || s.gst_registration_number || "",
          companyAddress: s.companyAddress || s.company_address || "",
          companyPhone: s.companyPhone || s.company_phone || "",
          companyEmail: s.companyEmail || s.company_email || s.financeEmail || "",
          companyRegistrationNumber: s.companyRegistrationNumber || s.company_registration_number || "",
          companyWebsite: s.companyWebsite || "",
          primaryColor: s.primaryColor || s.primary_color || "#061e4b",
          secondaryColor: s.secondaryColor || s.secondary_color || "#ff5a52",
          fontFamily: s.fontFamily || s.font_family || "Arial, Helvetica, sans-serif",
          fontSizeBase: s.fontSizeBase || s.font_size_base || 12,
          invoicePrefix: s.invoicePrefix || s.invoice_prefix || "INV",
          currencySymbol: s.currencySymbol || s.currency_symbol || "S$",
          currencyFormat: s.currencyFormat || s.currency_format || "symbol_before",
          displayDateFormat: s.displayDateFormat || s.display_date_format || "DD MMM YYYY",
          decimalPrecision: s.decimalPrecision ?? s.decimal_precision ?? 2,
          defaultCurrency: s.general?.defaultCurrency || s.defaultCurrency || "SGD",
          taxEnabled: s.taxEnabled ?? s.tax_enabled ?? true,
          taxName: s.taxName || s.tax_name || "GST",
          taxPercentage: s.taxPercentage ?? s.tax_percentage ?? 9,
          taxInclusive: s.taxInclusive ?? s.tax_inclusive ?? false,
          watermarkEnabled: s.watermarkEnabled ?? s.watermark_enabled ?? true,
          qrCodeDisplay: s.qrCodeDisplay ?? s.qr_code_display ?? true,
          bankDetailsDisplay: s.bankDetailsDisplay ?? s.bank_details_display ?? true,
          paynowDisplay: s.paynowDisplay ?? s.paynow_display ?? true,
          signatureDisplay: s.signatureDisplay ?? s.signature_display ?? false,
          bankAccountHolderName: s.bankAccountHolderName || s.bank_account_holder_name || "",
          bankName: s.bankName || s.bank_name || "",
          bankAccountNumber: s.bankAccountNumber || s.bank_account_number || "",
          bicSwift: s.bicSwift || s.bic_swift || "",
          paynowIdentifier: s.paynowIdentifier || s.paynow_identifier || "",
          paymentReferenceInstruction: s.paymentReferenceInstruction || s.payment_reference_instruction || "",
          paymentTerms: s.paymentTerms || s.payment_terms || "Net 30",
          invoiceBorderStyle: s.invoiceBorderStyle || s.invoice_border_style || "modern",
          itemTableStyle: s.itemTableStyle || s.item_table_style || "striped",
          footerNote: s.footerNote || s.footer_note || "",
          computerGeneratedStatement: s.computerGeneratedStatement || s.computer_generated_statement || "",
          registeredOfficeAddress: s.registeredOfficeAddress || s.registered_office_address || "",
          financeEmail: s.financeEmail || s.finance_email || "",
          termsAndConditions: s.termsAndConditions || "",
          defaultNotes: s.defaultNotes || "",
          companyLogoUrl: s.branding?.companyLogoUrl || s.companyLogoUrl || s.company_logo_url || "",
        });
      } catch (err) {
        setLoadError(err.message);
        // Use defaults on failure
        setSettings({
          companyName: "Vaniday",
          uenNumber: "202312345A",
          gstRegistrationNumber: "M1-2023456-7",
          companyAddress: "1 Raffles Place, #20-01, Singapore 048616",
          companyPhone: "+65 6123 4567",
          companyEmail: "finance@vaniday.com",
          primaryColor: "#061e4b",
          secondaryColor: "#ff5a52",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSizeBase: 12,
          invoicePrefix: "INV",
          currencySymbol: "S$",
          currencyFormat: "symbol_before",
          displayDateFormat: "DD MMM YYYY",
          decimalPrecision: 2,
          defaultCurrency: "SGD",
          taxEnabled: true,
          taxName: "GST",
          taxPercentage: 9,
          taxInclusive: false,
          watermarkEnabled: true,
          qrCodeDisplay: true,
          bankDetailsDisplay: true,
          paynowDisplay: true,
          signatureDisplay: false,
          bankAccountHolderName: "Vaniday Pte Ltd",
          bankName: "DBS Bank",
          bankAccountNumber: "012-345678-9",
          bicSwift: "DBSSSGSG",
          paynowIdentifier: "202312345A",
          paymentReferenceInstruction: "Please include your invoice number as the payment reference.",
          paymentTerms: "Net 30",
          invoiceBorderStyle: "modern",
          itemTableStyle: "striped",
          computerGeneratedStatement: "This is a computer-generated invoice. No signature is required.",
          registeredOfficeAddress: "",
          financeEmail: "",
          companyLogoUrl: "",
          companyRegistrationNumber: "",
        });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Measure container width for "Fit" zoom
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build preview invoice with current status
  const previewInvoice = {
    ...SAMPLE_INVOICE,
    status: previewStatus,
    invoiceId: `${settings?.invoicePrefix || "INV"}-2026-000001`,
    amount_paid: previewStatus === "Paid" ? SAMPLE_INVOICE.total_amount : 0,
  };

  // Compute scale based on zoom setting
  const A4_WIDTH_PX = 793; // 210mm at 96 DPI
  const computedScale = zoom === "fit"
    ? Math.min((containerWidth - 48) / A4_WIDTH_PX, 1)
    : zoom;

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSetting(key) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
        <span className="ml-2 text-sm text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Panel — Settings Controls */}
      <div className="w-[380px] shrink-0 overflow-y-auto border-r bg-white p-4 space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Palette className="h-5 w-5 text-purple-600" />
          Template Configuration
        </h2>
        <p className="text-xs text-gray-500">
          Changes reflect instantly in the preview. Settings are NOT saved until you click Save in Invoice Settings.
        </p>

        {loadError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load saved settings. Using defaults.</span>
          </div>
        )}

        {/* Status Preview Selector */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Preview Status</label>
          <select
            value={previewStatus}
            onChange={(e) => setPreviewStatus(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
          >
            {["Draft", "Sent", "Viewed", "Paid", "Overdue"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Colors */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Colors</legend>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Primary</label>
              <input type="color" value={settings.primaryColor} onChange={(e) => updateSetting("primaryColor", e.target.value)} className="h-8 w-full cursor-pointer rounded" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Secondary</label>
              <input type="color" value={settings.secondaryColor} onChange={(e) => updateSetting("secondaryColor", e.target.value)} className="h-8 w-full cursor-pointer rounded" />
            </div>
          </div>
        </fieldset>

        {/* Typography */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Typography</legend>
          <div>
            <label className="text-xs text-gray-500">Font Family</label>
            <select value={settings.fontFamily} onChange={(e) => updateSetting("fontFamily", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm">
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
            <input type="range" min="8" max="16" value={settings.fontSizeBase} onChange={(e) => updateSetting("fontSizeBase", Number(e.target.value))} className="w-full" />
          </div>
        </fieldset>

        {/* Company Info */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Company Info</legend>
          <input placeholder="Company Name" value={settings.companyName} onChange={(e) => updateSetting("companyName", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="UEN Number" value={settings.uenNumber} onChange={(e) => updateSetting("uenNumber", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="GST Registration" value={settings.gstRegistrationNumber} onChange={(e) => updateSetting("gstRegistrationNumber", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Address" value={settings.companyAddress} onChange={(e) => updateSetting("companyAddress", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <input placeholder="Phone" value={settings.companyPhone} onChange={(e) => updateSetting("companyPhone", e.target.value)} className="flex-1 rounded border px-2 py-1.5 text-sm" />
            <input placeholder="Email" value={settings.companyEmail} onChange={(e) => updateSetting("companyEmail", e.target.value)} className="flex-1 rounded border px-2 py-1.5 text-sm" />
          </div>
        </fieldset>

        {/* Invoice Settings */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Invoice</legend>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Prefix</label>
              <input value={settings.invoicePrefix} onChange={(e) => updateSetting("invoicePrefix", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">Currency</label>
              <input value={settings.currencySymbol} onChange={(e) => updateSetting("currencySymbol", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
            </div>
          </div>
        </fieldset>

        {/* Tax */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Tax</legend>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggleSetting("taxEnabled")} className="text-purple-600">
              {settings.taxEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
            </button>
            <span className="text-sm">{settings.taxEnabled ? "Tax Enabled" : "Tax Disabled"}</span>
          </div>
          {settings.taxEnabled && (
            <div className="flex gap-2">
              <input placeholder="Tax Name" value={settings.taxName} onChange={(e) => updateSetting("taxName", e.target.value)} className="flex-1 rounded border px-2 py-1.5 text-sm" />
              <input type="number" placeholder="%" value={settings.taxPercentage} onChange={(e) => updateSetting("taxPercentage", Number(e.target.value))} className="w-20 rounded border px-2 py-1.5 text-sm" />
            </div>
          )}
        </fieldset>

        {/* Display Toggles */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Display</legend>
          {[
            ["watermarkEnabled", "Watermark"],
            ["qrCodeDisplay", "QR Code"],
            ["bankDetailsDisplay", "Bank Details"],
            ["paynowDisplay", "PayNow"],
            ["signatureDisplay", "Signature"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{label}</span>
              <button type="button" onClick={() => toggleSetting(key)} className="text-purple-600">
                {settings[key] ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
              </button>
            </div>
          ))}
        </fieldset>

        {/* Payment Details */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Payment Details</legend>
          <input placeholder="Bank Account Holder" value={settings.bankAccountHolderName} onChange={(e) => updateSetting("bankAccountHolderName", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Bank Name" value={settings.bankName} onChange={(e) => updateSetting("bankName", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="Account Number" value={settings.bankAccountNumber} onChange={(e) => updateSetting("bankAccountNumber", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="BIC/SWIFT" value={settings.bicSwift} onChange={(e) => updateSetting("bicSwift", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
          <input placeholder="PayNow Identifier" value={settings.paynowIdentifier} onChange={(e) => updateSetting("paynowIdentifier", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
        </fieldset>

        {/* Layout */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Layout</legend>
          <div>
            <label className="text-xs text-gray-500">Border Style</label>
            <select value={settings.invoiceBorderStyle} onChange={(e) => updateSetting("invoiceBorderStyle", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm">
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Table Style</label>
            <select value={settings.itemTableStyle} onChange={(e) => updateSetting("itemTableStyle", e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm">
              <option value="striped">Striped</option>
              <option value="bordered">Bordered</option>
              <option value="clean">Clean</option>
            </select>
          </div>
        </fieldset>

        {/* Footer */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold uppercase tracking-wide text-gray-700">Footer</legend>
          <div>
            <label className="text-xs text-gray-500">Payment Reference Instruction</label>
            <textarea
              rows={2}
              value={settings.paymentReferenceInstruction}
              onChange={(e) => updateSetting("paymentReferenceInstruction", e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Computer Generated Statement</label>
            <textarea
              rows={2}
              value={settings.computerGeneratedStatement}
              onChange={(e) => updateSetting("computerGeneratedStatement", e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
        </fieldset>
      </div>

      {/* Right Panel — Live Preview */}
      <div className="flex flex-1 flex-col overflow-hidden bg-gray-100">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2 border-b bg-white px-4 py-2">
          <Eye className="h-4 w-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Preview</span>
          <div className="ml-auto flex items-center gap-1">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level.label}
                type="button"
                onClick={() => setZoom(level.value)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  zoom === level.value
                    ? "bg-purple-100 text-purple-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        {/* A4 Preview Area */}
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-auto p-6"
          style={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}
        >
          <div
            style={{
              transform: `scale(${computedScale})`,
              transformOrigin: "top center",
              boxShadow: "0 4px 25px rgba(0,0,0,0.12), 0 1px 5px rgba(0,0,0,0.08)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <InvoiceTemplate
              invoice={previewInvoice}
              settings={settings}
              options={{
                logoUrl: settings.companyLogoUrl || "",
                qrCodeUrl: settings.qrCodeDisplay ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI3MCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIxMCIgeT0iNzAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI0MCIgeT0iNDAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIzMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI1MCIgeT0iMzAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iYmxhY2siLz48L3N2Zz4=" : "",
                // Sample Stripe payment link for preview (non-Paid statuses)
                paymentUrl: !["Paid", "Cancelled", "Refunded"].includes(previewStatus)
                  ? "https://checkout.stripe.com/c/pay/sample_preview_link"
                  : "",
                stripeQrCodeUrl: !["Paid", "Cancelled", "Refunded"].includes(previewStatus)
                  ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI3MCIgeT0iMTAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIxMCIgeT0iNzAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI0MCIgeT0iNDAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIzMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSI1MCIgeT0iMzAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iYmxhY2siLz48L3N2Zz4="
                  : "",
                signatureUrl: "",
                stampUrl: "",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
