import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { auditLogs, demoUsers, invoices, payrollRecords, payslips, staffProfiles } from "../data.js";
import { addAudit } from "../services/audit.js";
import { withCalculations } from "../services/calculations.js";
import { sendPrototypeEmail } from "../services/email.js";
import { generatePayslipPdf } from "../services/payslipPdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.get("/dashboard", (_req, res) => {
  const calculated = withCalculations();
  res.json({
    users: demoUsers.length,
    staff: staffProfiles.length,
    payrollRecords: payrollRecords.length,
    totalPayroll: calculated.reduce((sum, record) => sum + record.net_pay, 0),
    payslips: payslips.length,
    invoices: invoices.length,
    invoiceAmount: invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
    auditLogs: auditLogs.slice(0, 8)
  });
});

router.get("/users", (_req, res) => {
  res.json(demoUsers.map(({ password, ...user }) => user));
});

router.post("/users", (req, res) => {
  if (req.user.role !== "Admin") return res.status(403).json({ message: "Only Admin can create accounts in this prototype" });
  const exists = demoUsers.some((user) => user.email.toLowerCase() === String(req.body.email || "").toLowerCase());
  if (exists) return res.status(409).json({ message: "User email already exists" });
  const user = {
    id: demoUsers.length + 1,
    email: req.body.email,
    password: "password",
    role: req.body.role || "Staff",
    name: req.body.name,
    staffId: req.body.role === "Staff" ? req.body.staffId || `STF${String(staffProfiles.length + 1).padStart(3, "0")}` : undefined
  };
  demoUsers.push(user);
  addAudit(req.user.email, `Admin created ${user.role} account ${user.email}`, "Users");
  const { password, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.get("/staff", (_req, res) => res.json(staffProfiles));

router.post("/staff", (req, res) => {
  const profile = { ...req.body, staff_id: req.body.staff_id || `STF${String(staffProfiles.length + 1).padStart(3, "0")}` };
  staffProfiles.push(profile);
  addAudit(req.user.email, `Added staff record ${profile.staff_id}`, "HR");
  res.status(201).json(profile);
});

router.patch("/staff/:staffId/contact", (req, res) => {
  const profile = staffProfiles.find((item) => item.staff_id === req.params.staffId);
  if (!profile) return res.status(404).json({ message: "Staff profile not found" });
  profile.phone = req.body.phone || profile.phone;
  profile.email = req.body.email || profile.email;
  addAudit(req.user.email, `Updated contact details for ${profile.staff_id}`, "Staff");
  res.json(profile);
});

router.get("/payslips", (req, res) => {
  const visible = req.user.role === "Staff" ? payslips.filter((item) => item.staff_id === req.user.staffId) : payslips;
  res.json(visible);
});

router.post("/payslips/:payrollId/generate", async (req, res) => {
  const payroll = withCalculations().find((record) => record.id === Number(req.params.payrollId));
  if (!payroll) return res.status(404).json({ message: "Payroll record not found" });
  const outputDir = path.join(__dirname, "..", "generated", "payslips");
  const { filename } = await generatePayslipPdf(payroll, outputDir);
  const payslip = {
    id: payslips.length + 1,
    payrollId: payroll.id,
    staff_id: payroll.staff_id,
    staff_name: payroll.staff_name,
    payroll_month: payroll.payroll_month,
    basic_salary: payroll.basic_salary,
    net_pay: payroll.net_pay,
    employee_cpf: payroll.employee_cpf,
    total_earnings: payroll.total_earnings,
    total_deductions: payroll.total_deductions,
    fileUrl: `/generated/payslips/${filename}`,
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
    createdAt: new Date().toISOString()
  };
  payslips.unshift(payslip);
  addAudit(req.user.email, `Payslip generation for ${payroll.staff_id}`, "Payslip");
  res.json(payslip);
});

router.post("/email/payslip/:payslipId", async (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.payslipId));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.approval_status !== "approved") {
    return res.status(403).json({ message: "Payslip must be approved by Finance before sending" });
  }
  const staff = staffProfiles.find((item) => item.staff_id === payslip.staff_id);
  const subject = `Payslip for ${payslip.payroll_month}`;
  const result = await sendPrototypeEmail({
    to: staff?.email || "staff@paynivo.com",
    subject,
    html: `<p>Hello ${payslip.staff_name},</p><p>Your payslip for ${payslip.payroll_month} is ready.</p>`
  });
  addAudit(req.user.email, "Email sent: payslip", "Email");
  payslip.approval_status = "sent";
  payslip.sent_at = new Date().toISOString();
  res.json({ sent: true, result, payslip });
});

export default router;
