/**
 * Export Controller
 *
 * Handles data exports for invoices and reports in Excel/CSV formats.
 * Uses the exceljs package for workbook generation.
 */

const ExcelJS = require("exceljs");
const { pool } = require("../config/db");

/**
 * GET /api/invoices/export/excel
 *
 * Exports all invoices as an Excel file (.xlsx).
 * Includes invoice details, customer info, and totals.
 */
async function exportInvoicesExcel(req, res) {
  try {
    const [invoices] = await pool.query(`
      SELECT
        i.invoiceId AS "Invoice Number",
        c.name AS "Customer Name",
        c.email AS "Customer Email",
        i.status AS "Status",
        DATE_FORMAT(i.issue_date, '%Y-%m-%d') AS "Issue Date",
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS "Due Date",
        i.total_amount AS "Total Amount (SGD)"
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY i.invoice_id DESC
    `);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PayNivo Invoicing System";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Invoices");

    // Define columns
    sheet.columns = [
      { header: "Invoice Number", key: "Invoice Number", width: 18 },
      { header: "Customer Name", key: "Customer Name", width: 25 },
      { header: "Customer Email", key: "Customer Email", width: 30 },
      { header: "Status", key: "Status", width: 14 },
      { header: "Issue Date", key: "Issue Date", width: 14 },
      { header: "Due Date", key: "Due Date", width: 14 },
      { header: "Total Amount (SGD)", key: "Total Amount (SGD)", width: 20 }
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF7B2FF7" }
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Add data rows
    invoices.forEach((inv) => sheet.addRow(inv));

    // Set response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=invoices-export.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Failed to export invoices.", detail: error.message });
  }
}

/**
 * GET /api/reports/invoices/export/excel
 *
 * Exports invoice financial report as an Excel file.
 * Includes summary, monthly breakdown, status distribution, aging, and top customers.
 */
async function exportReportExcel(req, res) {
  try {
    // Revenue summary
    const [summaryRows] = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN status <> 'Paid' THEN total_amount ELSE 0 END), 0) AS outstanding,
        COUNT(*) AS invoice_count
      FROM invoice
    `);

    // Monthly breakdown
    const [monthlyRows] = await pool.query(`
      SELECT
        DATE_FORMAT(issue_date, '%Y-%m') AS month,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS collected,
        COUNT(*) AS invoices
      FROM invoice
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month ASC
    `);

    // Status distribution
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM invoice GROUP BY status
    `);

    // Aging
    const [agingRows] = await pool.query(`
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'Current'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN '1-30 Days'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN '31-60 Days'
          ELSE '60+ Days'
        END AS bucket, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM invoice WHERE status <> 'Paid'
      GROUP BY bucket
    `);

    // Top customers
    const [customerRows] = await pool.query(`
      SELECT c.name, COUNT(i.invoice_id) AS invoices, COALESCE(SUM(i.total_amount), 0) AS revenue
      FROM customer c LEFT JOIN invoice i ON i.customer_id = c.customer_id
      GROUP BY c.customer_id, c.name ORDER BY revenue DESC LIMIT 10
    `);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PayNivo Invoicing System";

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary");
    const summary = summaryRows[0] || {};
    summarySheet.addRow(["Invoice Financial Report"]);
    summarySheet.addRow(["Generated", new Date().toISOString()]);
    summarySheet.addRow([]);
    summarySheet.addRow(["Metric", "Value (SGD)"]);
    summarySheet.addRow(["Total Revenue", Number(summary.total_revenue)]);
    summarySheet.addRow(["Paid Revenue", Number(summary.paid_revenue)]);
    summarySheet.addRow(["Outstanding", Number(summary.outstanding)]);
    summarySheet.addRow(["Invoice Count", Number(summary.invoice_count)]);
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.getRow(4).font = { bold: true };
    summarySheet.getColumn(1).width = 20;
    summarySheet.getColumn(2).width = 20;

    // Monthly sheet
    const monthlySheet = workbook.addWorksheet("Monthly Revenue");
    monthlySheet.columns = [
      { header: "Month", key: "month", width: 12 },
      { header: "Revenue", key: "revenue", width: 15 },
      { header: "Collected", key: "collected", width: 15 },
      { header: "Invoices", key: "invoices", width: 10 }
    ];
    monthlySheet.getRow(1).font = { bold: true };
    monthlyRows.forEach((row) => monthlySheet.addRow(row));

    // Status sheet
    const statusSheet = workbook.addWorksheet("Status Distribution");
    statusSheet.columns = [
      { header: "Status", key: "status", width: 14 },
      { header: "Count", key: "count", width: 10 },
      { header: "Total (SGD)", key: "total", width: 15 }
    ];
    statusSheet.getRow(1).font = { bold: true };
    statusRows.forEach((row) => statusSheet.addRow(row));

    // Aging sheet
    const agingSheet = workbook.addWorksheet("Aging Receivables");
    agingSheet.columns = [
      { header: "Age Bucket", key: "bucket", width: 14 },
      { header: "Count", key: "count", width: 10 },
      { header: "Total (SGD)", key: "total", width: 15 }
    ];
    agingSheet.getRow(1).font = { bold: true };
    agingRows.forEach((row) => agingSheet.addRow(row));

    // Top customers sheet
    const custSheet = workbook.addWorksheet("Top Customers");
    custSheet.columns = [
      { header: "Customer", key: "name", width: 25 },
      { header: "Invoices", key: "invoices", width: 10 },
      { header: "Revenue (SGD)", key: "revenue", width: 15 }
    ];
    custSheet.getRow(1).font = { bold: true };
    customerRows.forEach((row) => custSheet.addRow(row));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=invoice-report.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Failed to export report.", detail: error.message });
  }
}

/**
 * GET /api/reports/invoices/export/csv
 *
 * Exports invoice data as CSV.
 */
async function exportReportCsv(req, res) {
  try {
    const [invoices] = await pool.query(`
      SELECT
        i.invoiceId, c.name AS customer, c.email, i.status,
        DATE_FORMAT(i.issue_date, '%Y-%m-%d') AS issue_date,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') AS due_date,
        i.total_amount
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY i.invoice_id DESC
    `);

    const headers = ["Invoice Number", "Customer", "Email", "Status", "Issue Date", "Due Date", "Total Amount"];
    const csvRows = [headers.join(",")];

    invoices.forEach((inv) => {
      csvRows.push([
        inv.invoiceId,
        `"${(inv.customer || "").replace(/"/g, '""')}"`,
        inv.email,
        inv.status,
        inv.issue_date,
        inv.due_date,
        inv.total_amount
      ].join(","));
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=invoices-export.csv");
    res.send(csvRows.join("\n"));
  } catch (error) {
    res.status(500).json({ message: "Failed to export CSV.", detail: error.message });
  }
}

module.exports = {
  exportInvoicesExcel,
  exportReportExcel,
  exportReportCsv
};
