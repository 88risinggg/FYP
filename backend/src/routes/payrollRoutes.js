import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import { payrollRateConfig, payrollRecords, payslips, staffProfiles, uploadLogs } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";
import { withCalculations } from "../services/calculations.js";
import { calculatePayroll, validatePayrollRecord } from "../services/payroll.js";
import { generatePayslipPdf } from "../services/payslipPdf.js";
import { sendPrototypeEmail } from "../services/email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.get("/rates", allowRoles("Admin", "HR"), (_req, res) => res.json(payrollRateConfig));

router.put("/rates", allowRoles("Admin"), (req, res) => {
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

router.get("/", allowRoles("Admin", "HR", "Finance", "Staff"), (req, res) => {
  let records = withCalculations();
  if (req.user.role === "Staff") records = records.filter((record) => record.staff_id === req.user.staffId);
  res.json(records);
});

router.post("/", allowRoles("Admin", "HR"), (req, res) => {
  const record = {
    id: payrollRecords.length + 1,
    staff_id: String(req.body.staff_id || ""),
    staff_name: String(req.body.staff_name || ""),
    email: String(req.body.email || ""),
    payroll_month: String(req.body.payroll_month || ""),
    working_days: Number(req.body.working_days || 0),
    no_pay_leave_days: Number(req.body.no_pay_leave_days || 0),
    basic_salary: Number(req.body.basic_salary || 0),
    services_commission: Number(req.body.services_commission || 0),
    product_commission: Number(req.body.product_commission || 0),
    credit_commission: Number(req.body.credit_commission || 0),
    allowance: Number(req.body.allowance || payrollRateConfig.defaultAllowanceRate || 0),
    loan_deduction: Number(req.body.loan_deduction || 0),
    other_deduction: Number(req.body.other_deduction || payrollRateConfig.defaultDeductionRate || 0)
  };
  const validationErrors = validatePayrollRecord(record);
  payrollRecords.push(record);
  addAudit(req.user.email, `Manual payroll entry for ${record.staff_id}`, "Payroll");
  res.status(201).json({ ...calculatePayroll(record, payrollRateConfig), validationErrors });
});

router.post("/upload", allowRoles("Admin", "HR"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Excel file is required" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(req.file.path);
  const sheet = workbook.worksheets[0];
  const headers = sheet.getRow(1).values.slice(1).map((value) => String(value).trim());
  const uploaded = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const record = headers.reduce((result, header, index) => {
      result[header] = values[index] ?? "";
      return result;
    }, {});
    const normalized = {
      id: payrollRecords.length + uploaded.length + 1,
      staff_id: String(record.staff_id || ""),
      staff_name: String(record.staff_name || ""),
      email: String(record.email || ""),
      payroll_month: String(record.payroll_month || ""),
      working_days: Number(record.working_days || 0),
      no_pay_leave_days: Number(record.no_pay_leave_days || 0),
      basic_salary: Number(record.basic_salary || 0),
      services_commission: Number(record.services_commission || 0),
      product_commission: Number(record.product_commission || 0),
      credit_commission: Number(record.credit_commission || 0),
      loan_deduction: Number(record.loan_deduction || 0),
      other_deduction: Number(record.other_deduction || 0),
      validationErrors: []
    };
    normalized.validationErrors = validatePayrollRecord(normalized);
    uploaded.push(calculatePayroll(normalized, payrollRateConfig));
  });

  payrollRecords.push(...uploaded.map(({ validationErrors, ...record }) => record));
  uploadLogs.unshift({
    id: uploadLogs.length + 1,
    filename: req.file.originalname,
    totalRows: uploaded.length,
    failedRows: uploaded.filter((record) => record.validationErrors.length).length,
    createdAt: new Date().toISOString()
  });
  addAudit(req.user.email, `Payroll upload: ${req.file.originalname}`, "Payroll");
  res.json({ rows: uploaded, log: uploadLogs[0] });
});

router.post("/payslips/:payrollId/generate", allowRoles("Admin", "HR"), async (req, res) => {
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
    fileUrl: `/generated/payslips/${filename}`,
    createdAt: new Date().toISOString()
  };
  payslips.unshift(payslip);
  addAudit(req.user.email, `Payslip generation for ${payroll.staff_id}`, "Payslip");
  res.json(payslip);
});

router.get("/payslips", allowRoles("Admin", "HR", "Staff"), (req, res) => {
  const visible = req.user.role === "Staff" ? payslips.filter((item) => item.staff_id === req.user.staffId) : payslips;
  res.json(visible);
});

router.post("/payslips/:payslipId/email", allowRoles("Admin", "HR"), async (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.payslipId));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  const staff = staffProfiles.find((item) => item.staff_id === payslip.staff_id);
  const subject = `Payslip for ${payslip.payroll_month}`;
  const result = await sendPrototypeEmail({
    to: staff?.email || "staff@paynivo.com",
    subject,
    html: `<p>Hello ${payslip.staff_name},</p><p>Your payslip for ${payslip.payroll_month} is ready.</p>`
  });
  addAudit(req.user.email, "Email sent: payslip", "Email");
  res.json({ sent: true, result });
});

export default router;
