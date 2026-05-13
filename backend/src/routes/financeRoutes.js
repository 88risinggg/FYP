import express from "express";
import { invoices } from "../data.js";
import { allowRoles } from "../middleware/auth.js";

const router = express.Router();

router.get("/dashboard", allowRoles("Finance"), (_req, res) => {
  res.json({
    invoices: invoices.length,
    paidInvoices: invoices.filter((invoice) => invoice.status === "Paid").length,
    unpaidInvoices: invoices.filter((invoice) => invoice.status !== "Paid").length,
    invoiceAmount: invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)
  });
});

export default router;
