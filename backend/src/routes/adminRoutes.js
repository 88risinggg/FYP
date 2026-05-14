import express from "express";
import { auditLogs, demoUsers, invoices, payrollRateConfig, payrollRecords, payslips, staffProfiles } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { withCalculations } from "../services/calculations.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.get("/dashboard", allowRoles("Admin"), (_req, res) => {
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

router.get("/users", allowRoles("Admin"), (_req, res) => {
  res.json(demoUsers.map(({ password, ...user }) => user));
});

router.post("/users", allowRoles("Admin"), (req, res) => {
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
  if (user.role === "Staff") {
    staffProfiles.push({
      staff_id: user.staffId,
      staff_name: user.name,
      email: user.email,
      phone: req.body.phone || "",
      work_location: req.body.workLocation || "Singapore HQ",
      department: req.body.department || "General"
    });
  }
  addAudit(req.user.email, `Admin created ${user.role} account ${user.email}`, "Users");
  const { password, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.get("/payroll-rates", allowRoles("Admin"), (_req, res) => res.json(payrollRateConfig));

router.put("/payroll-rates", allowRoles("Admin"), (req, res) => {
  Object.assign(payrollRateConfig, {
    employeeCpfRate: Number(req.body.employeeCpfRate),
    employerCpfRate: Number(req.body.employerCpfRate),
    sdlRate: Number(req.body.sdlRate),
    defaultAllowanceRate: Number(req.body.defaultAllowanceRate),
    defaultDeductionRate: Number(req.body.defaultDeductionRate),
    updatedAt: new Date().toISOString()
  });
  addAudit(req.user.email, "Rate configuration updated", "Payroll");
  res.json(payrollRateConfig);
});

export default router;
