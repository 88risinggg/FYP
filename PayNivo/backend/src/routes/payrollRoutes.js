import { Router } from "express";
import multer from "multer";
import {
  allocatePayrollId,
  buildMockUploadRows,
  calculatePayroll,
  createPayslipFromPayroll,
  payrollRecords,
  payslips
} from "../utils/mockPayrollStore.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { addAudit } from "../services/audit.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", requireAuth, requireRole("Admin", "Finance", "HR", "Staff"), (req, res) => {
  const visibleRecords = req.user?.role === "Staff" && req.user?.staffId
    ? payrollRecords.filter((record) => record.staff_id === req.user.staffId)
    : payrollRecords;

  res.json(visibleRecords);
});

router.post("/upload", requireAuth, requireRole("Admin", "HR"), upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Excel or CSV file is required" });
  }

  const rows = buildMockUploadRows();
  rows.forEach((row) => {
    payrollRecords.push({ ...row, id: row.id ?? allocatePayrollId() });
  });

  addAudit(req.user.email, `Mock payroll upload: ${req.file.originalname}`, "Payroll");

  res.json({
    rows,
    log: {
      totalRows: rows.length,
      failedRows: 0,
      filename: req.file.originalname,
      createdAt: new Date().toISOString()
    }
  });
});

router.get("/template", requireAuth, requireRole("Admin", "HR"), (_req, res) => {
  res.json({
    mocked: true,
    message: "Template download is mocked for this demo prototype.",
    columns: [
      "staff_id",
      "staff_name",
      "email",
      "payroll_month",
      "basic_salary",
      "services_commission",
      "product_commission",
      "credit_commission",
      "allowance",
      "loan_deduction",
      "other_deduction"
    ]
  });
});

router.post("/payslips/:id/generate", requireAuth, requireRole("Admin", "HR"), (req, res) => {
  const payroll = payrollRecords.find((record) => record.id === Number(req.params.id));
  if (!payroll) return res.status(404).json({ message: "Payroll record not found" });

  const normalizedPayroll = calculatePayroll(payroll);
  const payslip = createPayslipFromPayroll(normalizedPayroll);

  payroll.payslipGenerated = true;
  payroll.payslipId = payslip.id;

  addAudit(req.user.email, `Payslip generated for ${payroll.staff_id}`, "Payroll");
  res.json({ success: true, payslip });
});

router.get("/payslips", requireAuth, requireRole("Admin", "Finance", "HR", "Staff"), (req, res) => {
  const visiblePayslips = req.user?.role === "Staff" && req.user?.staffId
    ? payslips.filter((payslip) => payslip.staff_id === req.user.staffId)
    : payslips;

  res.json(visiblePayslips);
});

router.post("/payslips/:id/email", requireAuth, requireRole("Admin", "HR"), (req, res) => {
  const payslip = payslips.find((item) => item.id === Number(req.params.id));
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.approval_status !== "approved") {
    return res.status(403).json({ message: "Payslip must be approved by Finance before sending" });
  }

  payslip.approval_status = "sent";
  payslip.sent_at = new Date().toISOString();
  addAudit(req.user.email, `Payslip sent for ${payslip.staff_id}`, "Payroll");

  res.json({ success: true, payslip });
});

export default router;
