const { pool } = require("../src/config/db");

async function run() {
  // Find rows where JSON.parse would fail
  const [rows] = await pool.query(
    `SELECT employee_id, LEFT(leave_balance_json, 120) AS preview
     FROM staff
     WHERE leave_balance_json IS NOT NULL
       AND leave_balance_json != ''
       AND leave_balance_json != '{}'
     ORDER BY employee_id
     LIMIT 20`
  );
  console.log("Non-empty leave_balance_json rows:");
  for (const r of rows) {
    let valid = true;
    try { JSON.parse(r.preview); } catch { valid = false; }
    console.log(`  emp ${r.employee_id}: valid=${valid} | ${r.preview}`);
  }

  // Find the specific bad ones
  const [bad] = await pool.query(
    `SELECT employee_id, HEX(LEFT(leave_balance_json,10)) AS hex_prefix, LEFT(leave_balance_json,80) AS preview
     FROM staff
     WHERE leave_balance_json IS NOT NULL`
  );
  const corrupt = bad.filter(r => {
    if (!r.preview) return false;
    try { JSON.parse(r.preview.length < 80 ? r.preview : r.preview + '"}}'); return false; } catch { return true; }
  });

  // Better: just try parsing each full value
  const [all] = await pool.query(
    "SELECT employee_id, leave_balance_json FROM staff WHERE leave_balance_json IS NOT NULL"
  );
  console.log("\nParse check on all non-null rows:");
  for (const r of all) {
    try { JSON.parse(r.leave_balance_json); }
    catch (e) {
      console.log(`  ✗ emp ${r.employee_id}: ${e.message} | raw="${String(r.leave_balance_json).slice(0,100)}"`);
    }
  }
  console.log("Done.");
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
