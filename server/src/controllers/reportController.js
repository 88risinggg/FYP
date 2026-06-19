const { pool } = require("../config/db");
const { toCurrencyNumber } = require("./invoiceController");

async function getInvoiceReports(req, res) {
  try {
    const [summaryRows] = await pool.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN status <> 'Paid' THEN total_amount ELSE 0 END), 0) AS outstanding_revenue,
        COUNT(*) AS invoice_count
      FROM invoice
    `);

    const [monthlyRows] = await pool.query(`
      SELECT
        DATE_FORMAT(issue_date, '%Y-%m') AS month,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total_amount ELSE 0 END), 0) AS collected,
        COUNT(*) AS invoice_count
      FROM invoice
      GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
      ORDER BY month ASC
    `);

    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
      FROM invoice
      GROUP BY status
    `);

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
      FROM invoice
      WHERE status <> 'Paid'
      GROUP BY bucket
      ORDER BY FIELD(bucket, 'Current', '1-30 Days', '31-60 Days', '60+ Days')
    `);

    const [customerRows] = await pool.query(`
      SELECT
        c.customer_id,
        c.name,
        COUNT(i.invoice_id) AS invoice_count,
        COALESCE(SUM(i.total_amount), 0) AS total
      FROM customer c
      LEFT JOIN invoice i ON i.customer_id = c.customer_id
      GROUP BY c.customer_id, c.name
      ORDER BY total DESC
      LIMIT 8
    `);

    // Financial Statement Data
    const [paidInvoices] = await pool.query(`
      SELECT
        COUNT(*) AS paid_count,
        COALESCE(SUM(total_amount), 0) AS total_collected,
        COALESCE(AVG(total_amount), 0) AS avg_invoice_value
      FROM invoice WHERE status = 'Paid'
    `);

    const [overdueInvoices] = await pool.query(`
      SELECT
        COUNT(*) AS overdue_count,
        COALESCE(SUM(total_amount), 0) AS overdue_total
      FROM invoice WHERE status = 'Overdue'
    `);

    const [thisMonthRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM invoice
      WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    `);

    const [lastMonthRevenue] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM invoice
      WHERE DATE_FORMAT(issue_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')
    `);

    const [customerCount] = await pool.query(`SELECT COUNT(*) AS count FROM customer`);

    const summary = summaryRows[0] || {};
    const paid = paidInvoices[0] || {};
    const overdue = overdueInvoices[0] || {};
    const totalRev = Number(summary.total_revenue || 0);
    const paidRev = Number(summary.paid_revenue || 0);
    const collectionRate = totalRev > 0 ? ((paidRev / totalRev) * 100) : 0;
    const revenuePerCustomer = Number(customerCount[0]?.count || 1) > 0
      ? totalRev / Number(customerCount[0].count)
      : 0;

    res.json({
      summary: {
        total_revenue: toCurrencyNumber(summary.total_revenue),
        paid_revenue: toCurrencyNumber(summary.paid_revenue),
        outstanding_revenue: toCurrencyNumber(summary.outstanding_revenue),
        invoice_count: Number(summary.invoice_count || 0)
      },
      monthlyRevenue: monthlyRows.map((row) => ({
        ...row,
        revenue: toCurrencyNumber(row.revenue),
        collected: toCurrencyNumber(row.collected)
      })),
      statusDistribution: statusRows.map((row) => ({
        ...row,
        total: toCurrencyNumber(row.total)
      })),
      agingReceivables: agingRows.map((row) => ({
        ...row,
        total: toCurrencyNumber(row.total)
      })),
      topCustomers: customerRows.map((row) => ({
        ...row,
        total: toCurrencyNumber(row.total)
      })),
      financialStatement: {
        incomeStatement: {
          grossRevenue: toCurrencyNumber(summary.total_revenue),
          collections: toCurrencyNumber(paid.total_collected),
          outstanding: toCurrencyNumber(summary.outstanding_revenue),
          overdue: toCurrencyNumber(overdue.overdue_total),
          netReceivable: toCurrencyNumber(Number(summary.total_revenue) - Number(paid.total_collected))
        },
        cashFlow: {
          totalInflow: toCurrencyNumber(paid.total_collected),
          pendingInflow: toCurrencyNumber(summary.outstanding_revenue),
          overdueAmount: toCurrencyNumber(overdue.overdue_total),
          thisMonthRevenue: toCurrencyNumber(thisMonthRevenue[0]?.revenue),
          lastMonthRevenue: toCurrencyNumber(lastMonthRevenue[0]?.revenue),
          monthOverMonthGrowth: Number(lastMonthRevenue[0]?.revenue) > 0
            ? toCurrencyNumber(((Number(thisMonthRevenue[0]?.revenue) - Number(lastMonthRevenue[0]?.revenue)) / Number(lastMonthRevenue[0]?.revenue)) * 100)
            : 0
        },
        ratios: {
          collectionRate: toCurrencyNumber(collectionRate),
          avgInvoiceValue: toCurrencyNumber(paid.avg_invoice_value),
          revenuePerCustomer: toCurrencyNumber(revenuePerCustomer),
          totalCustomers: Number(customerCount[0]?.count || 0),
          paidInvoiceCount: Number(paid.paid_count || 0),
          overdueInvoiceCount: Number(overdue.overdue_count || 0)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load invoice reports.",
      detail: error.message
    });
  }
}

module.exports = {
  getInvoiceReports
};
