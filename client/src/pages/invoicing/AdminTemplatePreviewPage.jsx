import { useEffect, useRef, useState } from "react";
import {
  Eye, RefreshCw, AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";

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
 * The preview is read-only and uses the same saved invoice settings
 * consumed by Finance invoice creation/export.
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
          companyName: s.companyName || s.company_name || "PayNivo",
          uenNumber: s.uenNumber || s.uen_number || "",
          gstRegistrationNumber: s.gstRegistrationNumber || s.gst_registration_number || "",
          companyAddress: s.companyAddress || s.company_address || "",
          companyPhone: s.companyPhone || s.company_phone || "",
          companyEmail: s.companyEmail || s.company_email || s.financeEmail || "",
          companyRegistrationNumber: s.companyRegistrationNumber || s.company_registration_number || "",
          companyWebsite: s.companyWebsite || "",
          primaryColor: s.primaryColor || s.primary_color || "#251E1F",
          secondaryColor: s.secondaryColor || s.secondary_color || "#F38978",
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
          companyName: "PayNivo",
          uenNumber: "202312345A",
          gstRegistrationNumber: "M1-2023456-7",
          companyAddress: "1 Raffles Place, #20-01, Singapore 048616",
          companyPhone: "+65 6123 4567",
          companyEmail: "support@paynivo.com",
          primaryColor: "#251E1F",
          secondaryColor: "#F38978",
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
          bankAccountHolderName: "PayNivo Pte. Ltd.",
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

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#2D7C83]" />
        <span className="ml-2 text-sm text-[#7B6660]">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left Panel — Settings Controls */}
      <div className="w-[380px] shrink-0 overflow-y-auto border-r bg-white p-4 space-y-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#251E1F]">
          <Eye className="h-5 w-5 text-[#2D7C83]" />
          Template Preview
        </h2>
        <p className="text-xs text-[#7B6660]">
          This preview uses the saved Invoice Settings. Finance invoices use the same saved settings when invoices are created, sent, viewed, and exported.
        </p>
        <Link
          to="/dashboard/invoicing/admin/settings"
          className="inline-flex w-full items-center justify-center rounded-lg border border-[#F38978] px-3 py-2 text-sm font-bold text-[#F38978] transition hover:bg-[#fff8f5]"
        >
          Edit Invoice Settings
        </Link>

        {loadError && (
          <div className="flex items-center gap-2 rounded-lg border border-[#FDD9CD] bg-[#FDD9CD] px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Could not load saved settings. Using defaults.</span>
          </div>
        )}

        {/* Status Preview Selector */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#7B6660]">Preview Status</label>
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

        <div className="rounded-lg border border-[#ead3cc] bg-[#fff8f5] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#251E1F]">Saved Settings Used</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs text-[#7B6660]">Company</dt>
              <dd className="font-semibold text-[#251E1F]">{settings.companyName || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#7B6660]">Currency</dt>
              <dd className="font-semibold text-[#251E1F]">{settings.defaultCurrency || "SGD"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#7B6660]">GST</dt>
              <dd className="font-semibold text-[#251E1F]">
                {settings.taxEnabled ? `${settings.taxName || "GST"} ${settings.taxPercentage || 0}%` : "Disabled"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#7B6660]">Payment Terms</dt>
              <dd className="font-semibold text-[#251E1F]">{settings.paymentTerms || "Net 30"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#7B6660]">Bank Transfer</dt>
              <dd className="font-semibold text-[#251E1F]">{settings.bankName || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#7B6660]">PayNow</dt>
              <dd className="font-semibold text-[#251E1F]">{settings.paynowIdentifier || "-"}</dd>
            </div>
          </dl>
        </div>

      </div>

      {/* Right Panel — Live Preview */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#FFF6F2]">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2 border-b bg-white px-4 py-2">
          <Eye className="h-4 w-4 text-[#7B6660]" />
          <span className="text-xs font-medium text-[#7B6660]">Preview</span>
          <div className="ml-auto flex items-center gap-1">
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level.label}
                type="button"
                onClick={() => setZoom(level.value)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  zoom === level.value
                    ? "bg-[#FFF6F2] text-[#2D7C83]"
                    : "text-[#7B6660] hover:bg-[#FFF6F2]"
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
              boxShadow: "0 4px 25px rgba(37,30,31,0.12), 0 1px 5px rgba(37,30,31,0.08)",
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
