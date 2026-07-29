/**
 * EVALUATION HEADER
 * FEATURE: PAYROLL - HR
 * PURPOSE: Provides reusable HR Report Export Service business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
/**
 * HR Report Export Service
 *
 * Generates Excel (.xlsx) and CSV file exports from report data arrays.
 * Handles HTTP response headers and streaming for file downloads.
 */

const ExcelJS = require("exceljs");

/**
 * Export report data as an Excel (.xlsx) file.
 *
 * Creates a styled workbook with bold white headers on a purple background,
 * streams the binary content to the HTTP response.
 *
 * @param {Object} res - Express response object (must not be already sent)
 * @param {Object} options - Export configuration
 * @param {string} options.sheetName - Name of the worksheet tab
 * @param {Array} options.columns - Column definitions with header, key, and width
 * @param {Array} options.rows - Array of row objects with keys matching column keys
 * @param {string} options.fileName - Base filename without extension
 */
async function exportToExcel(res, { sheetName, columns, rows, fileName }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HR Payroll System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;

  // Style header row with bold white font and purple background
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" }
  };

  // Add data rows
  rows.forEach(row => sheet.addRow(row));

  // Set response headers for Excel download
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${fileName}.xlsx`
  );

  // Stream workbook to response
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Export report data as a CSV file.
 *
 * Generates a UTF-8 encoded CSV string with a header row followed by data rows,
 * and sends it as an HTTP response with appropriate headers.
 *
 * @param {Object} res - Express response object (must not be already sent)
 * @param {Object} options - Export configuration
 * @param {Array} options.columns - Column definitions with header and key properties
 * @param {Array} options.rows - Array of row objects with keys matching column keys
 * @param {string} options.fileName - Base filename without extension
 */
function exportToCsv(res, { columns, rows, fileName }) {
  // Build header row from column definitions
  const headerRow = columns.map(col => escapeCsvField(col.header)).join(",");

  // Build data rows
  const dataRows = rows.map(row =>
    columns.map(col => escapeCsvField(row[col.key])).join(",")
  );

  // Combine header and data rows
  const csvContent = [headerRow, ...dataRows].join("\n");

  // Set response headers for CSV download
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${fileName}.csv`
  );

  // Send UTF-8 encoded CSV content
  res.send(csvContent);
}

/**
 * Escape a value for safe inclusion in a CSV field.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 *
 * @param {*} value - The value to escape
 * @returns {string} CSV-safe string representation
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Wrap in quotes if field contains special characters
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

module.exports = { exportToExcel, exportToCsv };
