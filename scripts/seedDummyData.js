const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Dummy Users Data
const users = [
  {
    name: "Admin User",
    email: "admin@company.com",
    password: "Admin@123",
    role: "Admin",
    status: "Active"
  },
  {
    name: "Finance Manager",
    email: "finance@company.com",
    password: "Finance@123",
    role: "Finance",
    status: "Active"
  },
  {
    name: "HR Manager",
    email: "hr@company.com",
    password: "HR@123",
    role: "HR",
    status: "Active"
  },
  {
    name: "Staff Member",
    email: "staff@company.com",
    password: "Staff@123",
    role: "Staff",
    status: "Active"
  }
];

// Vaniday Salon & Beauty Customer Data
const customers = [
  {
    name: "Luxe Hair Studio",
    email: "bookings@luxehairstudio.sg",
    address: "391B Orchard Road, #03-12, Ngee Ann City, Singapore 238874",
    phone: "+65 6735 8821",
    industry: "Hair Salon"
  },
  {
    name: "The Nail Artistry",
    email: "hello@thenailartistry.sg",
    address: "68 Orchard Road, #04-58, Plaza Singapura, Singapore 238839",
    phone: "+65 6336 7742",
    industry: "Nail Salon"
  },
  {
    name: "Serenity Spa & Wellness",
    email: "reservations@serenityspa.sg",
    address: "2 Bayfront Avenue, #B1-05, Marina Bay Sands, Singapore 018972",
    phone: "+65 6688 5123",
    industry: "Spa & Wellness"
  },
  {
    name: "Glow Aesthetics Clinic",
    email: "appointments@glowaesthetics.sg",
    address: "1 Raffles Place, #05-19, One Raffles Place, Singapore 048616",
    phone: "+65 6438 9901",
    industry: "Aesthetics"
  },
  {
    name: "Brow & Lash Bar",
    email: "info@browlashbar.sg",
    address: "313 Orchard Road, #02-28, 313@Somerset, Singapore 238895",
    phone: "+65 6733 4456",
    industry: "Beauty Services"
  }
];

// Vaniday Invoice Data
const invoices = [
  {
    customer_index: 0,
    issue_date: "2026-05-01",
    due_date: "2026-05-15",
    status: "Sent",
    items: [
      { description: "Balayage hair coloring", quantity: 3, unit_price: 185.00 },
      { description: "Olaplex hair treatment", quantity: 3, unit_price: 65.00 }
    ],
    payment_status: "Pending"
  },
  {
    customer_index: 1,
    issue_date: "2026-05-03",
    due_date: "2026-05-17",
    status: "Viewed",
    items: [
      { description: "Gel manicure session", quantity: 12, unit_price: 48.00 },
      { description: "Nail art add-on", quantity: 8, unit_price: 25.00 }
    ],
    payment_status: "Pending"
  },
  {
    customer_index: 2,
    issue_date: "2026-05-05",
    due_date: "2026-05-19",
    status: "Paid",
    items: [
      { description: "Full body massage (90 min)", quantity: 5, unit_price: 158.00 },
      { description: "Aromatherapy upgrade", quantity: 5, unit_price: 30.00 }
    ],
    payment_status: "Completed"
  },
  {
    customer_index: 3,
    issue_date: "2026-04-20",
    due_date: "2026-05-04",
    status: "Overdue",
    items: [
      { description: "Hydrafacial treatment", quantity: 4, unit_price: 280.00 },
      { description: "LED light therapy add-on", quantity: 4, unit_price: 85.00 }
    ],
    payment_status: "Overdue"
  },
  {
    customer_index: 4,
    issue_date: "2026-05-08",
    due_date: "2026-05-22",
    status: "Draft",
    items: [
      { description: "Eyebrow embroidery", quantity: 2, unit_price: 388.00 },
      { description: "Lash lift & tint", quantity: 4, unit_price: 78.00 }
    ],
    payment_status: "Draft"
  },
  {
    customer_index: 0,
    issue_date: "2026-05-10",
    due_date: "2026-05-24",
    status: "Paid",
    items: [{ description: "Keratin smoothing treatment", quantity: 6, unit_price: 220.00 }],
    payment_status: "Completed"
  }
];

// Dummy Payroll Data
const payrollEntries = [
  {
    employee_name: "John Smith",
    email: "john.smith@company.com",
    position: "Senior Developer",
    department: "IT",
    basic_salary: 5000,
    allowances: 500,
    deductions: 200,
    month: "2026-05"
  },
  {
    employee_name: "Jane Doe",
    email: "jane.doe@company.com",
    position: "Project Manager",
    department: "Management",
    basic_salary: 4500,
    allowances: 450,
    deductions: 180,
    month: "2026-05"
  },
  {
    employee_name: "Alice Johnson",
    email: "alice.johnson@company.com",
    position: "HR Specialist",
    department: "HR",
    basic_salary: 3500,
    allowances: 300,
    deductions: 150,
    month: "2026-05"
  },
  {
    employee_name: "Bob Williams",
    email: "bob.williams@company.com",
    position: "Finance Officer",
    department: "Finance",
    basic_salary: 4000,
    allowances: 400,
    deductions: 170,
    month: "2026-05"
  }
];

async function seedDatabase() {
  const connection = await pool.getConnection();
  
  try {
    console.log("🌱 Starting database seeding...\n");

    // 1. Clear existing data (optional - comment out to keep existing data)
    console.log("🗑️  Clearing existing data...");
    await connection.query("DELETE FROM invoice_item");
    await connection.query("DELETE FROM invoice");
    await connection.query("DELETE FROM payment");
    await connection.query("DELETE FROM customer");
    await connection.query("DELETE FROM user");
    await connection.query("DELETE FROM payroll");
    console.log("✅ Cleared existing data\n");

    // 2. Seed Roles (if they don't exist)
    console.log("👤 Seeding roles...");
    const roleNames = ["Admin", "Finance", "HR", "Staff"];
    for (const roleName of roleNames) {
      await connection.query(
        "INSERT IGNORE INTO role (role_name) VALUES (?)",
        [roleName]
      );
    }
    console.log("✅ Roles seeded\n");

    // 3. Seed Users
    console.log("👥 Seeding users...");
    const userIds = [];
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const [roleResult] = await connection.query(
        "SELECT role_id FROM role WHERE role_name = ?",
        [user.role]
      );
      const roleId = roleResult[0]?.role_id || 1;

      const [result] = await connection.query(
        "INSERT INTO user (name, email, password, role_id, status) VALUES (?, ?, ?, ?, ?)",
        [user.name, user.email, hashedPassword, roleId, user.status]
      );
      userIds.push(result.insertId);
      console.log(`  ✓ Created user: ${user.email}`);
    }
    console.log("✅ Users seeded\n");

    // 4. Seed Customers
    console.log("🏢 Seeding customers...");
    const customerIds = [];
    for (const customer of customers) {
      const [result] = await connection.query(
        "INSERT INTO customer (name, email, address, phone, industry) VALUES (?, ?, ?, ?, ?)",
        [customer.name, customer.email, customer.address, customer.phone, customer.industry]
      );
      customerIds.push(result.insertId);
      console.log(`  ✓ Created customer: ${customer.name}`);
    }
    console.log("✅ Customers seeded\n");

    // 5. Seed Invoices
    console.log("📄 Seeding invoices...");
    const invoiceIds = [];
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      const customerId = customerIds[invoice.customer_index];

      const [invoiceResult] = await connection.query(
        `INSERT INTO invoice 
         (customer_id, issue_date, due_date, status, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [customerId, invoice.issue_date, invoice.due_date, invoice.status]
      );
      const invoiceId = invoiceResult.insertId;
      invoiceIds.push(invoiceId);

      // 6. Seed Invoice Items
      let totalAmount = 0;
      for (const item of invoice.items) {
        const amount = item.quantity * item.unit_price;
        totalAmount += amount;

        await connection.query(
          `INSERT INTO invoice_item 
           (invoice_id, description, quantity, unit_price, amount) 
           VALUES (?, ?, ?, ?, ?)`,
          [invoiceId, item.description, item.quantity, item.unit_price, amount]
        );
      }

      console.log(`  ✓ Created invoice INV-${String(i + 1).padStart(4, "0")} (Total: $${totalAmount.toFixed(2)})`);

      // 7. Seed Payments if status is Paid or Overdue
      if (invoice.status === "Paid") {
        const [paymentResult] = await connection.query(
          `INSERT INTO payment 
           (invoice_id, amount, payment_date, payment_method, status) 
           VALUES (?, ?, ?, ?, ?)`,
          [invoiceId, totalAmount, invoice.due_date, "Bank Transfer", "Completed"]
        );
        console.log(`    💰 Payment recorded: $${totalAmount.toFixed(2)}`);
      }
    }
    console.log("✅ Invoices, items, and payments seeded\n");

    // 8. Seed Payroll Data
    console.log("💵 Seeding payroll data...");
    for (const payroll of payrollEntries) {
      const grossSalary = payroll.basic_salary + payroll.allowances - payroll.deductions;
      
      const [result] = await connection.query(
        `INSERT INTO payroll 
         (employee_name, email, position, department, basic_salary, allowances, deductions, gross_salary, month, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payroll.employee_name,
          payroll.email,
          payroll.position,
          payroll.department,
          payroll.basic_salary,
          payroll.allowances,
          payroll.deductions,
          grossSalary,
          payroll.month,
          "Processed"
        ]
      );
      console.log(`  ✓ Created payroll: ${payroll.employee_name} - $${grossSalary.toFixed(2)}`);
    }
    console.log("✅ Payroll data seeded\n");

    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   • ${users.length} users created`);
    console.log(`   • ${customers.length} customers created`);
    console.log(`   • ${invoices.length} invoices created`);
    console.log(`   • ${payrollEntries.length} payroll entries created`);
    console.log("\n📝 Test Credentials:");
    users.forEach(user => {
      console.log(`   • ${user.email} / ${user.password}`);
    });

  } catch (error) {
    console.error("❌ Error seeding database:", error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Run the seeding script
seedDatabase().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
