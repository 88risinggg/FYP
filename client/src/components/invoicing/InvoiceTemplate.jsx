import { useMemo } from "react";

/**
 * InvoiceTemplate - Shared Invoice Rendering Component
 *
 * This single component is the source of truth for how invoices look across:
 * - Admin Template Preview
 * - Invoice Detail View
 * - Public Customer Invoice View
 * - PDF Generation (server-side mirrors this layout)
 *
 * Props:
 * - invoice: object with invoice data (items, customer, dates, amounts)
 * - settings: admin invoice settings (colors, fonts, toggles, company info)
 * - options: { logoUrl, qrCodeUrl, signatureUrl, stampUrl }
 */

// =====================================================
// Utility Functions
// =====================================================

function formatDate(value, format = "DD MMM YYYY") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const monthShort = new Intl.DateTimeFormat("en-SG", { month: "short" }).format(date);
  const year = String(date.getFullYear());
  const yearShort = year.slice(-2);

  return format
    .replace("DD", day)
    .replace("MMM", monthShort)
    .replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
    .replace("YYYY", year)
    .replace("YY", yearShort);
}

function formatMoney(value, settings = {}) {
  const precision = settings.decimalPrecision ?? 2;
  const symbol = settings.currencySymbol || "S$";
  const fmt = settings.currencyFormat || "symbol_before";
  const formatted = new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(Number(value || 0));

  if (fmt === "symbol_after") return `${formatted} ${symbol}`;
  return `${symbol}${formatted}`;
}

// =====================================================
// Sub-components
// =====================================================

function Watermark({ invoice, settings }) {
  if (!settings.watermarkEnabled) return null;
  const status = invoice.status || "Draft";
  const watermarkMap = { Paid: "PAID", Draft: "DRAFT", Overdue: "OVERDUE", Cancelled: "VOID", Void: "VOID" };
  const text = watermarkMap[status];
  if (!text) return null;
  const color = status === "Paid" ? "#22c55e" : status === "Overdue" ? "#ef4444" : "#94a3b8";

  return (
    <div
      style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%) rotate(-30deg)",
        fontSize: "72pt", fontWeight: 900, color, opacity: 0.08,
        pointerEvents: "none", zIndex: 0, whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

function Header({ settings, logoUrl }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const brandName = settings.companyName || "Vaniday";

  return (
    <header
      style={{
        display: "flex", alignItems: "flex-start", height: "20mm",
        borderBottom: `0.35mm solid #7f8ba2`, paddingBottom: "3mm",
      }}
    >
      <div style={{ width: "2.1mm", height: "16.5mm", marginRight: "7mm", background: secondary, flexShrink: 0 }} />
      {logoUrl ? (
        <img src={logoUrl} alt="Company logo" style={{ maxWidth: "62mm", maxHeight: "16.5mm", objectFit: "contain", objectPosition: "left top" }} />
      ) : (
        <div style={{ color: primary, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "25pt", lineHeight: 1, fontWeight: 700, letterSpacing: "0.8px", whiteSpace: "nowrap" }}>
          {brandName}<span style={{ color: secondary }}>.</span>
        </div>
      )}
    </header>
  );
}

function HeroSection({ invoice, settings }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const dateStr = formatDate(invoice.issue_date, settings.displayDateFormat);

  return (
    <section style={{ display: "grid", gridTemplateColumns: "44.5% 26% 29.5%", minHeight: "49mm", borderBottom: "0.3mm solid #c7ced8" }}>
      {/* Left: Invoice title + customer */}
      <div style={{ padding: "10.5mm 5mm 5mm 0" }}>
        <h1 style={{ margin: 0, fontSize: "27pt", lineHeight: 1, letterSpacing: "1.2px", color: primary }}>INVOICE</h1>
        <div style={{ width: "12mm", height: "1.1mm", margin: "3.8mm 0 5mm", background: secondary }} />
        <p style={{ margin: 0, fontSize: "8pt", lineHeight: 1.4, fontWeight: 700, color: "#263653" }}>{invoice.customer_name || ""}</p>
        {(invoice.service_provider || invoice.shop_title) && (
          <p style={{ margin: "1mm 0 0", fontSize: "7pt", color: "#555" }}>Service Provider: {invoice.service_provider || invoice.shop_title}</p>
        )}
        {invoice.customer_email && <p style={{ margin: "2mm 0 0", fontSize: "7pt", color: "#555" }}>{invoice.customer_email}</p>}
        {invoice.customer_address && <p style={{ margin: "1mm 0 0", fontSize: "7pt", color: "#555" }}>{invoice.customer_address}</p>}
      </div>

      {/* Middle: Date + Invoice Number */}
      <div style={{ borderLeft: "1px solid #d8dce3", display: "grid", gridTemplateRows: "1fr 1fr" }}>
        <div style={{ display: "grid", gridTemplateColumns: "13mm 1fr", alignItems: "center", padding: "3.5mm 3mm", borderBottom: "0.3mm solid #d8dce3" }}>
          <div style={{ color: secondary, textAlign: "center" }}>
            <svg viewBox="0 0 24 24" width="6mm" height="6mm" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
          </div>
          <div>
            <p style={{ margin: "0 0 1.4mm", fontSize: "6pt", fontWeight: 800, textTransform: "uppercase" }}>Invoice Date</p>
            <p style={{ margin: 0, fontSize: "7.5pt", fontWeight: 600 }}>{dateStr}</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "13mm 1fr", alignItems: "center", padding: "3.5mm 3mm" }}>
          <div style={{ color: secondary, textAlign: "center" }}>
            <svg viewBox="0 0 24 24" width="6mm" height="6mm" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5M9 12h7M9 16h7" /></svg>
          </div>
          <div>
            <p style={{ margin: "0 0 1.4mm", fontSize: "6pt", fontWeight: 800, textTransform: "uppercase" }}>Invoice Number</p>
            <p style={{ margin: 0, fontSize: "7.5pt", fontWeight: 600 }}>{invoice.invoiceId}</p>
          </div>
        </div>
      </div>

      {/* Right: Company card */}
      <div style={{ padding: "5mm 5.5mm", background: primary, color: "white", minWidth: 0 }}>
        <strong style={{ display: "block", marginBottom: "1.2mm", fontSize: "7.5pt" }}>{settings.companyName || "Vaniday"}</strong>
        {settings.companyRegistrationNumber && <p style={{ margin: "0.55mm 0", fontSize: "6.8pt" }}>Reg. No. {settings.companyRegistrationNumber}</p>}
        {settings.uenNumber && <p style={{ margin: "0.55mm 0", fontSize: "6.8pt" }}>UEN: {settings.uenNumber}</p>}
        {settings.gstRegistrationNumber && <p style={{ margin: "0.55mm 0", fontSize: "6.8pt" }}>GST Reg: {settings.gstRegistrationNumber}</p>}
        <p style={{ margin: "0.55mm 0", fontSize: "6.8pt" }}>{settings.companyAddress}</p>
        {settings.companyPhone && <p style={{ margin: "0.55mm 0", fontSize: "6.8pt" }}>Tel: {settings.companyPhone}</p>}
        {settings.companyEmail && <p style={{ margin: "0.55mm 0", fontSize: "6.8pt" }}>{settings.companyEmail}</p>}
      </div>
    </section>
  );
}

function ItemsTable({ invoice, settings }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const currency = settings.defaultCurrency || "SGD";
  const tableStyle = settings.itemTableStyle || "striped";

  return (
    <table style={{ width: "100%", marginTop: "5.5mm", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ width: "58%", height: "9mm", padding: "2.5mm 3.5mm", background: primary, color: "white", borderRight: "0.3mm solid rgba(255,255,255,0.2)", fontSize: "6.7pt", textAlign: "left", textTransform: "uppercase" }}>Description</th>
          <th style={{ width: "14%", height: "9mm", padding: "2.5mm 3.5mm", background: primary, color: "white", borderRight: "0.3mm solid rgba(255,255,255,0.2)", fontSize: "6.7pt", textAlign: "center", textTransform: "uppercase" }}>Qty</th>
          <th style={{ width: "14%", height: "9mm", padding: "2.5mm 3.5mm", background: primary, color: "white", borderRight: "0.3mm solid rgba(255,255,255,0.2)", fontSize: "6.7pt", textAlign: "center", textTransform: "uppercase" }}>Unit Price</th>
          <th style={{ width: "14%", height: "9mm", padding: "2.5mm 3.5mm", background: primary, color: "white", fontSize: "6.7pt", textAlign: "center", textTransform: "uppercase" }}>Amount {currency}</th>
        </tr>
      </thead>
      <tbody>
        {items.length > 0 ? items.map((item, index) => {
          const amount = Number(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0));
          const rowBg = tableStyle === "striped" && index % 2 === 1 ? "#f8f9fa" : "transparent";
          const cellBorder = tableStyle === "bordered" ? "1px solid #dee2e6" : "0.3mm solid #d7dbe2";

          return (
            <tr key={index} style={{ background: rowBg }}>
              <td style={{ display: "flex", gap: "3.5mm", minHeight: "12mm", padding: "4.2mm 3.5mm", border: cellBorder, borderTop: 0, fontSize: "7.2pt", verticalAlign: "top" }}>
                <span style={{ display: "inline-flex", width: "8mm", height: "8mm", flex: "0 0 8mm", alignItems: "center", justifyContent: "center", background: secondary, color: "white", fontSize: "7pt", fontWeight: 800 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{item.description}</span>
              </td>
              <td style={{ textAlign: "right", padding: "4.2mm 3.5mm", border: cellBorder, borderTop: 0, fontSize: "7.2pt", verticalAlign: "top" }}>{Number(item.quantity || 0).toFixed(2)}</td>
              <td style={{ textAlign: "right", padding: "4.2mm 3.5mm", border: cellBorder, borderTop: 0, fontSize: "7.2pt", verticalAlign: "top" }}>{formatMoney(item.unit_price, settings)}</td>
              <td style={{ textAlign: "right", padding: "4.2mm 3.5mm", border: cellBorder, borderTop: 0, fontSize: "7.2pt", verticalAlign: "top" }}>{formatMoney(amount, settings)}</td>
            </tr>
          );
        }) : (
          <tr>
            <td colSpan={4} style={{ padding: "8mm", textAlign: "center", color: "#999" }}>No invoice items</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function SummarySection({ invoice, settings }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const currency = settings.defaultCurrency || "SGD";

  const subtotal = items.length
    ? items.reduce((sum, item) => sum + Number(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price || 0)), 0)
    : Number(invoice.total_amount || 0);

  let taxAmount = 0;
  if (settings.taxEnabled && settings.taxPercentage > 0) {
    if (settings.taxInclusive) {
      taxAmount = subtotal - (subtotal / (1 + settings.taxPercentage / 100));
    } else {
      taxAmount = subtotal * (settings.taxPercentage / 100);
    }
  }

  const total = settings.taxInclusive ? subtotal : subtotal + taxAmount;
  const displayTotal = Number(invoice.total_amount || total);
  const amountPaid = Math.min(displayTotal, Math.max(0, Number(invoice.amount_paid || 0)));
  const amountDue = Math.max(0, displayTotal - amountPaid);
  const dueDate = formatDate(invoice.due_date, settings.displayDateFormat);
  const paymentTerms = settings.paymentTerms || "Net 30";

  return (
    <section style={{ display: "grid", gridTemplateColumns: "56% 44%", breakInside: "avoid", borderBottom: `0.35mm solid ${primary}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "13mm 1fr", alignItems: "center", alignSelf: "end", minHeight: "18mm", paddingBottom: "2mm" }}>
        <div style={{ width: "10mm", height: "10mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: primary, color: "white" }}>
          <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
        </div>
        <div>
          <p style={{ margin: "0.65mm 0", fontSize: "7.4pt" }}><strong style={{ fontWeight: 800, textTransform: "uppercase" }}>Due Date: {dueDate}</strong></p>
          <p style={{ margin: "0.65mm 0", fontSize: "7.4pt" }}>Payment Term: {paymentTerms}</p>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", fontWeight: 800, textTransform: "uppercase" }}>Subtotal</td>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", textAlign: "right" }}>{formatMoney(subtotal, settings)}</td>
          </tr>
          {settings.taxEnabled && settings.taxPercentage > 0 && (
            <tr>
              <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", fontWeight: 800, textTransform: "uppercase" }}>{settings.taxName} ({settings.taxPercentage}%)</td>
              <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", textAlign: "right" }}>{formatMoney(taxAmount, settings)}</td>
            </tr>
          )}
          <tr>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", fontWeight: 800, textTransform: "uppercase" }}>Total {currency}</td>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", textAlign: "right" }}><strong>{formatMoney(displayTotal, settings)}</strong></td>
          </tr>
          <tr>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", fontWeight: 800, textTransform: "uppercase" }}>Less Amount Paid</td>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", border: "0.3mm solid #e0e3e8", fontSize: "7.3pt", textAlign: "right" }}>{formatMoney(amountPaid, settings)}</td>
          </tr>
          <tr>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", background: secondary, color: "white", fontWeight: 800, fontSize: "7.3pt", textTransform: "uppercase" }}>Amount Due {currency}</td>
            <td style={{ height: "10mm", padding: "2.6mm 3.5mm", background: secondary, color: "white", fontWeight: 800, fontSize: "7.3pt", textAlign: "right" }}>{formatMoney(amountDue, settings)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function PaymentSection({ settings, qrCodeUrl }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";
  const showBank = settings.bankDetailsDisplay;
  // Only show PayNow if there's actually an identifier configured
  const showPaynow = settings.paynowDisplay && settings.paynowIdentifier;
  // Only show the PayNow QR if qrCodeDisplay is on AND we have a PayNow QR
  const showQr = settings.qrCodeDisplay && qrCodeUrl && showPaynow;

  if (!showBank && !showPaynow) return null;

  return (
    <section style={{ breakInside: "avoid", borderBottom: "0.3mm solid #d8dce3" }}>
      <div style={{ display: "grid", gridTemplateColumns: showBank && showPaynow ? "58% 42%" : "1fr" }}>
        {showBank && (
          <div style={{ padding: "4mm 3mm 4mm 0", display: "grid", gridTemplateColumns: "13mm 1fr" }}>
            <div style={{ width: "10mm", height: "10mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: secondary, color: "white" }}>
              <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 19h18M2 7l10-5 10 5z" /></svg>
            </div>
            <div>
              <p style={{ margin: "0 0 1.5mm", fontSize: "7pt", fontWeight: 700 }}>We accept payment via bank transfer to the following:</p>
              <p style={{ margin: "0.6mm 0", fontSize: "7pt" }}>{settings.bankAccountHolderName}</p>
              <p style={{ margin: "0.6mm 0", fontSize: "7pt" }}>Bank: {settings.bankName}</p>
              <p style={{ margin: "0.6mm 0", fontSize: "7pt" }}>BIC/SWIFT: {settings.bicSwift}</p>
              <p style={{ margin: "0.6mm 0", fontSize: "7pt" }}>Account Number: {settings.bankAccountNumber}</p>
            </div>
          </div>
        )}
        {showPaynow && (
          <div style={{ padding: "4mm 3mm 4mm 5mm", borderLeft: showBank ? "1px solid #d8dce3" : "none", display: "grid", gridTemplateColumns: "13mm 1fr", alignItems: "center" }}>
            <div style={{ width: "10mm", height: "10mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: secondary, color: "white" }}>
              <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 6h6M8 10h8M8 14h5M10 18h4" /></svg>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
              <p style={{ margin: 0, fontSize: "7pt" }}>Payment via PayNow to <strong>{settings.paynowIdentifier}</strong></p>
              {showQr && <img src={qrCodeUrl} alt="QR" style={{ width: "18mm", height: "18mm", objectFit: "contain" }} />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StripePaymentSection({ invoice, settings, paymentUrl, qrCodeUrl }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";

  const isPaid = ["Paid", "Cancelled", "Refunded"].includes(invoice.status || "");
  if (isPaid) return null;

  const hasUrl = Boolean(paymentUrl && paymentUrl.startsWith("http"));

  return (
    <section style={{ breakInside: "avoid", borderBottom: "0.3mm solid #d8dce3", padding: "5mm 0", background: "#fff8f5" }}>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "13mm 1fr", alignItems: "center", marginBottom: "3mm" }}>
        <div style={{ width: "10mm", height: "10mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: secondary, color: "white" }}>
          <svg viewBox="0 0 24 24" width="5mm" height="5mm" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <path d="M1 10h22" />
          </svg>
        </div>
        <p style={{ margin: 0, fontSize: "7pt", fontWeight: 700, color: primary }}>
          Pay Online — Card, Apple Pay, Google Pay or PayNow
        </p>
      </div>

      {hasUrl ? (
        /* Content row: link + QR side by side */
        <div style={{ display: "grid", gridTemplateColumns: qrCodeUrl ? "1fr 28mm" : "1fr", gap: "4mm", paddingLeft: "13mm" }}>
          <div>
            <p style={{ margin: "0 0 2mm", fontSize: "6.5pt", color: "#555" }}>
              Click the link or scan the QR code to pay securely via Stripe:
            </p>
            {/* Big visible link box */}
            <div style={{ border: "0.5mm solid " + secondary, borderRadius: "1.5mm", padding: "2mm 3mm", marginBottom: "2mm", background: "#fff8f5" }}>
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "6.5pt", color: secondary, fontWeight: 700, wordBreak: "break-all", textDecoration: "underline" }}
              >
                {paymentUrl}
              </a>
            </div>
            {/* Pay Now button */}
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "2.5mm 6mm",
                background: secondary,
                color: "white",
                borderRadius: "1.5mm",
                fontSize: "7pt",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Pay Now →
            </a>
          </div>
          {qrCodeUrl && (
            <div style={{ textAlign: "center" }}>
              <img src={qrCodeUrl} alt="Scan to pay" style={{ width: "26mm", height: "26mm", objectFit: "contain", display: "block", border: "0.3mm solid #e0e3e8" }} />
              <p style={{ margin: "1mm 0 0", fontSize: "5.5pt", color: "#777", textAlign: "center" }}>Scan to pay</p>
            </div>
          )}
        </div>
      ) : (
        <p style={{ paddingLeft: "13mm", margin: 0, fontSize: "6.5pt", color: "#999" }}>
          Payment link will be generated when this invoice is sent.
        </p>
      )}
    </section>
  );
}

function SignatureSection({ settings, signatureUrl, stampUrl }) {
  if (!settings.signatureDisplay) return null;

  return (
    <section style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: "12mm", padding: "6mm 5mm 4mm", breakInside: "avoid" }}>
      {stampUrl && (
        <div style={{ textAlign: "center" }}>
          <img src={stampUrl} alt="Company Stamp" style={{ maxWidth: "30mm", maxHeight: "30mm", objectFit: "contain" }} />
          <p style={{ margin: "2mm 0 0", fontSize: "6pt", color: "#666" }}>Company Stamp</p>
        </div>
      )}
      {signatureUrl && (
        <div style={{ textAlign: "center" }}>
          <img src={signatureUrl} alt="Signature" style={{ maxWidth: "35mm", maxHeight: "20mm", objectFit: "contain" }} />
          <div style={{ width: "35mm", borderTop: "0.3mm solid #333", marginTop: "2mm" }} />
          <p style={{ margin: "2mm 0 0", fontSize: "6pt", color: "#666" }}>Authorized Signature</p>
        </div>
      )}
    </section>
  );
}

function FooterSection({ invoice, settings }) {
  const primary = settings.primaryColor || "#061e4b";
  const secondary = settings.secondaryColor || "#ff5a52";

  return (
    <footer style={{ marginTop: "auto", paddingTop: "4mm" }}>
      {settings.paymentReferenceInstruction && (
        <div style={{ display: "grid", gridTemplateColumns: "12mm 1fr", alignItems: "start", minHeight: "10mm", borderBottom: "0.3mm solid #d8dce3", padding: "2.5mm 0" }}>
          <div style={{ width: "8mm", height: "8mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: primary, color: "white" }}>
            <svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>
          </div>
          <p style={{ margin: 0, fontSize: "7pt", color: "#333", paddingTop: "1.5mm" }}>{settings.paymentReferenceInstruction}</p>
        </div>
      )}
      {settings.computerGeneratedStatement && (
        <div style={{ display: "grid", gridTemplateColumns: "12mm 1fr", alignItems: "start", minHeight: "10mm", borderBottom: "0.3mm solid #d8dce3", padding: "2.5mm 0" }}>
          <div style={{ width: "8mm", height: "8mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "#e8e8e8", color: "#666" }}>
            <svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
          <p style={{ margin: 0, fontSize: "7pt", color: "#555", paddingTop: "1.5mm" }}>{settings.computerGeneratedStatement}</p>
        </div>
      )}
      {(settings.registeredOfficeAddress || settings.financeEmail) && (
        <div style={{ display: "grid", gridTemplateColumns: "12mm 1fr", alignItems: "start", marginTop: "3mm", paddingTop: "3mm", borderTop: `0.3mm solid ${primary}` }}>
          <div style={{ width: "8mm", height: "8mm", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: secondary, color: "white" }}>
            <svg viewBox="0 0 24 24" width="4mm" height="4mm" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          </div>
          <p style={{ margin: 0, fontSize: "6.5pt", color: "#555", paddingTop: "1.5mm" }}>
            <strong>Registered Office:</strong> {[settings.financeEmail ? `Attention: ${settings.financeEmail}` : "", settings.registeredOfficeAddress || settings.companyAddress].filter(Boolean).join(", ")}
          </p>
        </div>
      )}
    </footer>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function InvoiceTemplate({ invoice, settings, options = {} }) {
  const mergedSettings = useMemo(() => ({
    primaryColor: "#061e4b",
    secondaryColor: "#ff5a52",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeBase: 12,
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
    invoiceBorderStyle: "modern",
    itemTableStyle: "striped",
    defaultCurrency: "SGD",
    paymentTerms: "Net 30",
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyRegistrationNumber: "",
    uenNumber: "",
    gstRegistrationNumber: "",
    bankAccountHolderName: "",
    bankName: "",
    bankAccountNumber: "",
    bicSwift: "",
    paynowIdentifier: "",
    paymentReferenceInstruction: "",
    computerGeneratedStatement: "",
    registeredOfficeAddress: "",
    financeEmail: "",
    ...settings,
  }), [settings]);

  const borderStyle = mergedSettings.invoiceBorderStyle || "modern";
  const borderCss = borderStyle === "classic"
    ? "1px solid #333"
    : borderStyle === "minimal"
      ? "none"
      : undefined; // modern = default

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "8mm 7.5mm 6mm",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
        position: "relative",
        fontFamily: mergedSettings.fontFamily,
        fontSize: `${mergedSettings.fontSizeBase}pt`,
        color: mergedSettings.primaryColor,
        background: "#fff",
        boxSizing: "border-box",
        ...(borderCss ? { border: borderCss } : {}),
      }}
    >
      <Watermark invoice={invoice} settings={mergedSettings} />
      <Header settings={mergedSettings} logoUrl={options.logoUrl} />
      <HeroSection invoice={invoice} settings={mergedSettings} />
      <ItemsTable invoice={invoice} settings={mergedSettings} />
      <SummarySection invoice={invoice} settings={mergedSettings} />
      <StripePaymentSection invoice={invoice} settings={mergedSettings} paymentUrl={options.paymentUrl || "https://checkout.stripe.com/test"} qrCodeUrl={options.stripeQrCodeUrl} />
      <PaymentSection settings={mergedSettings} qrCodeUrl={options.qrCodeUrl} />
      <SignatureSection settings={mergedSettings} signatureUrl={options.signatureUrl} stampUrl={options.stampUrl} />
      <FooterSection invoice={invoice} settings={mergedSettings} />
    </div>
  );
}

// Export utilities for reuse // v020646
export { formatDate, formatMoney };

