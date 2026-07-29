const { pool } = require("../src/config/db");

async function check() {
  try {
    const [staffCols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' ORDER BY ORDINAL_POSITION"
    );
    console.log("staff columns:", staffCols.map(c => c.COLUMN_NAME).join(", "));

    const [claimsCols] = await pool.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'claims_and_loans' ORDER BY ORDINAL_POSITION"
    );
    console.log("claims_and_loans columns:", claimsCols.map(c => c.COLUMN_NAME).join(", "));

    // Test the actual query used by getMyBalance / getLeaveTypes
    const [staffRow] = await pool.query("SELECT employee_id, gender, leave_balance_json FROM staff LIMIT 3");
    console.log("staff sample:", JSON.stringify(staffRow));
  } catch (e) {
    console.error("ERROR:", e.message);
    console.error("SQL state:", e.sqlState);
    console.error("SQL code:", e.code);
  }
  process.exit(0);
}

check();
