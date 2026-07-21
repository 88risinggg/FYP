const {
  getAdminDashboardData,
  getAdminPaymentUpdatesData,
  getInvoicePerformanceData,
  getPaymentReminderSummaryData
} = require("../models/adminDashboardModel");
const { getAdminEmailDeliveryData } = require("../models/adminEmailDeliveryModel");
const {
  getAllInvoiceValidationErrors,
  getInvoiceUploadHistory,
  getInvoiceValidationSummary
} = require("../models/invoiceValidationSummaryModel");

async function getAdminInvoicingDashboard(req, res) {
  try {
    const dashboard = await getAdminDashboardData(req.user?.userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[Admin invoicing overview] Failed to load dashboard:", error);
    res.status(500).json({
      message: "Unable to load the invoicing overview."
    });
  }
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvCell).join(",");
}

function invoicePerformanceCsv(data) {
  const rows = [
    csvRow(["Invoice Performance", data.range]),
    "",
    csvRow(["Invoice Status"]),
    csvRow(["Status", "Count", "Percentage"]),
    ...data.invoiceStatus.statuses.map((item) => csvRow([
      item.status,
      item.count,
      item.percentage
    ])),
    "",
    csvRow(["Invoice Activity Trend"]),
    csvRow(["Period", "Full Date", "Time", "Invoice Count", "Revenue"]),
    ...(data.invoiceActivityTrend || data.revenueTrend || []).map((item) => csvRow([
      item.period,
      item.fullDate,
      item.time,
      item.invoiceCount,
      item.revenue
    ])),
    "",
    csvRow(["Paid vs Overdue"]),
    csvRow(["Paid Count", "Paid Amount", "Overdue Count", "Overdue Amount"]),
    csvRow([
      data.paidVsOverdue.paidCount,
      data.paidVsOverdue.paidAmount,
      data.paidVsOverdue.overdueCount,
      data.paidVsOverdue.overdueAmount
    ]),
    "",
    csvRow(["Document Generation"]),
    csvRow(["PDF Generated", "PDF Percentage", "Excel Generated", "Excel Percentage"]),
    csvRow([
      data.documentGeneration.pdfGenerated,
      data.documentGeneration.pdfGeneratedPercentage,
      data.documentGeneration.excelGenerated,
      data.documentGeneration.excelGeneratedPercentage
    ]),
    "",
    csvRow(["Recent Status Change Summary"]),
    csvRow(["From", "To", "Count"]),
    ...data.recentStatusChangeSummary.map((item) => csvRow([
      item.from,
      item.to,
      item.count
    ])),
    "",
    csvRow(["Recent Status Changes"]),
    csvRow(["Invoice #", "Customer", "From", "To", "Changed On", "Amount", "Changed By"]),
    ...data.recentStatusChanges.map((item) => csvRow([
      item.invoiceNo,
      item.customerName,
      item.fromStatus,
      item.toStatus,
      item.changedOn,
      item.amount,
      item.changedBy
    ]))
  ];

  return rows.join("\n");
}

async function getInvoicePerformance(req, res) {
  try {
    const performance = await getInvoicePerformanceData(req.query.range, req.query);
    res.json(performance);
  } catch (error) {
    console.error("[Admin invoice performance] Failed to load data:", error);
    res.status(500).json({
      message: "Unable to load invoice performance data."
    });
  }
}

async function exportInvoicePerformance(req, res) {
  try {
    const performance = await getInvoicePerformanceData(req.query.range, {
      ...req.query,
      includeDocuments: true
    });
    const csv = invoicePerformanceCsv(performance);
    const fileRange = performance.range || "last-30-days";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-performance-${fileRange}.csv"`
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      message: "Unable to export invoice performance data."
    });
  }
}

async function getPaymentReminderSummary(req, res) {
  try {
    const summary = await getPaymentReminderSummaryData(req.query.range);
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load payment and reminder summary."
    });
  }
}

async function getEmailDelivery(req, res) {
  try {
    res.json(await getAdminEmailDeliveryData(req.query));
  } catch (error) {
    console.error("[Admin email delivery] Failed to load records:", error);
    res.status(500).json({ message: "Unable to load email delivery records." });
  }
}

async function getPaymentUpdates(req, res) {
  try {
    res.json(await getAdminPaymentUpdatesData(req.query));
  } catch (error) {
    console.error("[Admin payment updates] Failed to load history:", error);
    res.status(500).json({ message: "Unable to load payment update history." });
  }
}

async function getValidationSummary(req, res) {
  try {
    const summary = await getInvoiceValidationSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load invoice validation summary."
    });
  }
}

async function getValidationUploadHistory(req, res) {
  try {
    res.json(await getInvoiceUploadHistory(req.query));
  } catch (error) {
    console.error("[Admin invoice upload history] Failed to load records:", error);
    res.status(500).json({
      message: "Unable to load invoice upload history."
    });
  }
}

async function getValidationErrors(req, res) {
  try {
    const errors = await getAllInvoiceValidationErrors(req.query);
    res.json(errors);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load invoice validation errors."
    });
  }
}

module.exports = {
  exportInvoicePerformance,
  getAdminInvoicingDashboard,
  getEmailDelivery,
  getInvoicePerformance,
  getPaymentReminderSummary,
  getPaymentUpdates,
  getValidationErrors,
  getValidationUploadHistory,
  getValidationSummary
};
