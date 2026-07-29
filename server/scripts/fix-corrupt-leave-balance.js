/**
 * One-time cleanup: reset any leave_balance_json rows that contain
 * the literal string "[object Object]" (improperly serialised JS object).
 */
const { pool } = require("../src/config/db");

async function fix() {
  const [result] = await pool.query(
    `UPDATE staff
     SET leave_balance_json = '{}'
     WHERE leave_balance_json = '[object Object]'`
  );
  console.log(`Fixed ${result.affectedRows} corrupt leave_balance_json row(s).`);
  process.exit(0);
}

fix().catch(e => { console.error(e.message); process.exit(1); });
