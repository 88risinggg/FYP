const MODERN_TREASURY_API_URL = "https://app.moderntreasury.com/api";

function toMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toSmallestCurrencyUnit(value) {
  return Math.round(Number(value || 0) * 100);
}

function createReference(prefix) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${timestamp}-${random}`;
}

function getModernTreasuryConfig() {
  return {
    apiKey: process.env.MODERN_TREASURY_API_KEY,
    organizationId: process.env.MODERN_TREASURY_ORGANIZATION_ID,
    originatingAccountId: process.env.MODERN_TREASURY_ORIGINATING_ACCOUNT_ID,
    paymentCurrency: process.env.MODERN_TREASURY_PAYMENT_CURRENCY || "USD",
    paymentType: process.env.MODERN_TREASURY_PAYMENT_TYPE || "ach",
    simulatedTreasuryBalance: Number(process.env.SIMULATED_TREASURY_BALANCE_SGD || 500000)
  };
}

function canUseModernTreasuryApi(employee, config) {
  return Boolean(
    config.apiKey &&
    config.organizationId &&
    config.originatingAccountId &&
    config.paymentCurrency === "USD" &&
    employee.modernTreasuryCounterpartyId &&
    employee.modernTreasuryReceivingAccountId
  );
}

function ensureModernTreasuryCredentials(config) {
  if (!config.apiKey || !config.organizationId) {
    throw new Error("Modern Treasury organization ID and API key are required");
  }
}

async function modernTreasuryRequest(path, { method = "GET", body } = {}) {
  const config = getModernTreasuryConfig();

  ensureModernTreasuryCredentials(config);

  const credentials = Buffer.from(`${config.organizationId}:${config.apiKey}`).toString("base64");
  const response = await fetch(`${MODERN_TREASURY_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorDetails = [
      data.message,
      data.error,
      data.errors ? JSON.stringify(data.errors) : "",
      data.details ? JSON.stringify(data.details) : ""
    ].filter(Boolean).join(" ");

    throw new Error(errorDetails || `Modern Treasury request failed: ${method} ${path}`);
  }

  return data;
}

function getSandboxAchDetails(employee, index) {
  const numericEmployeeId = String(employee.employeeId || index + 1).replace(/\D/g, "");
  const accountSuffix = String(Number(numericEmployeeId || index + 1)).padStart(4, "0");

  return {
    accountNumber: `12345${accountSuffix}`,
    routingNumber: "121141822"
  };
}

async function createModernTreasuryRecipient(employee, index) {
  const achDetails = getSandboxAchDetails(employee, index);
  const counterparty = await modernTreasuryRequest("/counterparties", {
    method: "POST",
    body: {
      name: employee.employeeName,
      email: employee.email || undefined,
      external_id: `fyp-payroll-${employee.employeeId}-${Date.now()}-${index}`,
      metadata: {
        source: "fyp_payroll_demo",
        employee_id: employee.employeeId
      },
      accounts: [
        {
          account_type: "checking",
          name: `${employee.employeeName} Payroll Account`,
          routing_details: [
            {
              routing_number_type: "aba",
              routing_number: achDetails.routingNumber
            }
          ],
          account_details: [
            {
              account_number: achDetails.accountNumber
            }
          ],
          metadata: {
            source: "fyp_payroll_demo",
            displayed_bank_name: employee.bankName || "Sandbox ACH"
          }
        }
      ]
    }
  });
  const externalAccount = Array.isArray(counterparty.accounts) ? counterparty.accounts[0] : null;

  if (!externalAccount?.id) {
    throw new Error(`Modern Treasury did not return an external account for ${employee.employeeName}`);
  }

  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    modernTreasuryCounterpartyId: counterparty.id,
    modernTreasuryReceivingAccountId: externalAccount.id,
    sandboxRoutingNumber: achDetails.routingNumber,
    sandboxAccountNumberSafe: achDetails.accountNumber.slice(-4)
  };
}

async function setupModernTreasuryRecipients({ employees, forceNew = false }) {
  const mappings = [];

  for (const [index, employee] of employees.entries()) {
    if (!forceNew && employee.modernTreasuryCounterpartyId && employee.modernTreasuryReceivingAccountId) {
      mappings.push({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        modernTreasuryCounterpartyId: employee.modernTreasuryCounterpartyId,
        modernTreasuryReceivingAccountId: employee.modernTreasuryReceivingAccountId,
        reused: true
      });
      continue;
    }

    mappings.push(await createModernTreasuryRecipient(employee, index));
  }

  return {
    provider: "Modern Treasury Sandbox",
    recipientCount: mappings.length,
    recipients: mappings
  };
}

function createSimulationTransfer({ employee, batchReference, index }) {
  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    bankName: employee.bankName,
    maskedBankAccount: String(employee.bankAccount).replace(/.(?=.{4})/g, "*"),
    amount: toMoney(employee.amount),
    currency: employee.currency || "SGD",
    status: "Submitted",
    transferId: `${batchReference}-${String(index + 1).padStart(3, "0")}`
  };
}

async function createPaymentOrder({ employee, payrollRunId, payrollPeriod, batchReference, config }) {
  const data = await modernTreasuryRequest("/payment_orders", {
    method: "POST",
    body: {
      amount: toSmallestCurrencyUnit(employee.amount),
      counterparty_id: employee.modernTreasuryCounterpartyId,
      currency: config.paymentCurrency,
      direction: "credit",
      type: config.paymentType,
      originating_account_id: config.originatingAccountId,
      receiving_account_id: employee.modernTreasuryReceivingAccountId,
      description: `Payroll ${payrollPeriod} - ${employee.employeeName}`,
      metadata: {
        payroll_run_id: payrollRunId,
        payroll_period: payrollPeriod,
        employee_id: employee.employeeId,
        payroll_batch_reference: batchReference,
        payroll_display_currency: employee.currency || "SGD"
      }
    }
  });

  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    bankName: employee.bankName,
    maskedBankAccount: String(employee.bankAccount).replace(/.(?=.{4})/g, "*"),
    amount: toMoney(employee.amount),
    currency: data.currency || config.paymentCurrency,
    status: data.status || "created",
    transferId: data.id,
    modernTreasuryReference: data.reference_number || data.id
  };
}

async function submitModernTreasuryPayrollBatch({ payrollRunId, payrollPeriod, employees }) {
  const config = getModernTreasuryConfig();
  const batchReference = createReference("MT-PAYROLL");
  const submittedAt = new Date().toISOString();
  const canSubmitLiveSandbox = employees.every((employee) => canUseModernTreasuryApi(employee, config));
  const transfers = [];

  if (canSubmitLiveSandbox) {
    for (const employee of employees) {
      transfers.push(await createPaymentOrder({ employee, payrollRunId, payrollPeriod, batchReference, config }));
    }
  } else {
    employees.forEach((employee, index) => {
      transfers.push(createSimulationTransfer({ employee, batchReference, index }));
    });
  }
  const totalAmount = toMoney(transfers.reduce((sum, transfer) => sum + transfer.amount, 0));
  const simulatedBalanceBefore = toMoney(config.simulatedTreasuryBalance);
  const simulatedBalanceAfter = toMoney(simulatedBalanceBefore - totalAmount);

  return {
    message: canSubmitLiveSandbox
      ? "Modern Treasury sandbox payment orders submitted"
      : `Modern Treasury payroll batch simulated in ${config.paymentCurrency}`,
    provider: canSubmitLiveSandbox ? "Modern Treasury Sandbox" : `Modern Treasury Sandbox Simulation (${config.paymentCurrency})`,
    mode: canSubmitLiveSandbox ? "api" : "simulation",
    modeReason: canSubmitLiveSandbox
      ? ""
      : config.paymentCurrency === "USD"
        ? "Modern Treasury recipient setup is incomplete."
        : `${config.paymentCurrency} is not supported by the current Modern Treasury originating account.`,
    batchReference,
    submittedAt,
    payrollRunId,
    payrollPeriod,
    totalAmount,
    simulationAccount: canSubmitLiveSandbox
      ? null
      : {
        accountName: "Vaniday SGD Payroll Simulation Account",
        balanceBefore: simulatedBalanceBefore,
        balanceAfter: simulatedBalanceAfter,
        currency: config.paymentCurrency
      },
    transferCount: transfers.length,
    transfers
  };
}

module.exports = {
  setupModernTreasuryRecipients,
  submitModernTreasuryPayrollBatch,
  toMoney
};
