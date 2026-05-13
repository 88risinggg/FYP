import express from "express";
import { automationSettings } from "../data.js";
import { allowRoles } from "../middleware/auth.js";
import { addAudit } from "../services/audit.js";

const router = express.Router();

router.get("/automation", allowRoles("Admin", "Finance", "HR"), (_req, res) => res.json(automationSettings));

router.put("/automation", allowRoles("Admin", "Finance", "HR"), (req, res) => {
  Object.assign(automationSettings, {
    payslipAutoEmailEnabled: Boolean(req.body.payslipAutoEmailEnabled),
    payslipEmailDay: Number(req.body.payslipEmailDay || automationSettings.payslipEmailDay),
    invoiceAutoEmailEnabled: Boolean(req.body.invoiceAutoEmailEnabled),
    invoiceEmailDay: Number(req.body.invoiceEmailDay || automationSettings.invoiceEmailDay),
    reminder1DaysAfterDue: Number(req.body.reminder1DaysAfterDue || automationSettings.reminder1DaysAfterDue),
    reminder2DaysAfterDue: Number(req.body.reminder2DaysAfterDue || automationSettings.reminder2DaysAfterDue),
    whatsappEnabled: Boolean(req.body.whatsappEnabled)
  });
  addAudit(req.user.email, "Automation settings updated", "Settings");
  res.json(automationSettings);
});

export default router;
