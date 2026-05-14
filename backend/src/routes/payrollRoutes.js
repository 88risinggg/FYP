import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { createReadStream } from "fs";
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

router.get("/template", allowRoles("Admin", "HR"), async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Payroll Template");
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
  worksheet.addRow(headers);
  worksheet.columns.forEach((column) => {
    column.width = 18;
  });
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=PayrollTemplate.xlsx");
  await workbook.xlsx.write(res);
  addAudit(req.user.email, "Downloaded payroll template", "Payroll");
  res.end();
});

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

// Utility function to format names to proper case (Title Case)
const formatName = (name) => {
  return String(name)
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (line.trim() === '') return;
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      if (index === 0) {
        headers = values;
      } else {
        rows.push(headers.reduce((obj, header, i) => {
          obj[header] = values[i] || '';
          return obj;
        }, {}));
      }
    });
    resolve(rows);
  });
};

router.post("/import-staff", allowRoles("Admin", "HR"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Excel or CSV file is required" });
    
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let rows = [];
    
    if (fileExt === '.csv') {
      rows = await parseCSV(req.file.path);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const sheet = workbook.worksheets[0];
      
      if (!sheet) return res.status(400).json({ message: "Excel file must contain at least one worksheet" });
      
      const headers = sheet.getRow(1).values.slice(1).map((value) => String(value).trim());
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values.slice(1);
        rows.push(headers.reduce((result, header, index) => {
          result[header] = values[index] ?? "";
          return result;
        }, {}));
      });
    } else {
      return res.status(400).json({ message: "Only CSV and XLSX files are supported" });
    }
    
    // Extract unique staff names and format them
    const uniqueStaffNames = new Set();
    rows.forEach((record) => {
      let staffName = null;
      if (record.staff_name) {
        staffName = formatName(record.staff_name);
      } else if (record.staffName) {
        staffName = formatName(record.staffName);
      } else if (record.customerName) {
        staffName = formatName(record.customerName);
      } else if (record.shop_title) {
        staffName = formatName(record.shop_title);
      }
      
      if (staffName) {
        uniqueStaffNames.add(staffName);
      }
    });
    
    // Create staff records for names that don't exist
    const created = [];
    const existing = [];
    
    uniqueStaffNames.forEach((staffName) => {
      const staffExists = staffProfiles.some(
        (staff) => staff.staff_name.toLowerCase() === staffName.toLowerCase()
      );
      
      if (!staffExists) {
        const newStaff = {
          staff_id: `STF${String(staffProfiles.length + created.length + 1).padStart(3, "0")}`,
          staff_name: staffName,
          email: `${staffName.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "")}@company.com`,
          phone: "",
          work_location: "",
          department: ""
        };
        staffProfiles.push(newStaff);
        created.push(newStaff);
        addAudit(req.user.email, `Auto-created staff: ${newStaff.staff_name} (${newStaff.staff_id})`, "HR");
      } else {
        const staff = staffProfiles.find((s) => s.staff_name.toLowerCase() === staffName.toLowerCase());
        existing.push(staff);
      }
    });
    
    res.json({
      message: `Processed ${uniqueStaffNames.size} staff names`,
      created: created,
      existing: existing,
      total: uniqueStaffNames.size
    });
  } catch (error) {
    console.error("Staff import error:", error);
    res.status(400).json({ 
      message: "Failed to import staff", 
      error: error.message || "Invalid file format" 
    });
  }
});

router.post("/upload", allowRoles("Admin", "HR"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Excel or CSV file is required" });
    
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let rows = [];
    
    if (fileExt === '.csv') {
      rows = await parseCSV(req.file.path);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const sheet = workbook.worksheets[0];
      
      if (!sheet) return res.status(400).json({ message: "Excel file must contain at least one worksheet" });
      
      const headers = sheet.getRow(1).values.slice(1).map((value) => String(value).trim());
      
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values.slice(1);
        rows.push(headers.reduce((result, header, index) => {
          result[header] = values[index] ?? "";
          return result;
        }, {}));
      });
    } else {
      return res.status(400).json({ message: "Only CSV and XLSX files are supported" });
    }
    
    const uploaded = [];
    rows.forEach((record) => {
      const validationErrors = [];
      
      // Format staff name to proper case
      const formattedStaffName = formatName(record.staff_name || record.staffName || record.customerName || record.shop_title || "");
      
      // Validate staff exists in the system
      const staffExists = staffProfiles.some(
        (staff) => staff.staff_id === String(record.staff_id) || staff.staff_name.toLowerCase() === formattedStaffName.toLowerCase()
      );
      
      if (!staffExists) {
        validationErrors.push(`Staff "${formattedStaffName}" not found in system`);
      }
      
      const normalized = {
        id: payrollRecords.length + uploaded.length + 1,
        staff_id: String(record.staff_id || ""),
        staff_name: formattedStaffName,
        email: String(record.email || ""),
        payroll_month: String(record.payroll_month || ""),
        working_days: Number(record.working_days || 0),
        no_pay_leave_days: Number(record.no_pay_leave_days || 0),
        basic_salary: Number(record.basic_salary || 0),
        services_commission: Number(record.services_commission || 0),
        product_commission: Number(record.product_commission || 0),
        credit_commission: Number(record.credit_commission || 0),
        allowance: Number(record.allowance || payrollRateConfig.defaultAllowanceRate || 0),
        loan_deduction: Number(record.loan_deduction || 0),
        other_deduction: Number(record.other_deduction || payrollRateConfig.defaultDeductionRate || 0)
      };
      
      // Validate payroll data and combine with staff validation errors
      normalized.validationErrors = [...validationErrors, ...validatePayrollRecord(normalized)];
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
  } catch (error) {
    console.error("File upload error:", error);
    res.status(400).json({ 
      message: "Failed to process file", 
      error: error.message || "Invalid file format" 
    });
  }
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
    approval_status: "pending",
    approved_by: null,
    approved_at: null,
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
  payslip.approval_status = "sent";
  payslip.sent_at = new Date().toISOString();
  addAudit(req.user.email, "Email sent: payslip", "Email");
  res.json({ sent: true, result, payslip });
});

export default router;
