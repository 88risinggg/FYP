import vanidayLogoDataUrl from "../assets/vaniday-logo.jpg?inline";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return `$ ${number(value).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function monthLabel(month, year) {
  const numericMonth = Number(month);
  if (numericMonth >= 1 && numericMonth <= 12 && year) {
    return new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric" })
      .format(new Date(Number(year), numericMonth - 1, 1));
  }
  return [month, year].filter(Boolean).join(" ") || "Payroll period";
}

function rowsHtml(rows, emptyLabel) {
  const effectiveRows = rows.length ? rows : [{ label: emptyLabel, rate: "-", amount: 0 }];
  return effectiveRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td class="rate">${escapeHtml(row.rate || "-")}</td>
      <td class="amount">${money(row.amount)}</td>
    </tr>`).join("");
}

export function normalizeVanidayPayslip(payslip = {}) {
  const allowanceItems = parseJson(payslip.allowance_breakdown, payslip.allowances || []);
  const deductionBreakdown = parseJson(payslip.deduction_breakdown, {});
  const basicSalary = number(payslip.base_salary ?? payslip.basic_salary ?? (number(payslip.gross_salary) - number(payslip.total_allowances)));
  const earnings = [{ label: "Basic salary", rate: "1 Month", amount: basicSalary }];

  if (Array.isArray(allowanceItems) && allowanceItems.length) {
    allowanceItems.forEach((item) => earnings.push({
      label: item.allowance_type || item.label || "Allowance",
      rate: item.rate || "-",
      amount: item.amount
    }));
  } else if (number(payslip.total_allowances) > 0) {
    earnings.push({ label: "Allowances and commissions", rate: "-", amount: payslip.total_allowances });
  }

  const deductions = [];
  if (Array.isArray(payslip.deductions) && payslip.deductions.length) {
    payslip.deductions.forEach((item) => deductions.push({
      label: item.deduction_type || item.label || "Deduction",
      rate: item.rate || "-",
      amount: item.amount
    }));
  } else {
    const employeeCpf = number(payslip.employee_cpf ?? payslip.cpf_employee_deduction ?? deductionBreakdown.employeeCpf);
    if (employeeCpf > 0) deductions.push({ label: "Employee CPF", rate: payslip.cpf_rate || "Applied rate", amount: employeeCpf });
    (deductionBreakdown.selfHelpGroups || []).forEach((item) => deductions.push({ label: item.fund || "Self-help fund", rate: "Wage band", amount: item.amount }));
    (deductionBreakdown.otherDeductions || []).forEach((item) => deductions.push({ label: item.label || "Other deduction", rate: "-", amount: item.amount }));
    const listedTotal = deductions.reduce((sum, item) => sum + number(item.amount), 0);
    const remainder = Math.max(0, number(payslip.total_deductions) - listedTotal);
    if (remainder > 0.005) deductions.push({ label: "Other deductions", rate: "-", amount: remainder });
  }

  const totalEarnings = number(payslip.gross_salary) || earnings.reduce((sum, item) => sum + number(item.amount), 0);
  const totalDeductions = number(payslip.total_deductions) || deductions.reduce((sum, item) => sum + number(item.amount), 0);

  return {
    companyName: payslip.company_name || "Vaniday Singapore Pte. Ltd.",
    employeeName: payslip.employee_name || payslip.staff_name || payslip.name || "Employee",
    employeeCode: payslip.employee_code || payslip.employee_id || "-",
    workLocation: payslip.work_location || payslip.primary_work_location || payslip.department_name || payslip.department || "-",
    workingDays: payslip.working_days ?? payslip.payable_days ?? "-",
    noPayLeave: payslip.no_pay_leave ?? payslip.no_pay_leave_days ?? 0,
    period: monthLabel(payslip.payroll_month ?? payslip.period_month, payslip.payroll_year ?? payslip.period_year),
    earnings,
    deductions,
    totalEarnings,
    totalDeductions,
    netPay: number(payslip.net_salary ?? payslip.net_pay) || totalEarnings - totalDeductions,
    employerCpf: number(payslip.employer_cpf ?? payslip.cpf_employer_contribution),
    sdl: number(payslip.sdl ?? deductionBreakdown.sdl),
    notes: payslip.notes || "This is a computer-generated payslip. No signature is required."
  };
}

export function buildVanidayPayslipHtml(payslip = {}) {
  const data = normalizeVanidayPayslip(payslip);
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Payslip - ${escapeHtml(data.employeeName)} - ${escapeHtml(data.period)}</title>
<style>
  @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#555e76;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35}.payslip{width:100%;border:1px solid #303440;background:#fff}.header{display:flex;align-items:center;gap:18px;min-height:100px;padding:10px 18px;border-bottom:1px solid #303440;background:#212121}.logo{width:220px;height:78px;object-fit:contain;object-position:left center}.heading{min-width:0}.company{font-size:15px;color:#d8d8dc}.title{margin-top:5px;font-size:17px;font-weight:700;color:#fff}.accent{height:4px;background:#ef665b}.employee{padding:12px 18px;border-bottom:1px solid #303440}.employee-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 28px}.label{font-weight:700;color:#58627b}.break{height:16px;border-bottom:1px solid #303440}.pay-grid{display:grid;grid-template-columns:1fr 1fr}.pay-column:first-child{border-right:1px solid #303440}table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:9px 10px;border-bottom:1px solid #303440;text-align:left;font-size:12px;color:#58627b}th:first-child{width:50%}th.rate,.rate{width:23%;text-align:left}.amount{width:27%;text-align:right;white-space:nowrap}td{padding:7px 10px;vertical-align:top}.items{min-height:130px}.items tr:last-child td{padding-bottom:14px}.totals{border-top:1px solid #303440;border-bottom:1px solid #303440;font-weight:700;color:#4b556f}.totals>div{display:grid;grid-template-columns:1fr 1fr}.totals>div>div{display:flex;justify-content:space-between;padding:9px 10px}.totals>div>div:first-child{border-right:1px solid #303440}.summary{padding:9px 10px 12px}.summary-row{display:grid;grid-template-columns:1fr 150px;gap:15px;padding:3px 0}.summary-label{text-align:right}.summary-value{text-align:right}.net{font-weight:700;color:#30364d}.notes{min-height:52px;padding:10px 12px;border-top:1px solid #303440}.notes strong{color:#58627b}.footer{padding:8px 12px;border-top:1px solid #e1e3e9;text-align:center;font-size:9px;color:#8a8f9d}@media(max-width:650px){body{padding:0}.header{align-items:flex-start;flex-direction:column}.employee-grid,.pay-grid{grid-template-columns:1fr}.pay-column:first-child{border-right:0;border-bottom:1px solid #303440}.totals>div{grid-template-columns:1fr}.totals>div>div:first-child{border-right:0;border-bottom:1px solid #303440}}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><main class="payslip">
  <header class="header"><img class="logo" src="${vanidayLogoDataUrl}" alt="Vaniday logo"><div class="heading"><div class="company">${escapeHtml(data.companyName)} - Payslip</div><div class="title">${escapeHtml(data.employeeName)} for ${escapeHtml(data.period)}</div></div></header><div class="accent"></div>
  <section class="employee"><div class="employee-grid"><div><span class="label">Employee:</span> ${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})</div><div><span class="label">Primary work location:</span> ${escapeHtml(data.workLocation)}</div><div><span class="label">Working days:</span> ${escapeHtml(data.workingDays)}</div><div><span class="label">No pay leave:</span> ${escapeHtml(data.noPayLeave)}</div></div></section><div class="break"></div>
  <section class="pay-grid"><div class="pay-column"><table><thead><tr><th>Earnings</th><th class="rate">Rate</th><th class="amount">Amount</th></tr></thead><tbody class="items">${rowsHtml(data.earnings, "No earnings")}</tbody></table></div><div class="pay-column"><table><thead><tr><th>Deductions</th><th class="rate">Rate</th><th class="amount">Amount</th></tr></thead><tbody class="items">${rowsHtml(data.deductions, "No deductions")}</tbody></table></div></section>
  <section class="totals"><div><div><span>Total earnings:</span><span>${money(data.totalEarnings)}</span></div><div><span>Total deductions:</span><span>${money(data.totalDeductions)}</span></div></div></section>
  <section class="summary"><div class="summary-row net"><span class="summary-label">Net pay</span><span class="summary-value">${money(data.netPay)}</span></div>${data.employerCpf ? `<div class="summary-row"><span class="summary-label">Employer CPF contribution</span><span class="summary-value">${money(data.employerCpf)}</span></div>` : ""}${data.sdl ? `<div class="summary-row"><span class="summary-label">Skills Development Levy (SDL)</span><span class="summary-value">${money(data.sdl)}</span></div>` : ""}</section>
  <section class="notes"><strong>Note:</strong> ${escapeHtml(data.notes)}</section><footer class="footer">Confidential payroll document issued by ${escapeHtml(data.companyName)}</footer>
</main></body></html>`;
}
