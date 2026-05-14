import express from "express";
import fs from "fs";
import { invoices } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";
import { parseCsv } from "../utils/csv.js";
import { mapVanidayInvoiceRow } from "../utils/invoiceMapper.js";

const router = express.Router();

router.get("/", allowRoles("Admin", "Finance"), (_req, res) => res.json(invoices));

router.post("/", allowRoles("Admin", "Finance"), (req, res) => {
  const inputAmount = Number(req.body.totalRevenue || req.body.amount || 0);
  const quantity = Number(req.body.qty || 1) || 1;
  const items = req.body.items?.length ? req.body.items : [{
    description: req.body.serviceName || req.body.description || "Service fee",
    quantity,
    unitPrice: quantity ? inputAmount / quantity : inputAmount,
    serviceDuration: req.body.serviceDuration,
    staffId: req.body.staffId,
    staffName: req.body.staffName
  }];
  const amount = items.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.unitPrice || 0), 0);
  const invoice = {
    id: invoices.length + 1,
    invoiceNumber: req.body.orderId ? `INV-${req.body.orderId}` : `INV-2026-${String(invoices.length + 1).padStart(3, "0")}`,
    orderId: req.body.orderId || "",
    sellerId: req.body.sellerId || "",
    shopTitle: req.body.shopTitle || "",
    customerId: req.body.customerId || "",
    customerName: req.body.customerName,
    customerEmail: req.body.customerEmail || req.body.email,
    customerPhone: req.body.contactNo || "",
    issueDate: req.body.issueDate || new Date().toISOString().slice(0, 10),
    dueDate: req.body.dueDate,
    status: req.body.status || "Draft",
    paymentMethod: req.body.paymentMethod || "Stripe",
    amount,
    vanidayCommission: Number(req.body.vanidayCommission || 0),
    vanidayShare: Number(req.body.vanidayShare || 0),
    salonShare: Number(req.body.salonShare || req.body.salonshare || 0),
    cashbackFee: Number(req.body.cashbackFee || 0),
    cashbackDiscount: Number(req.body.cashbackDiscount || 0),
    items
  };
  invoices.unshift(invoice);
  addAudit(req.user.email, `Invoice created ${invoice.invoiceNumber}`, "Invoice");
  res.status(201).json(invoice);
});

router.post("/upload-csv", allowRoles("Admin", "Finance"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file is required" });
  const text = fs.readFileSync(req.file.path, "utf8");
  const imported = parseCsv(text)
    .filter((row) => row.OrderID || row.customerName || row.Total_Revenue)
    .map((row, index) => mapVanidayInvoiceRow(row, index));
  invoices.unshift(...imported);
  addAudit(req.user.email, `Vaniday invoice CSV upload: ${req.file.originalname} (${imported.length} rows)`, "Invoice");
  res.json({ rows: imported, imported: imported.length });
});

router.patch("/:invoiceId/status", allowRoles("Admin", "Finance"), (req, res) => {
  const invoice = invoices.find((item) => item.id === Number(req.params.invoiceId));
  if (!invoice) return res.status(404).json({ message: "Invoice not found" });
  invoice.status = req.body.status || invoice.status;
  res.json(invoice);
});

export default router;
