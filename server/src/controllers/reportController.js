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

    const summary = summaryRows[0] || {};

    res.json({
      summary: {
        total_revenue: toCurrencyNumber(summary.total_revenue),
        paid_revenue: toCurrencyNumber(summary.paid_revenue),
        outstanding_revenue: toCurrencyNumber(summary.outstanding_revenue),
        invoice_count: Number(summary.invoice_count || 0)
      },
      monthlyRevenue: monthlyRows.map((row) => ({
        ...row,
        revenue: toCurrencyNumber(row.revenue)
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
      }))
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
