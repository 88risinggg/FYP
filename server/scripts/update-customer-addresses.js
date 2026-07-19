require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

const addresses = {
  "BluePeak Software": "9 North Buona Vista Drive, #08-01, Singapore 138588",
  "Atlas Security": "12 Tampines Central 1, #09-04, Singapore 529543",
  "Sunrise Digital": "71 Ayer Rajah Crescent, #06-14, Singapore 139951",
  "Acme Corporation": "1 Raffles Place, #20-01, Singapore 048616",
  "Orchid Healthcare": "2 Bukit Merah Central, #15-01, Singapore 159835",
  "Stellar Marketing": "80 Robinson Road, #17-02, Singapore 068898",
  "Coral Bay Restaurants": "26 Sentosa Gateway, #01-10, Singapore 098138",
  "TechWave Solutions": "5 Shenton Way, #12-05, Singapore 068808",
  "GreenLeaf Consulting": "3 Fusionopolis Way, #07-21, Singapore 138633",
  "Golden Gate Logistics": "30 Pasir Panjang Road, #02-15, Singapore 117440",
  "Pacific Ventures": "8 Marina View, #30-01, Singapore 018960",
  "Diamond Electronics": "52 Jurong Gateway Road, #11-03, Singapore 608550",
  "Zenith Engineering": "18 Boon Lay Way, #05-06, Singapore 609966",
  "Marina Bay Trading": "10 Bayfront Avenue, #03-12, Singapore 018956",
  "CloudNine Systems": "21 Bukit Batok Street 22, #04-08, Singapore 659589"
};

async function run() {
  let updated = 0;
  for (const [name, address] of Object.entries(addresses)) {
    const [result] = await pool.query(
      "UPDATE customer SET address = ? WHERE name = ? AND (address LIKE '%Pte Ltd%' OR address LIKE '%Holdings%' OR address LIKE '%Trading Co%' OR address LIKE '%Agency%' OR address LIKE '%Group%' OR address LIKE '%Works%' OR address LIKE '%Services%' OR address LIKE '%Solutions%')",
      [address, name]
    );
    if (result.affectedRows > 0) {
      console.log(`  Updated: ${name} -> ${address}`);
      updated++;
    }
  }
  console.log(`\n${updated} customers updated with proper addresses.`);
  await pool.end();
}

run();
