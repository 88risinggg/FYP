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

// Dummy Customers Data
const customers = [
  {
    name: "Acme Learning Centre",
    email: "accounts@acmelearning.sg",
    address: "12 North Bridge Road, Singapore 179094",
    phone: "+65 6325 1234",
    industry: "Education"
  },
  {
    name: "BrightPath Tuition",
    email: "finance@brightpath.sg",
    address: "8 Tampines Central 1, Singapore 529543",
    phone: "+65 6785 5678",
    industry: "Education"
  },
  {
    name: "Nova Skills Academy",
    email: "billing@novaskills.sg",
    address: "3 Fusionopolis Way, Singapore 138633",
    phone: "+65 6418 9876",
    industry: "Training"
  },
  {
    name: "Summit Corporate Training",
    email: "payables@summittraining.sg",
    address: "50 Raffles Place, Singapore 048623",
    phone: "+65 6220 4321",
    industry: "Corporate Training"
  },
  {
    name: "Urban Tech Institute",
    email: "admin@urbantech.edu.sg",
    address: "21 Bukit Batok Street 22, Singapore 659589",
    phone: "+65 6563 2109",
    industry: "Technology"
  }
];

// Dummy Invoice Data
const invoices = [
  {
    customer_index: 0,
    issue_date: "2026-05-01",
    due_date: "2026-05-15",
    status: "Sent",
    items: [
      { description: "Math enrichment session", quantity: 8, unit_price: 45.5 },
      { description: "Learning materials", quantity: 12, unit_price: 8.9 }
    ],
    payment_status: "Pending"
  },
  {
    customer_index: 1,
    issue_date: "2026-05-03",
    due_date: "2026-05-17",
    status: "Viewed",
    items: [
      { description: "Science workshop", quantity: 10, unit_price: 38.75 },
      { description: "Assessment pack", quantity: 10, unit_price: 6.5 }
    ],
    payment_status: "Pending"
  },
  {
    customer_index: 2,
    issue_date: "2026-05-05",
    due_date: "2026-05-19",
    status: "Paid",
    items: [
      { description: "Excel automation training", quantity: 12, unit_price: 52 },
      { description: "Trainer travel allowance", quantity: 1, unit_price: 35 }
    ],
    payment_status: "Completed"
  },
  {
    customer_index: 3,
    issue_date: "2026-04-20",
    due_date: "2026-05-04",
    status: "Overdue",
    items: [
      { description: "Leadership bootcamp", quantity: 15, unit_price: 64 },
      { description: "Course handbook", quantity: 15, unit_price: 7.25 }
    ],
    payment_status: "Overdue"
  },
  {
    customer_index: 4,
    issue_date: "2026-05-08",
    due_date: "2026-05-22",
    status: "Draft",
    items: [
      { description: "Coding lab support", quantity: 6, unit_price: 72.5 },
      { description: "USB learning kit", quantity: 6, unit_price: 12.4 }
    ],
    payment_status: "Draft"
  },
  {
    customer_index: 0,
    issue_date: "2026-05-10",
    due_date: "2026-05-24",
    status: "Paid",
    items: [{ description: "Holiday programme", quantity: 20, unit_price: 49.9 }],
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
