require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../src/config/db");

const addresses = {
  "Luxe Hair Studio": "391B Orchard Road, #03-12, Ngee Ann City, Singapore 238874",
  "The Nail Artistry": "68 Orchard Road, #04-58, Plaza Singapura, Singapore 238839",
  "Serenity Spa & Wellness": "2 Bayfront Avenue, #B1-05, Marina Bay Sands, Singapore 018972",
  "Glow Aesthetics Clinic": "1 Raffles Place, #05-19, One Raffles Place, Singapore 048616",
  "Brow & Lash Bar": "313 Orchard Road, #02-28, 313@Somerset, Singapore 238895",
  "KBeauty Haven": "181 Orchard Road, #04-01, Orchard Central, Singapore 238896",
  "Zen Reflexology Centre": "6 Raffles Boulevard, #03-128, Marina Square, Singapore 039594",
  "Prestige Barbers": "252 North Bridge Road, #01-15, Raffles City, Singapore 179103",
  "Skin Lab Express": "290 Orchard Road, #12-01, Paragon, Singapore 238859",
  "Orchid Beauty Lounge": "3 Temasek Boulevard, #02-435, Suntec City, Singapore 038983",
  "The Waxing Boutique": "1 HarbourFront Walk, #01-153, VivoCity, Singapore 098585",
  "Radiance Medi-Spa": "2 Orchard Turn, #B2-15, ION Orchard, Singapore 238801",
  "Aura Hair & Beauty": "50 Jurong Gateway Road, #03-11, JEM, Singapore 608549",
  "Bliss Nail Studio": "23 Serangoon Central, #04-42, NEX, Singapore 556083",
  "Rejuve Wellness Clinic": "80 Marine Parade Road, #09-05, Parkway Parade, Singapore 449269"
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
