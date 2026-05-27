const { pool } = require("../config/db");

async function getCustomers(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.customer_id,
        c.name,
        c.email,
        c.address,
        c.created_at,
        COUNT(i.invoice_id) AS invoice_count,
        COALESCE(SUM(i.total_amount), 0) AS total_invoiced
      FROM customer c
      LEFT JOIN invoice i ON i.customer_id = c.customer_id
      GROUP BY c.customer_id, c.name, c.email, c.address, c.created_at
      ORDER BY c.created_at DESC, c.customer_id DESC
    `);

    res.json({ customers: rows });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch customers.",
      detail: error.message
    });
  }
}

module.exports = {
  getCustomers
};
