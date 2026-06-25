/**
 * Payslip PDF Service
 *
 * Generates PDF payslips for employees.
 * Uses html-pdf-node to render HTML to a PDF buffer.
 */

const htmlPdf = require("html-pdf-node");

/**
 * Generate a payslip PDF buffer from payslip data.
 *
 * @param {Object} payslip - Payslip data including employee info and salary breakdown.
 * @returns {Buffer} PDF file buffer.
 */
async function generatePayslipPDF(payslip) {
  const html = buildPayslipHtml(payslip);
  const file = { content: html };
  const options = {
    format: "A4",
    margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    printBackground: true
  };

  return await htmlPdf.generatePdf(file, options);
}

/**
 * Build HTML content for the payslip PDF.
 */
function buildPayslipHtml(payslip) {
  const baseSalary = Number(payslip.base_salary || 0).toFixed(2);
  const allowances = Number(payslip.total_allowances || 0).toFixed(2);
  const deductions = Number(payslip.total_deductions || 0).toFixed(2);
  const netSalary = Number(payslip.net_salary || 0).toFixed(2);
  const employeeCpf = Number(payslip.employee_cpf || 0).toFixed(2);
  const employerCpf = Number(payslip.employer_cpf || 0).toFixed(2);
  const period = `${payslip.payroll_month || ""}/${payslip.payroll_year || ""}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a2e; margin: 0; padding: 32px; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #7B2FF7; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 28px; font-weight: 900; color: #7B2FF7; }
    .meta { text-align: right; font-size: 13px; color: #666; }
    .meta h2 { margin: 0; font-size: 18px; color: #333; }
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7B2FF7; margin: 0 0 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
    .info-grid .label { color: #666; }
    .info-grid .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f3edff; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #555; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
    td.amount { text-align: right; font-weight: 600; }
    .total-row td { border-top: 2px solid #7B2FF7; font-weight: 900; font-size: 15px; }
    .footer { margin-top: 32px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">PayNivo</div>
    <div class="meta">
      <h2>Payslip</h2>
      <p>Period: ${period}</p>
      <p>Generated: ${new Date().toLocaleDateString("en-SG")}</p>
    </div>
  </div>

  <div class="section">
    <h3>Employee Information</h3>
    <div class="info-grid">
      <span class="label">Name:</span><span class="value">${payslip.employee_name || ""}</span>
      <span class="label">Employee Code:</span><span class="value">${payslip.employee_code || ""}</span>
      <span class="label">Department:</span><span class="value">${payslip.department || ""}</span>
      <span class="label">Designation:</span><span class="value">${payslip.designation || ""}</span>
    </div>
  </div>

  <div class="section">
    <h3>Earnings</h3>
    <table>
      <thead><tr><th>Component</th><th style="text-align:right">Amount (SGD)</th></tr></thead>
      <tbody>
        <tr><td>Basic Salary</td><td class="amount">$${baseSalary}</td></tr>
        <tr><td>Allowances</td><td class="amount">$${allowances}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Deductions</h3>
    <table>
      <thead><tr><th>Component</th><th style="text-align:right">Amount (SGD)</th></tr></thead>
      <tbody>
        <tr><td>Employee CPF (${payslip.cpf_rate || "20%"})</td><td class="amount">$${employeeCpf}</td></tr>
        <tr><td>Other Deductions</td><td class="amount">$${(Number(deductions) - Number(employeeCpf)).toFixed(2)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>Employer Contributions</h3>
    <table>
      <thead><tr><th>Component</th><th style="text-align:right">Amount (SGD)</th></tr></thead>
      <tbody>
        <tr><td>Employer CPF</td><td class="amount">$${employerCpf}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <table>
      <tbody>
        <tr class="total-row"><td>Net Pay</td><td class="amount">SGD $${netSalary}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    This is a system-generated payslip from PayNivo Automated Payroll System.<br>
    No signature is required.
  </div>
</body>
</html>`;
}

module.exports = { generatePayslipPDF };
