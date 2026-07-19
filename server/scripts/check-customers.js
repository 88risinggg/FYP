require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

async function run() {
  const [rows] = await pool.query("SELECT customer_id, name, address, created_at FROM customer");
  console.log(`${rows.length} customers total:`);
  rows.forEach(r => console.log(`  ${r.customer_id}. ${r.name} | ${r.address || '(no address)'} | ${r.created_at || '(no date)'}`));
  await pool.end();
}
run();
