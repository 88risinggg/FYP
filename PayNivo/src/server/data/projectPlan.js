export const projectPlan = {
  title: "Automated Invoicing and Payroll System",
  referenceSystem: "Xero Invoicing and Payroll",
  stack: {
    frontend: "React",
    backend: "Node.js + Express",
    database: "MySQL",
    pdf: "Puppeteer",
    excel: "ExcelJS",
    email: "Nodemailer",
    payments: "Stripe API",
    whatsapp: "Meta WhatsApp Cloud API"
  },
  objectives: [
    "Automate invoice and payroll generation",
    "Enable mass sending, reminders, and alerts",
    "Support online viewing and payments",
    "Improve efficiency, accuracy, and auditability"
  ],
  roles: ["Admin", "Finance", "HR", "Staff"],
  invoiceStatuses: ["Draft", "Sent", "Viewed", "Paid", "Overdue"],
  modules: [
    {
      name: "User and Role Management",
      owner: "Admin",
      features: ["Secure login", "Role-based access", "User management", "Audit logs"]
    },
    {
      name: "Invoicing",
      owner: "Finance",
      features: ["Manual invoice creation", "Bulk invoice upload", "PDF generation", "Excel export", "Email invoices", "Online view link", "Status tracking"]
    },
    {
      name: "Payroll",
      owner: "HR",
      features: ["CSV or Excel payroll upload", "Payroll validation", "Payslip PDF generation", "Staff self-service", "Allowances and deductions"]
    },
    {
      name: "Bulk Upload and Database Integration",
      owner: "Finance and HR",
      features: ["CSV upload", "Excel upload", "Validation errors", "MySQL storage", "Reporting history"]
    },
    {
      name: "Email, Reminders, and Alerts",
      owner: "Admin and Finance",
      features: ["Mass email", "Reminder schedules", "Email templates", "Delivery logs", "WhatsApp notifications"]
    },
    {
      name: "Online Payments",
      owner: "Finance",
      features: ["Stripe payments", "Bank transfer instructions", "PayNow proof tracking", "Webhook payment updates"]
    },
    {
      name: "Reporting and Dashboards",
      owner: "Admin, Finance, and HR",
      features: ["Invoice summaries", "Payroll summaries", "Validation reports", "Export reports"]
    }
  ]
};
