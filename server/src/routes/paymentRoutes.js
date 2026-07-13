const express = require("express");
const {
  createStripePaymentLink,
  getPaymentsWorkspace,
  recordManualPayment,
  stripeWebhook
} = require("../controllers/paymentController");
const { addAudit } = require("../services/audit");
const {
  setupModernTreasuryRecipients,
  submitModernTreasuryPayrollBatch,
  toMoney
} = require("../services/modernTreasuryPaymentService");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

function validatePaymentEmployees(employees) {
  if (!Array.isArray(employees) || employees.length === 0) {
    return {
      valid: false,
      response: { message: "At least one approved employee payment is required" }
    };
  }

  const invalidEmployees = employees.filter(
    (employee) =>
      !employee.employeeId ||
      !employee.employeeName ||
      !employee.bankName ||
      !employee.bankAccount ||
      toMoney(employee.amount) <= 0
  );

  if (invalidEmployees.length) {
    return {
      valid: false,
      response: {
      message: "All payment recipients must have employee details, bank details and a positive amount",
      invalidEmployeeIds: invalidEmployees.map((employee) => employee.employeeId || "Unknown")
      }
    };
  }

  return { valid: true };
}

async function setupModernTreasuryRecipientAccounts(req, res) {
  const { forceNew = false, payrollRunId, employees = [] } = req.body || {};
  const validation = validatePaymentEmployees(employees);

  if (!validation.valid) {
    return res.status(400).json(validation.response);
  }

  try {
    const result = await setupModernTreasuryRecipients({ employees, forceNew });

    addAudit(
      req.user.email,
      `${forceNew ? "Refreshed" : "Set up"} ${result.recipientCount} Modern Treasury payroll recipient(s) for ${payrollRunId || "selected run"}`,
      "Payroll Payment"
    );

    res.status(201).json(result);
  } catch (error) {
    res.status(502).json({
      message: error.message || "Modern Treasury recipient setup failed"
    });
  }
}

async function submitModernTreasuryTransfer(req, res) {
  const { payrollRunId, payrollPeriod, employees = [] } = req.body || {};

  if (!payrollRunId || !payrollPeriod) {
    return res.status(400).json({ message: "payrollRunId and payrollPeriod are required" });
  }

  const validation = validatePaymentEmployees(employees);

  if (!validation.valid) {
    return res.status(400).json(validation.response);
  }

  try {
    const result = await submitModernTreasuryPayrollBatch({ payrollRunId, payrollPeriod, employees });

    addAudit(
      req.user.email,
      `${result.message}: ${result.batchReference} for ${payrollRunId}`,
      "Payroll Payment"
    );

    res.status(201).json(result);
  } catch (error) {
    res.status(502).json({
      message: error.message || "Modern Treasury payroll payment submission failed"
    });
  }
}

router.post("/stripe/webhook", stripeWebhook);

router.use(authenticateToken);
router.get("/", getPaymentsWorkspace);
router.post("/manual", recordManualPayment);
router.post("/stripe-link", createStripePaymentLink);
router.post("/modern-treasury-recipients", allowRoles("Admin", "Finance"), setupModernTreasuryRecipientAccounts);
router.post("/modern-treasury-transfer", allowRoles("Admin", "Finance"), submitModernTreasuryTransfer);
router.post("/demo-bank-transfer", allowRoles("Admin", "Finance"), submitModernTreasuryTransfer);

module.exports = router;
