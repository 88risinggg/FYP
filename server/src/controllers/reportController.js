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
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month ASC
    `);

    // Status distribution
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM invoice GROUP BY status
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

    // Top customers
    const [customerRows] = await pool.query(`
      SELECT c.customer_id, c.name, COUNT(i.invoice_id) AS invoice_count,
             COALESCE(SUM(i.total_amount), 0) AS total,
             COALESCE(SUM(i.vaniday_share), 0) AS commission
      FROM customer c
      LEFT JOIN invoice i ON i.customer_id = c.customer_id
      GROUP BY c.customer_id, c.name
      ORDER BY total DESC LIMIT 8
    `);

    // Paid invoice stats
    const [paidStats] = await pool.query(`
      SELECT COUNT(*) AS paid_count, COALESCE(SUM(total_amount), 0) AS total_collected,
             COALESCE(AVG(total_amount), 0) AS avg_invoice_value
      FROM invoice WHERE status = 'Paid'
    `);

    // Overdue stats
    const [overdueStats] = await pool.query(`
      SELECT COUNT(*) AS overdue_count, COALESCE(SUM(total_amount), 0) AS overdue_total
      FROM invoice WHERE status = 'Overdue'
    `);

    // This month / last month for growth
    const [thisMonthRes] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(vaniday_share), 0) AS commission
      FROM invoice WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    `);
    const [lastMonthRes] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(vaniday_share), 0) AS commission
      FROM invoice WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')
    `);

    const [customerCount] = await pool.query("SELECT COUNT(*) AS count FROM customer");

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

    res.json({
      summary: {
        total_revenue: toCurrency(totalRev),
        paid_revenue: toCurrency(paidRev),
        outstanding_revenue: toCurrency(s.outstanding_revenue),
        invoice_count: Number(s.invoice_count || 0),
        total_commission: toCurrency(totalCommission),
        total_salon_payout: toCurrency(totalSalonPayout),
        avg_commission_rate: toCurrency(s.avg_commission_rate),
        // Gross Revenue = Inflow - Salon Payouts (i.e. Vaniday's platform revenue)
        gross_revenue: toCurrency(totalCommission)
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
      financialStatement: {
        incomeStatement: {
          grossRevenue: toCurrency(totalCommission),
          totalInflow: toCurrency(totalRev),
          salonPayouts: toCurrency(totalSalonPayout),
          collections: toCurrency(collectedCommission),
          outstanding: toCurrency(totalCommission - collectedCommission),
          overdue: toCurrency(overdue.overdue_total),
          netReceivable: toCurrency(totalCommission - collectedCommission)
        },
        cashFlow: {
          totalInflow: toCurrency(paidRev),
          salonPayouts: toCurrency(collectedSalonPayout),
          platformRevenue: toCurrency(collectedCommission),
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

module.exports = {
  getInvoiceReports,
  exportFinancialReport
};
