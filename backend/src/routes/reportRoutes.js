import express from "express";
import { invoices, payslips, payrollRecords, uploadLogs } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { withCalculations } from "../services/calculations.js";

const router = express.Router();

router.get("/", allowRoles("Admin", "Finance", "HR"), (_req, res) => {
  const calculated = withCalculations();
  res.json({
    payroll: {
      totalStaffProcessed: new Set(payrollRecords.map((record) => record.staff_id)).size,
      totalPayrollAmount: calculated.reduce((sum, record) => sum + record.net_pay, 0),
      totalPayslipsGenerated: payslips.length,
      failedUploadRecords: uploadLogs.reduce((sum, log) => sum + log.failedRows, 0)
    },
    invoice: {
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((invoice) => invoice.status === "Paid").length,
      unpaidInvoices: invoices.filter((invoice) => invoice.status !== "Paid").length,
      overdueInvoices: invoices.filter((invoice) => invoice.status === "Overdue").length,
      totalInvoiceAmount: invoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    }
  });
});

export default router;
