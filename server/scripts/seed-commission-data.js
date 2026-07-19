/**
 * Seed commission/share data into existing invoices.
 * Based on Vaniday model: Total Revenue → Vaniday Commission → Salon Share
 * commission_rate: 20-35% (Vaniday's cut)
 * vaniday_share: total_amount * commission_rate / 100
 * salon_share: total_amount - vaniday_share
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  const [invoices] = await pool.query("SELECT invoice_id, total_amount FROM invoice ORDER BY invoice_id");
  console.log(`Updating ${invoices.length} invoices with commission data...\n`);

  // Vaniday commission rates: 20% or 35% depending on partner tier
  const rates = [20, 20, 20, 20, 35, 20, 35, 20, 20, 35, 20, 20, 35, 20, 20];

  let totalRevenue = 0, totalCommission = 0, totalSalonShare = 0;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const total = Number(inv.total_amount);
    const rate = rates[i % rates.length];
    const vanidayShare = Number((total * rate / 100).toFixed(2));
    const salonShare = Number((total - vanidayShare).toFixed(2));

    await pool.query(
      "UPDATE invoice SET commission_rate = ?, vaniday_share = ?, salon_share = ? WHERE invoice_id = ?",
      [rate, vanidayShare, salonShare, inv.invoice_id]
    );

    totalRevenue += total;
    totalCommission += vanidayShare;
    totalSalonShare += salonShare;
  }

  console.log("Commission distribution:");
  console.log(`  Total Revenue (Inflow):  SGD ${totalRevenue.toFixed(2)}`);
  console.log(`  Vaniday Commission:      SGD ${totalCommission.toFixed(2)}`);
  console.log(`  Salon Share (Payout):    SGD ${totalSalonShare.toFixed(2)}`);
  console.log(`  Avg Commission Rate:     ${(totalCommission / totalRevenue * 100).toFixed(1)}%`);

  await pool.end();
  console.log("\nDone.");
}

seed();
