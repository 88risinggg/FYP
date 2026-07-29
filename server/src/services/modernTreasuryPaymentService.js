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
    employee.modernTreasuryReceivingAccountId &&
    !String(employee.modernTreasuryCounterpartyId).startsWith("sim_") &&
    !String(employee.modernTreasuryReceivingAccountId).startsWith("sim_")
  );
}

function ensureModernTreasuryCredentials(config) {
  if (!config.apiKey || !config.organizationId) {
    throw new Error("Modern Treasury organization ID and API key are required");
  }
}

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

async function modernTreasuryRequest(path, { method = "GET", body, idempotencyKey, maxAttempts = 3 } = {}) {
  const config = getModernTreasuryConfig();

  ensureModernTreasuryCredentials(config);

  const credentials = Buffer.from(`${config.organizationId}:${config.apiKey}`).toString("base64");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(`${MODERN_TREASURY_API_URL}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000)
      });
    } catch (error) {
      if (attempt < maxAttempts && ["AbortError", "TimeoutError", "TypeError"].includes(error.name)) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** (attempt - 1))));
        continue;
      }
      throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    const errorDetails = [data.message, data.error, data.errors ? JSON.stringify(data.errors) : "", data.details ? JSON.stringify(data.details) : ""].filter(Boolean).join(" ");
    if (TRANSIENT_STATUS.has(response.status) && attempt < maxAttempts) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 5000) : 250 * (2 ** (attempt - 1))));
      continue;
    }
    const error = new Error(errorDetails || `Modern Treasury request failed: ${method} ${path}`);
    error.status = response.status;
    throw error;
  }
  throw new Error(`Modern Treasury request failed: ${method} ${path}`);
}

function getSandboxAchDetails(employee, index) {
  return {
    // Modern Treasury's documented Sandbox value for a successful ACH flow.
    accountNumber: "123456789",
    routingNumber: "121141822"
  };
}

function recipientExternalId(employee) {
  return `fyp-payroll-${employee.employeeId}`;
}

function recipientMapping(employee, counterparty, { reused = false } = {}) {
  const externalAccount = Array.isArray(counterparty?.accounts) ? counterparty.accounts[0] : null;

  if (!counterparty?.id || !externalAccount?.id) {
    throw new Error(`Modern Treasury did not return an external account for ${employee.employeeName}`);
  }

  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    modernTreasuryCounterpartyId: counterparty.id,
    modernTreasuryReceivingAccountId: externalAccount.id,
    ...(reused ? { reused: true } : {})
  };
}

async function findModernTreasuryRecipient(employee) {
  const externalId = recipientExternalId(employee);
  const response = await modernTreasuryRequest(
    `/counterparties?external_id=${encodeURIComponent(externalId)}&per_page=2`
  );
  const counterparties = Array.isArray(response) ? response : (response?.data || []);
  return counterparties.find((counterparty) => counterparty.external_id === externalId) || null;
}

async function createModernTreasuryRecipient(employee, index) {
  const achDetails = getSandboxAchDetails(employee, index);
  const idempotencyKey = `finance-recipient-${employee.employeeId}`;
  const existingCounterparty = await findModernTreasuryRecipient(employee);

  if (existingCounterparty) {
    return recipientMapping(employee, existingCounterparty, { reused: true });
  }

  const counterparty = await modernTreasuryRequest("/counterparties", {
    method: "POST",
    idempotencyKey,
    body: {
      name: employee.employeeName,
      email: employee.email || undefined,
      external_id: recipientExternalId(employee),
      metadata: {
        source: "fyp_payroll_demo",
        employee_id: String(employee.employeeId)
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
  return {
    ...recipientMapping(employee, counterparty),
    sandboxRoutingNumber: achDetails.routingNumber,
    sandboxAccountNumberSafe: achDetails.accountNumber.slice(-4)
  };
}

async function setupModernTreasuryRecipients({ employees, forceNew = false }) {
  const mappings = [];
  const failures = [];

  for (const [index, employee] of employees.entries()) {
    const simulated = String(employee.modernTreasuryCounterpartyId || "").startsWith("sim_")
      || String(employee.modernTreasuryReceivingAccountId || "").startsWith("sim_");
    if (!forceNew && !simulated && employee.modernTreasuryCounterpartyId && employee.modernTreasuryReceivingAccountId) {
      mappings.push({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        modernTreasuryCounterpartyId: employee.modernTreasuryCounterpartyId,
        modernTreasuryReceivingAccountId: employee.modernTreasuryReceivingAccountId,
        reused: true
      });
      continue;
    }

    try {
      mappings.push(await createModernTreasuryRecipient(employee, index));
    } catch (error) {
      failures.push({ employeeId: employee.employeeId, employeeName: employee.employeeName, message: error.message || "Recipient configuration failed" });
    }
  }

  return {
    provider: "Modern Treasury Sandbox",
    mode: "api",
    recipientCount: mappings.length,
    reusedCount: mappings.filter((item) => item.reused).length,
    failedCount: failures.length,
    recipients: mappings,
    failures
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
  const idempotencyKey = `finance-payroll-${payrollRunId}-${employee.payrollId || employee.employeeId}`;
  const data = await modernTreasuryRequest("/payment_orders", {
    method: "POST",
    idempotencyKey,
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
        payroll_run_id: String(payrollRunId),
        payroll_period: String(payrollPeriod),
        employee_id: String(employee.employeeId),
        payroll_batch_reference: String(batchReference),
        payroll_display_currency: String(employee.currency || "SGD"),
        idempotency_key: String(idempotencyKey)
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
    modernTreasuryReference: data.reference_number || data.id,
    idempotencyKey
  };
}

async function submitModernTreasuryEmployeePayment({ payrollRunId, payrollPeriod, employee, batchReference }) {
  const config = getModernTreasuryConfig();
  if (!canUseModernTreasuryApi(employee, config)) {
    const error = new Error("Modern Treasury live sandbox credentials, USD originating account, or recipient mappings are incomplete.");
    error.code = "MODERN_TREASURY_NOT_READY";
    throw error;
  }
  return createPaymentOrder({ employee, payrollRunId, payrollPeriod, batchReference, config });
}

async function submitModernTreasuryPayrollBatch({ payrollRunId, payrollPeriod, employees, batchReference: requestedBatchReference }) {
  const config = getModernTreasuryConfig();
  const batchReference = requestedBatchReference || createReference("MT-PAYROLL");
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
        accountName: "PayNivo SGD Payroll Simulation Account",
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
  submitModernTreasuryEmployeePayment,
  submitModernTreasuryPayrollBatch,
  toMoney
};
