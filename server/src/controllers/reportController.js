/**
 * Report Controller
 *
 * Financial reports using the Vaniday commission model:
 * - Total Revenue (Inflow) = full amount collected from customers via Stripe
 * - Vaniday Commission = platform's share (commission_rate %)
 * - Salon Share (Payout) = amount paid out to salon partners
 * - Gross Revenue = Total Inflow - Salon Payouts = Vaniday Commission
 *
 * Also provides: monthly trends, aging receivables, status distribution,
 * top customers, income statement, cash flow, and financial ratios.
 */

const { pool } = require("../config/db");

function toCurrency(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/**
 * GET /api/reports/invoices
 */
async function getInvoiceReports(req, res) {
  try {
    // Summary with commission breakdown
    const [summaryRows] = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN status != 'Paid' THEN total_amount ELSE 0 END), 0) AS outstanding_revenue,
        COALESCE(SUM(vaniday_share), 0) AS total_commission,
        COALESCE(SUM(salon_share), 0) AS total_salon_payout,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN vaniday_share ELSE 0 END), 0) AS collected_commission,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN salon_share ELSE 0 END), 0) AS collected_salon_payout,
        COALESCE(AVG(commission_rate), 0) AS avg_commission_rate,
        COUNT(*) AS invoice_count
      FROM invoice
      WHERE invoiceId <> '__SETTINGS__'
    `);

    // Monthly revenue with commission breakdown
    const [monthlyRows] = await pool.query(`
      SELECT
        DATE_FORMAT(issue_date, '%Y-%m') AS month,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS collected,
        COALESCE(SUM(vaniday_share), 0) AS commission,
        COALESCE(SUM(salon_share), 0) AS salon_payout,
        COUNT(*) AS invoice_count
      FROM invoice
      WHERE invoiceId <> '__SETTINGS__'
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month ASC
    `);

    // Status distribution
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM invoice WHERE invoiceId <> '__SETTINGS__' GROUP BY status
    `);

    // Aging receivables
    const [agingRows] = await pool.query(`
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'Current'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN '1-30 Days'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN '31-60 Days'
          ELSE '60+ Days'
        END AS bucket,
        COUNT(*) AS count,
        COALESCE(SUM(total_amount), 0) AS total
      FROM invoice WHERE status != 'Paid' AND invoiceId <> '__SETTINGS__'
      GROUP BY bucket
      ORDER BY FIELD(bucket, 'Current', '1-30 Days', '31-60 Days', '60+ Days')
    `);

    // Top customers
    const [customerRows] = await pool.query(`
      SELECT c.customer_id, c.name, COUNT(i.invoice_id) AS invoice_count,
             COALESCE(SUM(i.total_amount), 0) AS total,
             COALESCE(SUM(i.vaniday_share), 0) AS commission
      FROM customer c
      LEFT JOIN invoice i ON i.customer_id = c.customer_id AND i.invoiceId <> '__SETTINGS__'
      GROUP BY c.customer_id, c.name
      ORDER BY total DESC LIMIT 8
    `);

    // Paid invoice stats
    const [paidStats] = await pool.query(`
      SELECT COUNT(*) AS paid_count, COALESCE(SUM(total_amount), 0) AS total_collected,
             COALESCE(AVG(total_amount), 0) AS avg_invoice_value
      FROM invoice WHERE status = 'Paid' AND invoiceId <> '__SETTINGS__'
    `);

    // Overdue stats
    const [overdueStats] = await pool.query(`
      SELECT COUNT(*) AS overdue_count, COALESCE(SUM(total_amount), 0) AS overdue_total
      FROM invoice WHERE status = 'Overdue' AND invoiceId <> '__SETTINGS__'
    `);

    // This month / last month for growth
    const [thisMonthRes] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(vaniday_share), 0) AS commission
      FROM invoice WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') AND invoiceId <> '__SETTINGS__'
    `);
    const [lastMonthRes] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(vaniday_share), 0) AS commission
      FROM invoice WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m') AND invoiceId <> '__SETTINGS__'
    `);

    const [customerCount] = await pool.query("SELECT COUNT(*) AS count FROM customer");

    // ─── Subscription Revenue ─────────────────────────────────────────────────
    let subscriptionRevenue = { active_subscriptions: 0, mrr: 0, arr: 0, total_subscription_revenue: 0, subscription_invoices: 0 };
    try {
      const [subRows] = await pool.query(`
        SELECT
          COUNT(DISTINCT s.subscription_id) AS active_subscriptions,
          COALESCE(SUM(CASE WHEN s.billing_frequency = 'Monthly' THEN s.amount
                            WHEN s.billing_frequency = 'Weekly' THEN s.amount * 4.33
                            WHEN s.billing_frequency = 'Quarterly' THEN s.amount / 3
                            WHEN s.billing_frequency = 'Yearly' THEN s.amount / 12
                            ELSE 0 END), 0) AS mrr,
          COALESCE(SUM(i.total_amount), 0) AS total_subscription_revenue,
          COUNT(DISTINCT i.invoice_id) AS subscription_invoices
        FROM subscriptions s
        LEFT JOIN invoice i ON i.subscription_id = s.subscription_id AND i.invoiceId <> '__SETTINGS__'
        WHERE s.status = 'Active'
      `);
      if (subRows[0]) {
        subscriptionRevenue = {
          active_subscriptions: Number(subRows[0].active_subscriptions || 0),
          mrr: toCurrency(subRows[0].mrr),
          arr: toCurrency(Number(subRows[0].mrr || 0) * 12),
          total_subscription_revenue: toCurrency(subRows[0].total_subscription_revenue),
          subscription_invoices: Number(subRows[0].subscription_invoices || 0),
        };
      }
    } catch { /* subscriptions table may not exist */ }

    // ─── Fraud Statistics ─────────────────────────────────────────────────────
    let fraudStatistics = { assessed_count: 0, high_risk: 0, medium_risk: 0, low_risk: 0, avg_score: 0, open_reviews: 0 };
    try {
      const [fraudRows] = await pool.query(`
        SELECT
          COUNT(*) AS assessed_count,
          SUM(CASE WHEN risk_level = 'High' THEN 1 ELSE 0 END) AS high_risk,
          SUM(CASE WHEN risk_level = 'Medium' THEN 1 ELSE 0 END) AS medium_risk,
          SUM(CASE WHEN risk_level = 'Low' THEN 1 ELSE 0 END) AS low_risk,
          COALESCE(AVG(risk_score), 0) AS avg_score,
          SUM(CASE WHEN review_status = 'Open' AND risk_level IN ('High', 'Medium') THEN 1 ELSE 0 END) AS open_reviews
        FROM invoice
        WHERE risk_score IS NOT NULL AND invoiceId <> '__SETTINGS__'
      `);
      if (fraudRows[0]) {
        fraudStatistics = {
          assessed_count: Number(fraudRows[0].assessed_count || 0),
          high_risk: Number(fraudRows[0].high_risk || 0),
          medium_risk: Number(fraudRows[0].medium_risk || 0),
          low_risk: Number(fraudRows[0].low_risk || 0),
          avg_score: toCurrency(fraudRows[0].avg_score),
          open_reviews: Number(fraudRows[0].open_reviews || 0),
        };
      }
    } catch { /* fraud columns may not exist */ }

    // ─── Payment Summary ──────────────────────────────────────────────────────
    let paymentSummary = { total_payments: 0, completed: 0, pending: 0, failed: 0, by_method: [] };
    try {
      const [payRows] = await pool.query(`
        SELECT
          COUNT(*) AS total_payments,
          SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) AS failed
        FROM payment
      `);
      const [methodRows] = await pool.query(`
        SELECT payment_method_name AS method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
        FROM payment WHERE status = 'Completed'
        GROUP BY payment_method_name
        ORDER BY total DESC
      `);
      if (payRows[0]) {
        paymentSummary = {
          total_payments: Number(payRows[0].total_payments || 0),
          completed: Number(payRows[0].completed || 0),
          pending: Number(payRows[0].pending || 0),
          failed: Number(payRows[0].failed || 0),
          by_method: methodRows.map((r) => ({ method: r.method || "Unknown", count: r.count, total: toCurrency(r.total) })),
        };
      }
    } catch { /* payment table may not exist */ }

    // Calculations
    const s = summaryRows[0] || {};
    const paid = paidStats[0] || {};
    const overdue = overdueStats[0] || {};
    const totalRev = Number(s.total_revenue || 0);
    const paidRev = Number(s.paid_revenue || 0);
    const totalCommission = Number(s.total_commission || 0);
    const totalSalonPayout = Number(s.total_salon_payout || 0);
    const collectedCommission = Number(s.collected_commission || 0);
    const collectedSalonPayout = Number(s.collected_salon_payout || 0);
    const collectionRate = totalRev > 0 ? (paidRev / totalRev) * 100 : 0;
    const custCount = Number(customerCount[0]?.count || 1);
    const thisMonth = Number(thisMonthRes[0]?.revenue || 0);
    const lastMonth = Number(lastMonthRes[0]?.revenue || 0);
    const momGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    // When no commission data exists (standalone invoicing), use total_amount as revenue
    const hasCommissionData = totalCommission > 0 || totalSalonPayout > 0;
    const effectiveGrossRevenue = hasCommissionData ? totalCommission : totalRev;
    const effectiveCollected = hasCommissionData ? collectedCommission : paidRev;
    const effectiveOutstanding = hasCommissionData ? (totalCommission - collectedCommission) : Number(s.outstanding_revenue || 0);
    const effectiveSalonPayouts = hasCommissionData ? totalSalonPayout : 0;
    const effectiveCollectedSalonPayouts = hasCommissionData ? collectedSalonPayout : 0;

    res.json({
      summary: {
        total_revenue: toCurrency(totalRev),
        paid_revenue: toCurrency(paidRev),
        outstanding_revenue: toCurrency(s.outstanding_revenue),
        invoice_count: Number(s.invoice_count || 0),
        total_commission: toCurrency(totalCommission),
        total_salon_payout: toCurrency(totalSalonPayout),
        avg_commission_rate: toCurrency(s.avg_commission_rate),
        gross_revenue: toCurrency(effectiveGrossRevenue)
      },
      monthlyRevenue: monthlyRows.map((row) => ({
        ...row,
        revenue: toCurrency(row.revenue),
        collected: toCurrency(row.collected),
        commission: toCurrency(row.commission),
        salon_payout: toCurrency(row.salon_payout)
      })),
      statusDistribution: statusRows.map((row) => ({ ...row, total: toCurrency(row.total) })),
      agingReceivables: agingRows.map((row) => ({ ...row, total: toCurrency(row.total) })),
      topCustomers: customerRows.map((row) => ({
        ...row,
        total: toCurrency(row.total),
        commission: toCurrency(row.commission)
      })),
      subscriptionRevenue,
      fraudStatistics,
      paymentSummary,
      financialStatement: {
        incomeStatement: {
          grossRevenue: toCurrency(effectiveGrossRevenue),
          totalInflow: toCurrency(totalRev),
          salonPayouts: toCurrency(effectiveSalonPayouts),
          collections: toCurrency(effectiveCollected),
          outstanding: toCurrency(effectiveOutstanding),
          overdue: toCurrency(overdue.overdue_total),
          netReceivable: toCurrency(effectiveOutstanding)
        },
        cashFlow: {
          totalInflow: toCurrency(paidRev),
          salonPayouts: toCurrency(effectiveCollectedSalonPayouts),
          platformRevenue: toCurrency(effectiveCollected),
          pendingInflow: toCurrency(s.outstanding_revenue),
          overdueAmount: toCurrency(overdue.overdue_total),
          thisMonthRevenue: toCurrency(thisMonth),
          lastMonthRevenue: toCurrency(lastMonth),
          monthOverMonthGrowth: toCurrency(momGrowth)
        },
        ratios: {
          collectionRate: toCurrency(collectionRate),
          avgInvoiceValue: toCurrency(paid.avg_invoice_value),
          avgCommissionRate: toCurrency(s.avg_commission_rate),
          revenuePerCustomer: toCurrency(totalRev / custCount),
          totalCustomers: custCount,
          paidInvoiceCount: Number(paid.paid_count || 0),
          overdueInvoiceCount: Number(overdue.overdue_count || 0)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load invoice reports.", detail: error.message });
  }
}

/**
 * GET /api/reports/invoices/export
 * Returns JSON data structured for PDF/Excel export on the frontend.
 */
async function exportFinancialReport(req, res) {
  try {
    const [invoices] = await pool.query(`
      SELECT i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
             i.commission_rate, i.vaniday_share, i.salon_share, i.payment_date,
             i.payment_method, i.transaction_id,
             c.name AS customer_name, c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY i.issue_date DESC, i.invoice_id DESC
    `);

    const [summary] = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(vaniday_share), 0) AS total_commission,
        COALESCE(SUM(salon_share), 0) AS total_salon_payout,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN vaniday_share ELSE 0 END), 0) AS collected_commission,
        COALESCE(AVG(commission_rate), 0) AS avg_commission_rate,
        COUNT(*) AS invoice_count,
        SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) AS overdue_count
      FROM invoice
    `);

    // Monthly revenue for chart
    const [monthlyRows] = await pool.query(`
      SELECT
        DATE_FORMAT(issue_date, '%Y-%m') AS month,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM invoice
      WHERE issue_date IS NOT NULL
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month ASC
      LIMIT 12
    `);

    // Aging receivables
    const [agingRows] = await pool.query(`
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN 'Current'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN '1-30 Days'
          WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN '31-60 Days'
          ELSE '60+ Days'
        END AS bucket,
        COUNT(*) AS count,
        COALESCE(SUM(total_amount), 0) AS total
      FROM invoice WHERE status != 'Paid'
      GROUP BY bucket
      ORDER BY FIELD(bucket, 'Current', '1-30 Days', '31-60 Days', '60+ Days')
    `);

    // Status distribution
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM invoice GROUP BY status
    `);

    // Top customers
    const [customerRows] = await pool.query(`
      SELECT c.name, COALESCE(SUM(i.total_amount), 0) AS total
      FROM customer c
      LEFT JOIN invoice i ON i.customer_id = c.customer_id
      GROUP BY c.customer_id, c.name
      ORDER BY total DESC LIMIT 8
    `);

    const s = summary[0] || {};

    res.json({
      generatedAt: new Date().toISOString(),
      companyName: process.env.COMPANY_NAME || "PayNivo",
      summary: {
        totalInflow: toCurrency(s.total_revenue),
        salonPayouts: toCurrency(s.total_salon_payout),
        grossRevenue: toCurrency(s.total_commission),
        collectedRevenue: toCurrency(s.collected_commission),
        outstandingRevenue: toCurrency(Number(s.total_commission) - Number(s.collected_commission)),
        avgCommissionRate: toCurrency(s.avg_commission_rate),
        invoiceCount: Number(s.invoice_count || 0),
        paidCount: Number(s.paid_count || 0),
        overdueCount: Number(s.overdue_count || 0)
      },
      monthlyRevenue: monthlyRows.map((row) => ({
        month: row.month,
        revenue: toCurrency(row.revenue)
      })),
      agingReceivables: agingRows.map((row) => ({
        bucket: row.bucket,
        total: toCurrency(row.total)
      })),
      statusDistribution: statusRows.map((row) => ({
        status: row.status,
        total: toCurrency(row.total)
      })),
      topCustomers: customerRows.map((row) => ({
        name: row.name,
        total: toCurrency(row.total)
      })),
      invoices: invoices.map((inv) => ({
        invoiceId: inv.invoiceId,
        customer: inv.customer_name,
        email: inv.customer_email,
        status: inv.status,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        totalAmount: toCurrency(inv.total_amount),
        commissionRate: Number(inv.commission_rate || 0),
        vanidayShare: toCurrency(inv.vaniday_share),
        salonShare: toCurrency(inv.salon_share),
        paymentDate: inv.payment_date,
        paymentMethod: inv.payment_method,
        transactionId: inv.transaction_id
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to export report.", detail: error.message });
  }
}

/**
 * GET /api/reports/invoices/export-excel
 * Generates an Excel workbook with multiple report sheets.
 */
async function exportReportExcel(req, res) {
  try {
    const ExcelJS = require("exceljs");

    // Fetch all invoices with payment info
    const [invoices] = await pool.query(`
      SELECT i.invoiceId, i.status, i.issue_date, i.due_date, i.total_amount,
             i.payment_date, i.payment_method, i.transaction_id, i.risk_level, i.risk_score,
             c.name AS customer_name, c.email AS customer_email
      FROM invoice i
      INNER JOIN customer c ON c.customer_id = i.customer_id
      WHERE i.invoiceId <> '__SETTINGS__'
      ORDER BY i.issue_date DESC
    `);

    // Payment records
    const [payments] = await pool.query(`
      SELECT p.payment_date, p.amount, p.status, p.payment_method_name AS method,
             p.transaction_id, i.invoiceId, c.name AS customer_name
      FROM payment p
      LEFT JOIN invoice i ON i.invoice_id = p.invoice_invoice_id
      LEFT JOIN customer c ON c.customer_id = i.customer_id
      ORDER BY p.payment_date DESC
    `);

    // Subscription data
    let subscriptions = [];
    try {
      const [subRows] = await pool.query(`
        SELECT s.plan_name, s.amount, s.billing_frequency, s.status, s.next_billing_date,
               c.name AS customer_name
        FROM subscriptions s
        INNER JOIN customer c ON c.customer_id = s.customer_id
        ORDER BY s.created_at DESC
      `);
      subscriptions = subRows;
    } catch { /* table may not exist */ }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PayNivo Finance";
    workbook.created = new Date();

    // ─── Sheet 1: Invoice Summary ──────────────────────────────────────────
    const invoiceSheet = workbook.addWorksheet("Invoices");
    invoiceSheet.columns = [
      { header: "Invoice #", key: "invoiceId", width: 16 },
      { header: "Customer", key: "customer_name", width: 28 },
      { header: "Email", key: "customer_email", width: 28 },
      { header: "Status", key: "status", width: 12 },
      { header: "Issue Date", key: "issue_date", width: 14 },
      { header: "Due Date", key: "due_date", width: 14 },
      { header: "Amount (SGD)", key: "total_amount", width: 14 },
      { header: "Payment Date", key: "payment_date", width: 14 },
      { header: "Payment Method", key: "payment_method", width: 16 },
      { header: "Risk Level", key: "risk_level", width: 12 },
      { header: "Risk Score", key: "risk_score", width: 12 },
    ];
    invoices.forEach((inv) => invoiceSheet.addRow(inv));
    invoiceSheet.getRow(1).font = { bold: true };
    invoiceSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };

    // ─── Sheet 2: Payments ─────────────────────────────────────────────────
    const paymentSheet = workbook.addWorksheet("Payments");
    paymentSheet.columns = [
      { header: "Invoice #", key: "invoiceId", width: 16 },
      { header: "Customer", key: "customer_name", width: 28 },
      { header: "Amount (SGD)", key: "amount", width: 14 },
      { header: "Status", key: "status", width: 12 },
      { header: "Method", key: "method", width: 16 },
      { header: "Transaction ID", key: "transaction_id", width: 30 },
      { header: "Payment Date", key: "payment_date", width: 16 },
    ];
    payments.forEach((pay) => paymentSheet.addRow(pay));
    paymentSheet.getRow(1).font = { bold: true };
    paymentSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };

    // ─── Sheet 3: Subscriptions ────────────────────────────────────────────
    if (subscriptions.length > 0) {
      const subSheet = workbook.addWorksheet("Subscriptions");
      subSheet.columns = [
        { header: "Customer", key: "customer_name", width: 28 },
        { header: "Plan", key: "plan_name", width: 24 },
        { header: "Amount (SGD)", key: "amount", width: 14 },
        { header: "Frequency", key: "billing_frequency", width: 14 },
        { header: "Status", key: "status", width: 12 },
        { header: "Next Billing", key: "next_billing_date", width: 14 },
      ];
      subscriptions.forEach((sub) => subSheet.addRow(sub));
      subSheet.getRow(1).font = { bold: true };
      subSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } };
    }

    // ─── Sheet 4: Monthly Revenue ──────────────────────────────────────────
    const [monthlyData] = await pool.query(`
      SELECT DATE_FORMAT(issue_date, '%Y-%m') AS month,
             COUNT(*) AS invoice_count,
             COALESCE(SUM(total_amount), 0) AS total_revenue,
             COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS collected,
             COALESCE(SUM(CASE WHEN status = 'Overdue' THEN total_amount ELSE 0 END), 0) AS overdue
      FROM invoice WHERE invoiceId <> '__SETTINGS__' AND issue_date IS NOT NULL
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month ASC
    `);

    const monthlySheet = workbook.addWorksheet("Monthly Revenue");
    monthlySheet.columns = [
      { header: "Month", key: "month", width: 12 },
      { header: "Invoices", key: "invoice_count", width: 10 },
      { header: "Total Revenue", key: "total_revenue", width: 16 },
      { header: "Collected", key: "collected", width: 16 },
      { header: "Overdue", key: "overdue", width: 16 },
    ];
    monthlyData.forEach((row) => monthlySheet.addRow(row));
    monthlySheet.getRow(1).font = { bold: true };
    monthlySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E5F5" } };

    // Generate buffer and send
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Financial_Report_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Failed to export Excel report.", detail: error.message });
  }
}

module.exports = {
  getInvoiceReports,
  exportFinancialReport,
  exportReportExcel
};
