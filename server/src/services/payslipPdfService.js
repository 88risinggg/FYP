/**
 * Payslip PDF Service
 *
 * Generates PDF payslips for employees.
 * Uses html-pdf-node to render HTML to a PDF buffer.
 */

const fs = require("fs");
const path = require("path");

const VANIDAY_LOGO_DATA_URI = `data:image/jpeg;base64,${fs
  .readFileSync(path.join(__dirname, "..", "assets", "vaniday-logo.jpg"))
  .toString("base64")}`;

/**
 * Get the Puppeteer browser executable path.
 */
function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome";
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
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
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
  const money = (value) => `$ ${number(value).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const baseSalary = number(payslip.base_salary || (number(payslip.gross_salary) - number(payslip.total_allowances)));
  const earnings = [{ label: "Basic salary", rate: "1 Month", amount: baseSalary }];
  if (Array.isArray(allowanceItems) && allowanceItems.length) {
    allowanceItems.forEach((item) => earnings.push({ label: item.label || item.allowance_type || "Allowance", rate: item.rate || "-", amount: item.amount }));
  } else if (number(payslip.total_allowances) > 0) {
    earnings.push({ label: "Allowances and commissions", rate: "-", amount: payslip.total_allowances });
  }
  const deductions = [];
  const employeeCpf = number(payslip.employee_cpf || deductionBreakdown.employeeCpf);
  if (employeeCpf > 0) deductions.push({ label: "Employee CPF", rate: payslip.cpf_rate || "Applied rate", amount: employeeCpf });
  (deductionBreakdown.selfHelpGroups || []).forEach((item) => deductions.push({ label: item.fund || "Self-help fund", rate: "Wage band", amount: item.amount }));
  (deductionBreakdown.otherDeductions || []).forEach((item) => deductions.push({ label: item.label || "Other deduction", rate: "-", amount: item.amount }));
  const listedDeductions = deductions.reduce((sum, item) => sum + number(item.amount), 0);
  const deductionRemainder = Math.max(0, number(payslip.total_deductions) - listedDeductions);
  if (deductionRemainder > 0.005) deductions.push({ label: "Other deductions", rate: "-", amount: deductionRemainder });
  const totalEarnings = number(payslip.gross_salary) || earnings.reduce((sum, item) => sum + number(item.amount), 0);
  const totalDeductions = number(payslip.total_deductions) || deductions.reduce((sum, item) => sum + number(item.amount), 0);
  const netSalary = number(payslip.net_salary || payslip.net_pay) || totalEarnings - totalDeductions;
  const employerCpf = number(payslip.employer_cpf);
  const sdl = number(payslip.sdl || deductionBreakdown.sdl);
  const claims = parseJson(payslip.claims, []);
  const releasedClaims = Array.isArray(claims) ? claims : [];
  const totalClaims = releasedClaims.reduce((sum, claim) => sum + number(claim.amount), 0);
  const employeeName = payslip.employee_name || payslip.staff_name || "Employee";
  const companyName = payslip.company_name || "Vaniday Singapore Pte. Ltd.";
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
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="payslip">
    <header class="header"><img class="logo" src="${VANIDAY_LOGO_DATA_URI}" alt="Vaniday logo"><div><div class="company">${escapeHtml(companyName)} - Payslip</div><div class="title">${escapeHtml(employeeName)} for ${escapeHtml(period)}</div></div></header>
    <div class="accent"></div>
    <section class="employee"><div class="employee-grid"><div><span class="label">Employee:</span> ${escapeHtml(employeeName)} (${escapeHtml(payslip.employee_code || payslip.employee_id || "-")})</div><div><span class="label">Primary work location:</span> ${escapeHtml(payslip.work_location || payslip.department_name || payslip.department || "-")}</div><div><span class="label">Working days:</span> ${escapeHtml(payslip.working_days ?? payslip.payable_days ?? "-")}</div><div><span class="label">No pay leave:</span> ${escapeHtml(payslip.no_pay_leave ?? payslip.no_pay_leave_days ?? 0)}</div></div></section>
    <div class="break"></div>
    <section class="pay-grid"><div class="pay-column"><table><thead><tr><th>Earnings</th><th class="rate">Rate</th><th class="amount">Amount</th></tr></thead><tbody class="items">${rowsHtml(earnings, "No earnings")}</tbody></table></div><div class="pay-column"><table><thead><tr><th>Deductions</th><th class="rate">Rate</th><th class="amount">Amount</th></tr></thead><tbody class="items">${rowsHtml(deductions, "No deductions")}</tbody></table></div></section>
    <section class="totals"><div class="total"><span>Total earnings:</span><span>${money(totalEarnings)}</span></div><div class="total"><span>Total deductions:</span><span>${money(totalDeductions)}</span></div></section>
    <section class="summary"><div class="summary-row net"><span class="summary-label">Net pay</span><span class="summary-value">${money(netSalary)}</span></div>${employerCpf ? `<div class="summary-row"><span class="summary-label">Employer CPF contribution</span><span class="summary-value">${money(employerCpf)}</span></div>` : ""}${sdl ? `<div class="summary-row"><span class="summary-label">Skills Development Levy (SDL)</span><span class="summary-value">${money(sdl)}</span></div>` : ""}</section>
    ${releasedClaims.length ? `<section class="claims"><h3>Claim reimbursements (released separately)</h3>${releasedClaims.map((claim) => `<div class="claim-row"><span>${escapeHtml(claim.claim_type || "Expense claim")} · ${escapeHtml(claim.claim_id || "")}</span><span>${escapeHtml(claim.expense_date ? new Date(claim.expense_date).toLocaleDateString("en-SG") : "")}</span><span>${money(claim.amount)}</span></div>`).join("")}<div class="claim-row claim-total"><span>Total released claims</span><span></span><span>${money(totalClaims)}</span></div></section>` : ""}
    <section class="notes"><strong>Note:</strong> ${escapeHtml(payslip.notes || "This is a computer-generated payslip. No signature is required.")}</section>
    <footer class="footer">Confidential payroll document issued by ${escapeHtml(companyName)}${payslip.layout?.layout_name ? ` · Layout: ${escapeHtml(payslip.layout.layout_name)}` : ""}</footer>
  </main>
</body>
</html>`;
}

module.exports = { buildPayslipHtml, generatePayslipPDF, launchPayslipBrowser };
