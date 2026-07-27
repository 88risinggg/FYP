/**
 * Payslip PDF Service
 *
 * Generates PDF payslips for employees.
 * Uses html-pdf-node to render HTML to a PDF buffer.
 */

const fs = require("fs");
const path = require("path");

const PAYNIVO_LOGO_DATA_URI = `data:image/png;base64,${fs
  .readFileSync(path.join(__dirname, "..", "assets", "paynivo-logo.png"))
  .toString("base64")}`;

function companyLogoDataUri(payslip) {
  const databaseLogo = payslip.company_logo_data;
  if (databaseLogo && (Buffer.isBuffer(databaseLogo) || databaseLogo instanceof Uint8Array)) {
    const mime = ["image/png", "image/jpeg"].includes(payslip.company_logo_mime)
      ? payslip.company_logo_mime
      : "image/png";
    return `data:${mime};base64,${Buffer.from(databaseLogo).toString("base64")}`;
  }
  const stored = String(payslip.company_logo_path || "");
  if (!stored) return PAYNIVO_LOGO_DATA_URI;
  const absolute = path.resolve(__dirname, "..", "..", stored);
  const root = path.resolve(__dirname, "..", "..", "uploads", "company-branding");
  if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute)) return PAYNIVO_LOGO_DATA_URI;
  const extension = path.extname(absolute).toLowerCase();
  const mime = extension === ".png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(absolute).toString("base64")}`;
}

/**
 * Get the Puppeteer browser executable path.
 */
function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === "win32") {
    // Check user-level install first (most common on dev machines), then system-wide
    const candidates = [
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`,
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }
    return candidates[1]; // fall back to default system path
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  const candidates = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

/**
 * Generate a payslip PDF buffer from payslip data.
 *
 * @param {Object} payslip - Payslip data including employee info and salary breakdown.
 * @returns {Buffer} PDF file buffer.
 */
async function launchPayslipBrowser() {
  const puppeteer = await import("puppeteer-core");
  return puppeteer.launch({
    headless: true,
    executablePath: getExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}

async function generatePayslipPDF(payslip, existingBrowser = null) {
  const html = buildPayslipHtml(payslip);
  const browser = existingBrowser || await launchPayslipBrowser();
  let page;

  try {
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      printBackground: true
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (page) await page.close().catch(() => null);
    if (!existingBrowser) await browser.close();
  }
}

/**
 * Build HTML content for the payslip PDF.
 */
function buildPayslipHtml(payslip) {
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = (value) => `${payslip.company_currency || "SGD"} ${number(value).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const parseJson = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const month = Number(payslip.payroll_month || payslip.period_month);
  const year = Number(payslip.payroll_year || payslip.period_year);
  const period = month >= 1 && month <= 12 && year
    ? new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1))
    : "Payroll period";
  const allowanceItems = parseJson(payslip.allowance_breakdown, []);
  const deductionBreakdown = parseJson(payslip.deduction_breakdown, {});
  const reimbursements = Array.isArray(deductionBreakdown.reimbursements) ? deductionBreakdown.reimbursements : [];
  const baseSalary = number(payslip.base_salary || payslip.basic_salary || (number(payslip.gross_salary || payslip.gross_pay) - number(payslip.total_allowances || payslip.allowances)));
  const earnings = [{ label: "Basic salary", rate: "1 Month", amount: baseSalary }];
  if (Array.isArray(allowanceItems) && allowanceItems.length) {
    allowanceItems.forEach((item) => earnings.push({ label: item.label || item.allowance_type || "Allowance", rate: item.rate || "-", amount: item.amount }));
  } else if (number(payslip.total_allowances) > 0) {
    const reimbursementTotal = reimbursements.reduce((sum, item) => sum + number(item.amount), 0);
    const otherAllowances = Math.max(0, number(payslip.total_allowances) - reimbursementTotal);
    if (otherAllowances > 0.005) earnings.push({ label: "Allowances and commissions", rate: "-", amount: otherAllowances });
  }
  reimbursements.forEach((item) => earnings.push({ label: item.label || `Claim reimbursement ${item.claimId || ""}`, rate: item.expenseDate ? `Expense ${String(item.expenseDate).slice(0, 10)} · Non-CPF` : "Non-CPF", amount: item.amount }));
  const deductions = [];
  const employeeCpf = number(payslip.employee_cpf || deductionBreakdown.employeeCpf);
  if (employeeCpf > 0) deductions.push({ label: "Employee CPF", rate: payslip.cpf_rate || "Applied rate", amount: employeeCpf });
  const selfHelpGroups = Array.isArray(deductionBreakdown.selfHelpGroups) ? deductionBreakdown.selfHelpGroups : [];
  selfHelpGroups.forEach((item) => deductions.push({ label: item.fund || "Self-help fund", rate: "Wage band", amount: item.amount }));
  const storedMbmf = number(payslip.mbmf_amount || payslip.mbmf);
  if (!selfHelpGroups.length && storedMbmf > 0) deductions.push({ label: "Employee MBMF", rate: "Wage band", amount: storedMbmf });
  (deductionBreakdown.otherDeductions || []).forEach((item) => deductions.push({
    label: item.label || "Other deduction",
    rate: number(item.deferredAmount) > 0 ? `SGD ${number(item.deferredAmount).toFixed(2)} deferred` : "-",
    amount: item.amount
  }));
  const listedDeductions = deductions.reduce((sum, item) => sum + number(item.amount), 0);
  const deductionRemainder = Math.max(0, number(payslip.total_deductions) - listedDeductions);
  if (deductionRemainder > 0.005) deductions.push({ label: "Other deductions", rate: "-", amount: deductionRemainder });
  const totalEarnings = number(payslip.gross_salary || payslip.gross_pay) || earnings.reduce((sum, item) => sum + number(item.amount), 0);
  const totalDeductions = number(payslip.total_deductions) || deductions.reduce((sum, item) => sum + number(item.amount), 0);
  const netSalary = number(payslip.net_salary || payslip.net_pay) || totalEarnings - totalDeductions;
  const employerCpf = number(payslip.employer_cpf);
  const sdl = number(payslip.sdl || deductionBreakdown.sdl);
  const claims = parseJson(payslip.claims, []);
  const includedClaims = Array.isArray(claims) ? claims : [];
  const employeeName = payslip.employee_name || payslip.staff_name || "Employee";
  const companyName = payslip.company_name || "PayNivo";
  const legalName = payslip.company_legal_name || companyName;
  const currency = payslip.company_currency || "SGD";
  const brandColor = /^#[0-9a-f]{6}$/i.test(String(payslip.company_brand_color || ""))
    ? String(payslip.company_brand_color)
    : "#ef2b32";
  const logo = companyLogoDataUri(payslip);
  const lastDay = month && year ? new Date(year, month, 0) : new Date();
  const firstDay = month && year ? new Date(year, month - 1, 1) : new Date();
  const shortDate = (date) => new Intl.DateTimeFormat("en-SG", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  const payDate = payslip.pay_date ? new Date(payslip.pay_date) : lastDay;
  const payslipNumber = `PS-${year || payDate.getFullYear()}-${String(month || payDate.getMonth() + 1).padStart(2, "0")}-${String(payslip.payroll_id || payslip.payslip_id || 0).padStart(4, "0")}`;
  const rowsHtml = (rows, emptyLabel) => (rows.length ? rows : [{ label: emptyLabel, rate: "-", amount: 0 }])
    .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td class="rate">${escapeHtml(row.rate)}</td><td class="amount">${money(row.amount)}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payslip - ${escapeHtml(employeeName)} - ${escapeHtml(period)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #555e76; font: 12px/1.35 Arial, Helvetica, sans-serif; }
    .payslip { border: 1px solid #303440; background: #fff; }
    .header { display: flex; align-items: center; gap: 18px; min-height: 100px; padding: 10px 18px; border-bottom: 1px solid #303440; background: #212121; }
    .logo { width: 220px; height: 78px; object-fit: contain; object-position: left center; }
    .company { font-size: 15px; color: #d8d8dc; }
    .title { margin-top: 5px; color: #fff; font-size: 17px; font-weight: 700; }
    .accent { height: 4px; background: #ef665b; }
    .employee { padding: 12px 18px; border-bottom: 1px solid #303440; }
    .employee-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 28px; }
    .label { color: #58627b; font-weight: 700; }
    .break { height: 16px; border-bottom: 1px solid #303440; }
    .pay-grid { display: grid; grid-template-columns: 1fr 1fr; }
    .pay-column:first-child { border-right: 1px solid #303440; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { padding: 9px 10px; border-bottom: 1px solid #303440; text-align: left; color: #58627b; }
    th:first-child { width: 50%; }
    th.rate, .rate { width: 23%; }
    .amount { width: 27%; text-align: right; white-space: nowrap; }
    td { padding: 7px 10px; vertical-align: top; }
    .items { min-height: 130px; }
    .items tr:last-child td { padding-bottom: 14px; }
    .totals { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #303440; border-bottom: 1px solid #303440; color: #4b556f; font-weight: 700; }
    .total { display: flex; justify-content: space-between; padding: 9px 10px; }
    .total:first-child { border-right: 1px solid #303440; }
    .summary { padding: 9px 10px 12px; }
    .summary-row { display: grid; grid-template-columns: 1fr 150px; gap: 15px; padding: 3px 0; }
    .summary-label, .summary-value { text-align: right; }
    .net { color: #30364d; font-weight: 700; }
    .notes { min-height: 52px; padding: 10px 12px; border-top: 1px solid #303440; }
    .footer { padding: 8px 12px; border-top: 1px solid #e1e3e9; color: #8a8f9d; text-align: center; font-size: 9px; }
    .claims { border-top: 1px solid #303440; padding: 10px 12px; }
    .claims h3 { margin: 0 0 7px; color: #30364d; font-size: 12px; }
    .claim-row { display: grid; grid-template-columns: 1fr 90px 110px; gap: 10px; padding: 4px 0; }
    .claim-row span:last-child { text-align: right; }
    .claim-total { margin-top: 5px; padding-top: 6px; border-top: 1px solid #e1e3e9; font-weight: 700; }
    @page { size: A4 landscape; margin: 0; }
    body { color: #161616; font-size: 10px; }
    .payslip { position: relative; width: 297mm; height: 209mm; overflow: hidden; border: 0; }
    .header { height: 40mm; display: grid; grid-template-columns: 29% 43% 28%; align-items: center; gap: 0; padding: 5mm 10mm 4mm; background: linear-gradient(120deg, #071622, #03101a); border-bottom: 3px solid ${brandColor}; }
    .brand { display: flex; align-items: center; height: 30mm; padding-right: 7mm; border-right: 1px solid #777; }
    .logo { width: 56mm; height: 25mm; object-fit: contain; object-position: left center; filter: invert(1) grayscale(1) brightness(3); mix-blend-mode: screen; }
    .company { display: flex; height: 30mm; flex-direction: column; justify-content: center; padding: 2mm 7mm 0; border-right: 1px solid #777; color: #fff; font-size: 11.5px; line-height: 1.4; }
    .company h1 { margin: 0 0 4px; font-size: 19px; line-height: 1.15; }
    .company p, .document p { margin: 2px 0; }
    .document { display: flex; height: 30mm; flex-direction: column; justify-content: center; padding: 2mm 0 0 7mm; color: #fff; font-size: 11px; line-height: 1.35; }
    .document h2 { margin: 0 0 3px; font-size: 21px; line-height: 1.1; }
    .document h3 { margin: 0 0 3px; font-size: 19px; line-height: 1.1; }
    .meta { display: grid; grid-template-columns: 54% 46%; gap: 8mm; padding: 7mm 10mm 5mm; }
    .meta-card { display: grid; grid-template-columns: 40mm 1fr; align-content: start; row-gap: 5px; }
    .meta-card + .meta-card { padding-left: 8mm; border-left: 1px solid #aeb7c0; }
    .meta-card h3 { grid-column: 1 / -1; margin: 0 0 3mm; color: ${brandColor}; font-size: 12px; text-transform: uppercase; }
    .meta-card strong { font-weight: 400; } .meta-card span { font-weight: 600; }
    .pay-grid { gap: 3mm; padding: 4mm 8mm 0; }
    .pay-column { overflow: hidden; border: 1px solid #bbb; border-radius: 4px; }
    .pay-column:first-child { border-right: 1px solid #bbb; }
    th { padding: 8px 9px; background: #071622; color: white; text-transform: uppercase; }
    td { padding: 7px 9px; border-right: 1px solid #e0e0e0; } td:last-child { border-right: 0; }
    .items { height: 38mm; }
    .total-row td { border-top: 1px solid #bbb; background: #f5f5f5; font-weight: 700; text-transform: uppercase; }
    .net-box { margin: 3mm 8mm 0 50%; border: 1px solid #d4d9de; overflow: hidden; }
    .net-head { display: flex; justify-content: space-between; padding: 7px 12px; background: #071622; color: #fff; font-size: 14px; font-weight: 700; }
    .employer { padding: 5px 12px; background: #f3f4f5; } .employer div { display: flex; justify-content: space-between; padding: 2px 0; }
    .notes { min-height: 0; margin: 3mm 8mm 0; padding: 7px 12px; border-bottom: 1px solid #bbb; }
    .confidential { margin: 2mm 8mm 0; text-align: center; color: #536174; font-size: 9px; }
    .confidential strong { display: block; color: #142337; letter-spacing: .08em; }
    .claims { margin: 3mm 8mm 0; padding: 6px 10px; border: 1px solid #ddd; }
    .footer { position: absolute; right: 8mm; bottom: 3mm; left: 8mm; margin: 0; padding: 5px 4px; border-top: 0; color: #657184; text-align: center; font-size: 8px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="payslip">
    <header class="header"><div class="brand"><img class="logo" src="${logo}" alt="${escapeHtml(companyName)} logo"></div><div class="company"><h1>${escapeHtml(legalName)}</h1><p>UEN: ${escapeHtml(payslip.company_registration_number || "Not configured")}</p><p>${escapeHtml(payslip.company_address || "Business address not configured")}</p><p>${escapeHtml(payslip.company_email || "")} &nbsp; ${escapeHtml(payslip.company_phone || "")}</p></div><div class="document"><h2>PAYSLIP</h2><h3>${escapeHtml(employeeName)}</h3><p>for ${escapeHtml(period)}</p></div></header>
    <section class="meta"><div class="meta-card"><h3>Employee information</h3><strong>Employee</strong><span>${escapeHtml(employeeName)} (${escapeHtml(payslip.employee_code || payslip.employee_id || "-")})</span><strong>Primary work location</strong><span>${escapeHtml(payslip.work_location || "Singapore")}</span><strong>Working days</strong><span>${escapeHtml(payslip.working_days ?? payslip.payable_days ?? "-")}</span><strong>No-pay leave</strong><span>${escapeHtml(payslip.no_pay_leave ?? payslip.no_pay_leave_days ?? 0)}</span></div><div class="meta-card"><h3>Payroll details</h3><strong>Payslip No.</strong><span>${escapeHtml(payslipNumber)}</span><strong>Pay date</strong><span>${shortDate(payDate)}</span><strong>Pay period</strong><span>${shortDate(firstDay)} – ${shortDate(lastDay)}</span><strong>Payment method</strong><span>${escapeHtml(payslip.payment_method || "Bank Transfer")}</span></div></section>
    <section class="pay-grid"><div class="pay-column"><table><thead><tr><th>Earnings</th><th class="rate">Rate</th><th class="amount">Amount (${escapeHtml(currency)})</th></tr></thead><tbody class="items">${rowsHtml(earnings, "No earnings")}</tbody><tfoot><tr class="total-row"><td colspan="2">Total earnings</td><td class="amount">${money(totalEarnings)}</td></tr></tfoot></table></div><div class="pay-column"><table><thead><tr><th>Deductions</th><th class="rate">Rate</th><th class="amount">Amount (${escapeHtml(currency)})</th></tr></thead><tbody class="items">${rowsHtml(deductions, "No deductions")}</tbody><tfoot><tr class="total-row"><td colspan="2">Total deductions</td><td class="amount">${money(totalDeductions)}</td></tr></tfoot></table></div></section>
    <section class="net-box"><div class="net-head"><span>NET PAY</span><strong>${money(netSalary)}</strong></div><div class="employer"><div><span>Employer CPF contribution</span><strong>${money(employerCpf)}</strong></div><div><span>Skills Development Levy (SDL)</span><strong>${money(sdl)}</strong></div></div></section>
    ${includedClaims.length ? `<section class="claims"><h3>Payroll reimbursement audit references</h3>${includedClaims.map((claim) => `<div class="claim-row"><span>${escapeHtml(claim.claim_type || "Expense claim")} · ${escapeHtml(claim.claim_id || "")}</span><span>${escapeHtml(claim.expense_date ? new Date(claim.expense_date).toLocaleDateString("en-SG") : "")}</span><span>Included above</span></div>`).join("")}</section>` : ""}
    <section class="notes"><strong>ⓘ &nbsp; Note:</strong> ${escapeHtml(payslip.notes || "This is a computer-generated payslip and does not require a signature.")}</section>
    <section class="confidential"><strong>CONFIDENTIAL</strong><span>This payslip is confidential and intended solely for the addressee.</span></section>
    <footer class="footer">This payslip was generated by PayNivo Payroll System on behalf of ${escapeHtml(legalName)} · ${new Date().toLocaleString("en-SG", { timeZone: payslip.company_timezone || "Asia/Singapore" })}</footer>
  </main>
</body>
</html>`;
}

module.exports = { buildPayslipHtml, generatePayslipPDF, launchPayslipBrowser };
