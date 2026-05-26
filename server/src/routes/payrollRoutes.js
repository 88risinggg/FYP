const express = require("express");
const ExcelJS = require("exceljs");
const { payrollRateConfig } = require("../services/data");
const { addAudit } = require("../services/audit");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

router.get("/template", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payroll Template");
  const headers = [
    "staff_id",
    "staff_name",
    "email",
    "payroll_month",
    "working_days",
    "no_pay_leave_days",
    "basic_salary",
    "services_commission",
    "product_commission",
    "credit_commission",
    "allowance",
    "loan_deduction",
    "other_deduction"
  ];
  sheet.addRow(headers);
  sheet.columns.forEach(c => (c.width = 18));
  sheet.getRow(1).font = { bold: true };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=PayrollTemplate.xlsx");
  await workbook.xlsx.write(res);
  addAudit(req.user.email, "Downloaded payroll template", "Payroll");
  res.end();
});

router.get("/rates", authenticateToken, allowRoles("Admin", "HR"), (_req, res) => {
  res.json(payrollRateConfig);
});

router.put("/rates", authenticateToken, allowRoles("Admin"), (req, res) => {
  payrollRateConfig.employeeCpfRate = Number(req.body.employeeCpfRate ?? payrollRateConfig.employeeCpfRate);
  payrollRateConfig.employerCpfRate = Number(req.body.employerCpfRate ?? payrollRateConfig.employerCpfRate);
  payrollRateConfig.sdlRate = Number(req.body.sdlRate ?? payrollRateConfig.sdlRate);
  payrollRateConfig.defaultAllowanceRate = Number(req.body.defaultAllowanceRate ?? payrollRateConfig.defaultAllowanceRate);
  payrollRateConfig.defaultDeductionRate = Number(req.body.defaultDeductionRate ?? payrollRateConfig.defaultDeductionRate);
  payrollRateConfig.updatedAt = new Date().toISOString();
  addAudit(req.user.email, "Rate configuration updated", "Payroll");
  res.json(payrollRateConfig);
});

module.exports = router;
