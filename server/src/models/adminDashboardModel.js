const { pool } = require("../config/db");
const { getAdminReminderMonitorData } = require("./adminReminderMonitorModel");
const { getAdminEmailDeliveryData } = require("./adminEmailDeliveryModel");

const dashboardInvoiceStatuses = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];

function isMissingShapeError(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR";
}

async function safeQuery(query, params = [], fallback = []) {
  try {
    const [rows] = await pool.execute(query, params);
    return { rows, missing: false };
  } catch (error) {
    if (isMissingShapeError(error)) {
      return { rows: fallback, missing: true };
    }

    throw error;
  }
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}

async function getTableColumns(tableName) {
  const result = await safeQuery(`SHOW COLUMNS FROM ${quoteIdentifier(tableName)}`, [], []);

  if (result.missing) {
    return null;
  }

  return result.rows.map((row) => row.Field);
}

function pickColumn(columns, candidates) {
  if (!columns) return null;

  const normalizedColumns = columns.reduce((items, column) => {
    items[String(column).toLowerCase()] = column;
    return items;
  }, {});

  return candidates.map((candidate) => normalizedColumns[candidate.toLowerCase()]).find(Boolean) || null;
}

function columnExpression(alias, column) {
  return column ? `${alias}.${quoteIdentifier(column)}` : null;
}

function coalesceExpression(expressions, fallback = "0") {
  const available = expressions.filter(Boolean);
  return available.length ? `COALESCE(${available.join(", ")}, ${fallback})` : fallback;
}

function normalizeInvoiceStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return dashboardInvoiceStatuses.find((item) => item.toLowerCase() === normalized) || null;
}

function normalizeRange(range) {
  const normalized = String(range || "last-30-days").trim().toLowerCase();
  return [
    "today",
    "last-7-days",
    "last-30-days",
    "last-90-days",
    "this-month",
    "this-quarter",
    "this-year",
    "custom",
    "all-time"
  ].includes(normalized)
    ? normalized
    : "last-30-days";
}

function normalizePaymentReminderRange(range) {
  const normalized = String(range || "today").trim().toLowerCase();
  return [
    "today",
    "last-7-days",
    "last-30-days",
    "this-month",
    "this-quarter",
    "this-year"
  ].includes(normalized)
    ? normalized
    : "today";
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function dateOnly(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getRangeConfig(range, options = {}) {
  const normalized = normalizeRange(range);
  const today = new Date();
  const endDate = dateOnly(today);
  let startDate = null;
  let period = "day";

  if (normalized === "custom") {
    startDate = isIsoDate(options.startDate) ? options.startDate : null;
    const customEndDate = isIsoDate(options.endDate) ? options.endDate : endDate;
    const customDays = startDate
      ? Math.max(0, Math.ceil((new Date(customEndDate) - new Date(startDate)) / 86400000))
      : 0;
    return {
      range: normalized,
      startDate,
      endDate: customEndDate,
      period: customDays > 730 ? "month" : customDays > 90 ? "week" : "day"
    };
  }

  if (normalized === "today") {
    startDate = endDate;
    period = "hour";
  } else if (normalized === "last-7-days") {
    startDate = dateOnly(addDays(today, -6));
  } else if (normalized === "last-30-days") {
    startDate = dateOnly(addDays(today, -29));
  } else if (normalized === "last-90-days") {
    startDate = dateOnly(addDays(today, -89));
    period = "week";
  } else if (normalized === "this-month") {
    startDate = dateOnly(new Date(today.getFullYear(), today.getMonth(), 1));
  } else if (normalized === "this-quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    startDate = dateOnly(new Date(today.getFullYear(), quarterStartMonth, 1));
    period = "week";
  } else if (normalized === "this-year") {
    startDate = dateOnly(new Date(today.getFullYear(), 0, 1));
    period = "month";
  } else {
    period = "month";
  }

  return {
    range: normalized,
    startDate,
    endDate,
    period
  };
}

function getPaymentReminderRangeConfig(range) {
  return getRangeConfig(normalizePaymentReminderRange(range));
}

function rangeWhere(dateExpression, rangeConfig, params) {
  if (!dateExpression || !rangeConfig.startDate) {
    return "";
  }

  params.push(rangeConfig.startDate, rangeConfig.endDate);
  return `DATE(${dateExpression}) BETWEEN ? AND ?`;
}

function statusOrderSql(expression) {
  return `FIELD(${expression}, 'Draft', 'Sent', 'Viewed', 'Paid', 'Overdue')`;
}

function percentage(count, total) {
  const value = Number(count || 0);
  const base = Number(total || 0);
  return base > 0 ? Number(((value / base) * 100).toFixed(1)) : 0;
}

function mapOverviewCounts(row = {}) {
  return {
    totalInvoices: Number(row.totalInvoices || 0),
    draft: Number(row.draft || 0),
    sent: Number(row.sent || 0),
    viewed: Number(row.viewed || 0),
    paid: Number(row.paid || 0),
    overdue: Number(row.overdue || 0),
    void: Number(row.void || 0),
    paidRevenue: Number(row.paidRevenue || 0),
    outstandingAmount: Number(row.outstandingAmount || 0),
    overdueOutstandingAmount: Number(row.overdueOutstandingAmount || 0)
  };
}

function buildInvoiceContext(invoiceColumns, customerColumns) {
  if (!invoiceColumns) return null;

  const idColumn = pickColumn(invoiceColumns, ["invoice_id", "id"]);
  const statusColumn = pickColumn(invoiceColumns, ["status", "invoice_status"]);

  if (!idColumn || !statusColumn) {
    return null;
  }

  const dueDateColumn = pickColumn(invoiceColumns, ["due_date", "dueDate"]);
  const issueDateColumn = pickColumn(invoiceColumns, ["issue_date", "invoice_date", "created_at", "createdAt"]);
  const createdAtColumn = pickColumn(invoiceColumns, ["created_at", "createdAt"]);
  const updatedAtColumn = pickColumn(invoiceColumns, ["updated_at", "updatedAt"]);
  const customerIdColumn = pickColumn(invoiceColumns, ["customer_id", "customerId"]);
  const invoiceNoColumn = pickColumn(invoiceColumns, [
    "invoice_no",
    "invoice_number",
    "invoiceNumber",
    "invoiceId",
    "reference_no",
    "reference"
  ]);
  const amountColumn = pickColumn(invoiceColumns, [
    "balance_due",
    "amount_due",
    "outstanding_amount",
    "total_amount",
    "grand_total",
    "amount"
  ]);
  const totalAmountColumn = pickColumn(invoiceColumns, ["total_amount", "grand_total", "amount", "amount_due"]);
  const balanceColumn = pickColumn(invoiceColumns, ["balance_due", "outstanding_amount", "amount_due"]);
  const deletedColumn = pickColumn(invoiceColumns, ["deleted_at", "is_deleted", "deleted"]);
  const customerNameColumn = pickColumn(customerColumns, ["name", "customer_name", "company_name"]);
  const customerTableIdColumn = pickColumn(customerColumns, ["customer_id", "id"]);
  const canJoinCustomer = Boolean(customerIdColumn && customerTableIdColumn && customerNameColumn);

  const idExpr = columnExpression("invoice", idColumn);
  const invoiceNoExpr = coalesceExpression(
    [
      columnExpression("invoice", invoiceNoColumn),
      `CONCAT('INV-', ${idExpr})`
    ],
    "NULL"
  );
  const amountExpr = coalesceExpression([columnExpression("invoice", amountColumn)], "0");
  const totalAmountExpr = coalesceExpression([columnExpression("invoice", totalAmountColumn), amountExpr], "0");
  const outstandingAmountExpr = coalesceExpression([columnExpression("invoice", balanceColumn), amountExpr], "0");
  const dueDateExpr = columnExpression("invoice", dueDateColumn);
  const issueDateExpr = columnExpression("invoice", issueDateColumn);
  const updatedAtExpr = columnExpression("invoice", updatedAtColumn);
  const createdAtExpr = columnExpression("invoice", createdAtColumn);
  const sortExpr = updatedAtExpr || createdAtExpr || idExpr;
  const statusExpr = columnExpression("invoice", statusColumn);
  const normalizedStatusExpr = dueDateExpr
    ? `CASE
        WHEN ${dueDateExpr} IS NOT NULL AND ${dueDateExpr} < CURDATE() AND LOWER(${statusExpr}) <> 'paid' THEN 'Overdue'
        ELSE ${statusExpr}
      END`
    : statusExpr;

  return {
    idExpr,
    invoiceNoExpr,
    amountExpr,
    totalAmountExpr,
    balanceExpr: columnExpression("invoice", balanceColumn),
    outstandingAmountExpr,
    dueDateExpr,
    issueDateExpr,
    createdAtExpr,
    updatedAtExpr,
    sortExpr,
    statusExpr,
    normalizedStatusExpr,
    deletedColumn,
    invoiceNoColumn,
    validInvoiceFilters: [
      invoiceNoColumn ? `${columnExpression("invoice", invoiceNoColumn)} <> '__SETTINGS__'` : "",
      deletedColumn
        ? (String(deletedColumn).toLowerCase().includes("_at")
          ? `${columnExpression("invoice", deletedColumn)} IS NULL`
          : `COALESCE(${columnExpression("invoice", deletedColumn)}, 0) = 0`)
        : ""
    ].filter(Boolean),
    customerNameExpr: canJoinCustomer ? columnExpression("customer", customerNameColumn) : "NULL",
    joinCustomerSql: canJoinCustomer
      ? `LEFT JOIN customer ON invoice.${quoteIdentifier(customerIdColumn)} = customer.${quoteIdentifier(customerTableIdColumn)}`
      : ""
  };
}

async function getAdminProfile(userId, missingTables) {
  const userColumns = await getTableColumns("user");

  if (!userColumns) {
    missingTables.add("user");
    return {
      id: userId || null,
      name: "Admin",
      role: "Admin",
      lastLoginAt: null
    };
  }

  const idColumn = pickColumn(userColumns, ["user_id", "id"]);
  const nameColumn = pickColumn(userColumns, ["name", "full_name", "username"]);
  const emailColumn = pickColumn(userColumns, ["email"]);
  const previousLoginColumn = pickColumn(userColumns, ["previous_login_at"]);
  const lastLoginColumn = pickColumn(userColumns, ["last_login_at"]);
  const lastLoginExpr = coalesceExpression(
    [columnExpression("user", previousLoginColumn), columnExpression("user", lastLoginColumn)],
    "NULL"
  );

  if (!idColumn || !userId) {
    return {
      id: userId || null,
      name: "Admin",
      role: "Admin",
      lastLoginAt: null
    };
  }

  const result = await safeQuery(
    `SELECT
      ${columnExpression("user", idColumn)} AS id,
      ${coalesceExpression([columnExpression("user", nameColumn), columnExpression("user", emailColumn)], "'Admin'")} AS name,
      role.role_name AS role,
      ${lastLoginExpr} AS lastLoginAt
     FROM user
     LEFT JOIN role ON user.role_id = role.role_id
     WHERE ${columnExpression("user", idColumn)} = ?
     LIMIT 1`,
    [userId],
    []
  );

  if (result.missing) {
    missingTables.add("user");
  }

  const row = result.rows[0];

  return {
    id: row?.id || userId,
    name: row?.name || "Admin",
    role: row?.role || "Admin",
    lastLoginAt: row?.lastLoginAt || null
  };
}

async function getReminderFailedCount(missingTables) {
  for (const table of ["audit_logs", "reminder_logs", "invoice_reminder_log"]) {
    const columns = await getTableColumns(table);
    if (!columns) continue;

    const deliveryColumn = pickColumn(columns, ["delivery_status", "status"]);
    const activityColumn = pickColumn(columns, ["activity_type"]);
    if (!deliveryColumn) continue;

    const filters = [`LOWER(${columnExpression(table, deliveryColumn)}) = 'failed'`];
    if (activityColumn) {
      filters.push(`LOWER(${columnExpression(table, activityColumn)}) = 'invoice_reminder'`);
    }

    const result = await safeQuery(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} AS ${quoteIdentifier(table)} WHERE ${filters.join(" AND ")}`,
      [],
      [{ count: 0 }]
    );
    return { count: Number(result.rows[0]?.count || 0), available: !result.missing };
  }

  missingTables.add("invoice reminders");
  return { count: 0, available: false };
}

async function getPaymentsToVerifyCount(missingTables) {
  const paymentTable = (await getTableColumns("payment")) ? "payment" : (await getTableColumns("payments")) ? "payments" : null;

  if (!paymentTable) {
    missingTables.add("payment");
    return { count: 0, oldestPendingDays: null, available: false };
  }

  const columns = await getTableColumns(paymentTable);
  const statusColumn = pickColumn(columns, ["review_status", "verification_status", "payment_status", "status"]);
  const submittedColumn = pickColumn(columns, ["submitted_at", "created_at", "payment_date", "payment_date_input"]);
  const amountColumn = pickColumn(columns, ["amount", "payment_amount", "paid_amount", "total_amount"]);
  const invoiceIdColumn = pickColumn(columns, ["invoice_invoice_id", "invoice_id", "invoiceId"]);

  if (!statusColumn) {
    return { count: 0, oldestPendingDays: null, available: false };
  }

  const statusExpr = columnExpression(paymentTable, statusColumn);
  const submittedExpr = columnExpression(paymentTable, submittedColumn);
  const mismatchExpr = amountColumn && invoiceIdColumn
    ? `SUM(ABS(COALESCE(${columnExpression(paymentTable, amountColumn)}, 0) - GREATEST(COALESCE(invoice.total_amount, 0) - COALESCE((
         SELECT SUM(confirmed.amount)
         FROM ${quoteIdentifier(paymentTable)} AS confirmed
         WHERE confirmed.${quoteIdentifier(invoiceIdColumn)} = ${columnExpression(paymentTable, invoiceIdColumn)}
           AND LOWER(confirmed.status) IN ('paid', 'completed', 'success', 'successful', 'verified')
       ), 0), 0)) > 0.009)`
    : "0";
  const joins = invoiceIdColumn
    ? `LEFT JOIN invoice ON invoice.invoice_id = ${columnExpression(paymentTable, invoiceIdColumn)}`
    : "";
  const result = await safeQuery(
    `SELECT COUNT(*) AS count,
       ${mismatchExpr} AS mismatchCount,
       ${submittedExpr ? `DATEDIFF(CURDATE(), DATE(MIN(${submittedExpr})))` : "NULL"} AS oldestPendingDays
     FROM ${quoteIdentifier(paymentTable)} AS ${quoteIdentifier(paymentTable)}
     ${joins}
     WHERE LOWER(${statusExpr}) IN ('pending', 'pending review', 'pending verification', 'pending-verification', 'requires verification', 'unverified')`,
    [],
    [{ count: 0, mismatchCount: 0, oldestPendingDays: null }]
  );

  if (result.missing) missingTables.add(paymentTable);
  return {
    count: Number(result.rows[0]?.count || 0),
    mismatchCount: Number(result.rows[0]?.mismatchCount || 0),
    oldestPendingDays: result.rows[0]?.oldestPendingDays === null
      ? null
      : Number(result.rows[0]?.oldestPendingDays || 0),
    available: !result.missing
  };
}

async function getValidationErrorsCount(missingTables) {
  // Each re-validation supersedes the previous result for the same file. This
  // makes the card represent issues that still require action, not all errors
  // ever discovered in upload history.
  const uploadAuditColumns = await getTableColumns("audit_logs");
  const uploadActivityColumn = pickColumn(uploadAuditColumns, ["activity_type"]);
  const uploadFileColumn = pickColumn(uploadAuditColumns, ["upload_file_name"]);
  const uploadInvalidColumn = pickColumn(uploadAuditColumns, ["upload_invalid_rows"]);
  const uploadIdColumn = pickColumn(uploadAuditColumns, ["audit_log_id", "id"]);
  if (uploadActivityColumn && uploadFileColumn && uploadInvalidColumn && uploadIdColumn) {
    const result = await safeQuery(
      `SELECT COALESCE(SUM(COALESCE(latest_upload.${quoteIdentifier(uploadInvalidColumn)}, 0)), 0) AS count
       FROM audit_logs AS latest_upload
       INNER JOIN (
         SELECT ${quoteIdentifier(uploadFileColumn)} AS fileName,
                MAX(${quoteIdentifier(uploadIdColumn)}) AS latestId
         FROM audit_logs
         WHERE LOWER(${quoteIdentifier(uploadActivityColumn)}) = 'invoice_upload'
         GROUP BY ${quoteIdentifier(uploadFileColumn)}
       ) AS latest_by_file
         ON latest_by_file.latestId = latest_upload.${quoteIdentifier(uploadIdColumn)}`,
      [],
      [{ count: 0 }]
    );
    return { count: Number(result.rows[0]?.count || 0), available: !result.missing };
  }

  const candidateTables = ["invoice_upload_validation_errors", "bulk_upload_validation_errors", "validation_errors"];

  for (const table of candidateTables) {
    const columns = await getTableColumns(table);

    if (!columns) continue;

    const statusColumn = pickColumn(columns, ["status", "resolved_status"]);
    const resolvedColumn = pickColumn(columns, ["resolved", "is_resolved"]);
    const where = resolvedColumn
      ? `WHERE ${columnExpression(table, resolvedColumn)} = 0`
      : statusColumn
        ? `WHERE LOWER(${columnExpression(table, statusColumn)}) NOT IN ('resolved', 'fixed')`
        : "";
    const result = await safeQuery(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)} AS ${quoteIdentifier(table)} ${where}`,
      [],
      [{ count: 0 }]
    );

    if (result.missing) missingTables.add(table);
    return { count: Number(result.rows[0]?.count || 0), available: !result.missing };
  }

  const auditColumns = await getTableColumns("audit_logs");
  const activityColumn = pickColumn(auditColumns, ["activity_type"]);
  const invalidRowsColumn = pickColumn(auditColumns, ["upload_invalid_rows"]);
  const errorsColumn = pickColumn(auditColumns, ["upload_validation_errors_json"]);
  const createdAtColumn = pickColumn(auditColumns, ["created_at"]);
  const idColumn = pickColumn(auditColumns, ["audit_log_id", "id"]);

  if (activityColumn && (invalidRowsColumn || errorsColumn)) {
    const countExpr = invalidRowsColumn
      ? `COALESCE(${columnExpression("audit_logs", invalidRowsColumn)}, 0)`
      : `COALESCE(JSON_LENGTH(${columnExpression("audit_logs", errorsColumn)}), 0)`;
    const orderExpr = columnExpression("audit_logs", createdAtColumn) || columnExpression("audit_logs", idColumn) || "1";
    const result = await safeQuery(
      `SELECT ${countExpr} AS count
       FROM audit_logs
       WHERE LOWER(${columnExpression("audit_logs", activityColumn)}) = 'invoice_upload'
       ORDER BY ${orderExpr} DESC
       LIMIT 1`,
      [],
      [{ count: 0 }]
    );
    return { count: Number(result.rows[0]?.count || 0), available: !result.missing };
  }

  missingTables.add("invoice validation");
  return { count: 0, available: false };
}

async function getAuditEventsToday(missingTables) {
  const result = await safeQuery(
    "SELECT COUNT(*) AS count FROM audit_log WHERE DATE(created_at) = CURDATE()",
    [],
    [{ count: 0 }]
  );

  if (result.missing) missingTables.add("audit_log");
  return Number(result.rows[0]?.count || 0);
}

async function getInvoiceOverview(missingTables) {
  const invoiceColumns = await getTableColumns("invoice");

  if (!invoiceColumns) {
    missingTables.add("invoice");
    return {
      counts: mapOverviewCounts(),
      invoiceAvailable: false,
      paymentAvailable: false
    };
  }

  const context = buildInvoiceContext(invoiceColumns, null);

  if (!context) {
    missingTables.add("invoice");
    return {
      counts: mapOverviewCounts(),
      invoiceAvailable: false,
      paymentAvailable: false
    };
  }

  const {
    idExpr,
    totalAmountExpr,
    balanceExpr,
    dueDateExpr,
    statusExpr,
    deletedColumn,
    invoiceNoColumn
  } = context;
  const paymentContext = await getPaymentTableContext(missingTables);
  const canUsePayments = Boolean(
    paymentContext?.invoiceIdExpr && paymentContext?.amountExpr && paymentContext?.statusExpr
  );
  const confirmedPaymentExpr = canUsePayments ? "COALESCE(confirmed_payment.confirmedPaid, 0)" : "0";
  const paymentJoinSql = canUsePayments
    ? `LEFT JOIN (
        SELECT
          ${paymentContext.invoiceIdExpr} AS invoiceId,
          GREATEST(COALESCE(SUM(CASE
            WHEN ${successfulPaymentSql(paymentContext.statusExpr)} THEN ${paymentContext.amountExpr}
            WHEN ${refundedPaymentSql(paymentContext.statusExpr)} THEN -ABS(${paymentContext.amountExpr})
            ELSE 0
          END), 0), 0) AS confirmedPaid
        FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
        WHERE ${paymentContext.invoiceIdExpr} IS NOT NULL
        GROUP BY ${paymentContext.invoiceIdExpr}
      ) AS confirmed_payment ON confirmed_payment.invoiceId = ${idExpr}`
    : "";
  // Payment records are the source of truth. This keeps partial payments from
  // disappearing when an optional/stale balance column exists on invoice.
  const remainingBalanceExpr = `GREATEST(${totalAmountExpr} - ${confirmedPaymentExpr}, 0)`;
  const validInvoiceFilters = [
    `LOWER(COALESCE(${statusExpr}, '')) NOT IN ('void', 'cancelled', 'canceled', 'refunded')`
  ];

  if (invoiceNoColumn) {
    validInvoiceFilters.push(`${columnExpression("invoice", invoiceNoColumn)} <> '__SETTINGS__'`);
  }
  if (deletedColumn) {
    const deletedExpr = columnExpression("invoice", deletedColumn);
    validInvoiceFilters.push(String(deletedColumn).toLowerCase().includes("_at")
      ? `${deletedExpr} IS NULL`
      : `COALESCE(${deletedExpr}, 0) = 0`);
  }

  const dueDateSelect = dueDateExpr || "NULL";
  const normalizedStatusExpr = `CASE
        WHEN dueDate IS NOT NULL
          AND dueDate < CURDATE()
          AND remainingBalance > 0
          AND LOWER(rawStatus) NOT IN ('draft', 'generated', 'scheduled', 'paid')
        THEN 'Overdue'
        WHEN LOWER(rawStatus) IN ('draft', 'generated', 'scheduled') THEN 'Draft'
        WHEN LOWER(rawStatus) IN ('sent', 'unpaid') THEN 'Sent'
        WHEN LOWER(rawStatus) IN ('viewed', 'pending review', 'partially_paid', 'partially paid', 'partial', 'failed_payment') THEN 'Viewed'
        WHEN LOWER(rawStatus) = 'paid' THEN 'Paid'
        WHEN LOWER(rawStatus) = 'overdue' THEN 'Overdue'
        ELSE 'Sent'
      END`;

  const summaryResult = await safeQuery(
    `SELECT
      COUNT(*) AS totalInvoices,
      SUM(LOWER(normalizedStatus) = 'draft') AS draft,
      SUM(LOWER(normalizedStatus) = 'sent') AS sent,
      SUM(LOWER(normalizedStatus) = 'viewed') AS viewed,
      SUM(LOWER(normalizedStatus) = 'paid') AS paid,
      SUM(LOWER(normalizedStatus) = 'overdue') AS overdue,
      SUM(confirmedPaid) AS paidRevenue,
      SUM(CASE WHEN LOWER(normalizedStatus) <> 'paid' THEN remainingBalance ELSE 0 END) AS outstandingAmount,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'overdue' THEN remainingBalance ELSE 0 END) AS overdueOutstandingAmount
     FROM (
      SELECT
        rawStatus,
        confirmedPaid,
        remainingBalance,
        ${normalizedStatusExpr} AS normalizedStatus
      FROM (
        SELECT
          ${statusExpr} AS rawStatus,
          ${dueDateSelect} AS dueDate,
          ${confirmedPaymentExpr} AS confirmedPaid,
          ${remainingBalanceExpr} AS remainingBalance
        FROM invoice
        ${paymentJoinSql}
        WHERE ${validInvoiceFilters.join(" AND ")}
      ) AS invoice_balance_summary
     ) AS dashboard_invoice_summary`,
    [],
    [mapOverviewCounts()]
  );

  if (summaryResult.missing) missingTables.add("invoice");

  const voidFilters = [`LOWER(COALESCE(${statusExpr}, '')) = 'void'`];
  if (invoiceNoColumn) voidFilters.push(`${columnExpression("invoice", invoiceNoColumn)} <> '__SETTINGS__'`);
  if (deletedColumn) {
    const deletedExpr = columnExpression("invoice", deletedColumn);
    voidFilters.push(String(deletedColumn).toLowerCase().includes("_at")
      ? `${deletedExpr} IS NULL`
      : `COALESCE(${deletedExpr}, 0) = 0`);
  }
  const voidResult = await safeQuery(
    `SELECT COUNT(*) AS count FROM invoice WHERE ${voidFilters.join(" AND ")}`,
    [],
    [{ count: 0 }]
  );
  const counts = mapOverviewCounts(summaryResult.rows[0]);
  counts.void = Number(voidResult.rows[0]?.count || 0);

  return {
    counts,
    invoiceAvailable: !summaryResult.missing,
    paymentAvailable: canUsePayments
  };
}

async function getPaymentTableContext(missingTables) {
  const paymentTable = (await getTableColumns("payment"))
    ? "payment"
    : (await getTableColumns("payments"))
      ? "payments"
      : (await getTableColumns("payment_records"))
        ? "payment_records"
        : null;

  if (!paymentTable) {
    missingTables.add("payment");
    return null;
  }

  const columns = await getTableColumns(paymentTable);
  const alias = "payment_record";
  const idColumn = pickColumn(columns, ["payment_id", "id"]);
  const amountColumn = pickColumn(columns, ["amount", "payment_amount", "paid_amount", "total_amount"]);
  const statusColumn = pickColumn(columns, ["status", "payment_status", "verification_status"]);
  const methodColumn = pickColumn(columns, ["payment_method", "payment_method_name", "method", "payment_type", "source"]);
  const referenceColumn = pickColumn(columns, ["reference", "reference_no", "payment_reference", "transaction_id", "stripe_payment_intent_id"]);
  const invoiceIdColumn = pickColumn(columns, ["invoice_invoice_id", "invoice_id", "invoiceId"]);
  const customerIdColumn = pickColumn(columns, ["customer_id", "customerId"]);
  const dateColumn = pickColumn(columns, ["paid_at", "payment_date", "paid_date", "created_at", "createdAt"]);
  const updatedAtColumn = pickColumn(columns, ["updated_at", "updatedAt", "created_at", "createdAt", "payment_date"]);
  const updatedByColumn = pickColumn(columns, ["updated_by_name", "verified_by_name", "user_name"]);
  const updatedByIdColumn = pickColumn(columns, ["updated_by", "verified_by", "user_id", "admin_id"]);
  const reviewStatusColumn = pickColumn(columns, ["review_status", "verification_status"]);
  const submittedAtColumn = pickColumn(columns, ["submitted_at", "created_at", "payment_date_input", "payment_date"]);

  return {
    table: paymentTable,
    alias,
    idExpr: columnExpression(alias, idColumn),
    amountExpr: coalesceExpression([columnExpression(alias, amountColumn)], "0"),
    statusExpr: columnExpression(alias, statusColumn),
    methodExpr: columnExpression(alias, methodColumn),
    referenceExpr: coalesceExpression(
      [
        columnExpression(alias, referenceColumn),
        idColumn ? `CONCAT('PAY-', ${columnExpression(alias, idColumn)})` : null
      ],
      "NULL"
    ),
    invoiceIdExpr: columnExpression(alias, invoiceIdColumn),
    customerIdExpr: columnExpression(alias, customerIdColumn),
    dateExpr: columnExpression(alias, dateColumn),
    updatedAtExpr: columnExpression(alias, updatedAtColumn),
    updatedByExpr: columnExpression(alias, updatedByColumn),
    updatedByIdExpr: columnExpression(alias, updatedByIdColumn),
    reviewStatusExpr: columnExpression(alias, reviewStatusColumn),
    submittedAtExpr: columnExpression(alias, submittedAtColumn)
  };
}

function successfulPaymentSql(statusExpr) {
  return statusExpr
    ? `LOWER(${statusExpr}) IN ('paid', 'completed', 'success', 'successful', 'verified')`
    : "1 = 1";
}

function refundedPaymentSql(statusExpr) {
  return statusExpr
    ? `LOWER(${statusExpr}) IN ('refunded', 'refund', 'reversed', 'reversal', 'chargeback')`
    : "0 = 1";
}

function pendingPaymentSql(statusExpr) {
  return statusExpr
    ? `LOWER(${statusExpr}) IN ('pending', 'pending verification', 'pending-verification', 'requires verification', 'unverified')`
    : "0 = 1";
}

function bankTransferSql(methodExpr) {
  return methodExpr
    ? `(LOWER(${methodExpr}) LIKE '%bank%' OR LOWER(${methodExpr}) LIKE '%transfer%')`
    : "0 = 1";
}

function stripeSql(methodExpr) {
  return methodExpr ? `LOWER(${methodExpr}) LIKE '%stripe%'` : "0 = 1";
}

async function getPaymentCards(context, paymentContext, rangeConfig, missingTables) {
  const outstandingResult = await safeQuery(
    `SELECT
      SUM(CASE WHEN LOWER(normalizedStatus) IN ('sent', 'viewed', 'overdue') THEN outstandingAmount ELSE 0 END) AS outstandingAmount
     FROM (${invoicePerformanceSubquery(context)}) AS payment_invoice_summary`,
    [],
    [{ outstandingAmount: 0 }]
  );

  if (!paymentContext) {
    return {
      paidTodayAmount: 0,
      outstandingAmount: Number(outstandingResult.rows[0]?.outstandingAmount || 0),
      stripeUpdatesToday: 0,
      bankTransferPendingAmount: 0,
      bankTransferPendingCount: 0
    };
  }

  const paidParams = [];
  const paidDateFilter = rangeWhere(paymentContext.dateExpr, rangeConfig, paidParams);
  const paidWhere = [
    successfulPaymentSql(paymentContext.statusExpr),
    paidDateFilter
  ].filter(Boolean);
  const paidResult = await safeQuery(
    `SELECT SUM(${paymentContext.amountExpr}) AS paidTodayAmount
     FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
     ${paidWhere.length ? `WHERE ${paidWhere.join(" AND ")}` : ""}`,
    paidParams,
    [{ paidTodayAmount: 0 }]
  );

  if (paidResult.missing) missingTables.add(paymentContext.table);

  const stripeParams = [];
  const stripeDateFilter = rangeWhere(paymentContext.updatedAtExpr || paymentContext.dateExpr, rangeConfig, stripeParams);
  const stripeWhere = [
    stripeSql(paymentContext.methodExpr),
    stripeDateFilter
  ].filter(Boolean);
  const stripeResult = await safeQuery(
    `SELECT COUNT(*) AS stripeUpdatesToday
     FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
     ${stripeWhere.length ? `WHERE ${stripeWhere.join(" AND ")}` : ""}`,
    stripeParams,
    [{ stripeUpdatesToday: 0 }]
  );

  if (stripeResult.missing) missingTables.add(paymentContext.table);

  const bankWhere = [
    bankTransferSql(paymentContext.methodExpr),
    pendingPaymentSql(paymentContext.statusExpr)
  ];
  const bankResult = await safeQuery(
    `SELECT
      SUM(${paymentContext.amountExpr}) AS bankTransferPendingAmount,
      COUNT(*) AS bankTransferPendingCount
     FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
     WHERE ${bankWhere.join(" AND ")}`,
    [],
    [{ bankTransferPendingAmount: 0, bankTransferPendingCount: 0 }]
  );

  if (bankResult.missing) missingTables.add(paymentContext.table);

  return {
    paidTodayAmount: Number(paidResult.rows[0]?.paidTodayAmount || 0),
    outstandingAmount: Number(outstandingResult.rows[0]?.outstandingAmount || 0),
    stripeUpdatesToday: Number(stripeResult.rows[0]?.stripeUpdatesToday || 0),
    bankTransferPendingAmount: Number(bankResult.rows[0]?.bankTransferPendingAmount || 0),
    bankTransferPendingCount: Number(bankResult.rows[0]?.bankTransferPendingCount || 0)
  };
}

async function getPaymentReminderSummaryLogs(rangeConfig, missingTables) {
  const columns = await getTableColumns("reminder_logs");

  if (!columns) {
    missingTables.add("reminder_logs");
    return {
      reminderSummary: {
        scheduled: 0,
        sent: 0,
        pending: 0,
        failed: 0
      },
      emailDeliverySummary: {
        emailSent: 0,
        emailFailed: 0,
        whatsappSent: 0,
        whatsappEnabled: false
      }
    };
  }

  const alias = "reminder_log";
  const statusColumn = pickColumn(columns, ["delivery_status", "status"]);
  const channelColumn = pickColumn(columns, ["delivery_channel", "channel"]);
  const sentAtColumn = pickColumn(columns, ["sent_at", "created_at", "createdAt"]);
  const statusExpr = columnExpression(alias, statusColumn);
  const channelExpr = columnExpression(alias, channelColumn);
  const sentAtExpr = columnExpression(alias, sentAtColumn);
  const params = [];
  const dateFilter = rangeWhere(sentAtExpr, rangeConfig, params);
  const where = dateFilter ? `WHERE ${dateFilter}` : "";
  const result = await safeQuery(
    `SELECT
      COUNT(*) AS scheduled,
      SUM(LOWER(${statusExpr}) IN ('sent', 'success', 'successful', 'delivered')) AS sent,
      SUM(LOWER(${statusExpr}) IN ('pending', 'scheduled', 'queued')) AS pending,
      SUM(LOWER(${statusExpr}) = 'failed') AS failed,
      SUM(${channelExpr ? `LOWER(${channelExpr}) = 'email' AND ` : ""}LOWER(${statusExpr}) IN ('sent', 'success', 'successful', 'delivered')) AS emailSent,
      SUM(${channelExpr ? `LOWER(${channelExpr}) = 'email' AND ` : ""}LOWER(${statusExpr}) = 'failed') AS emailFailed,
      SUM(${channelExpr ? `LOWER(${channelExpr}) IN ('whatsapp', 'whats app') AND ` : "0 AND "}LOWER(${statusExpr}) IN ('sent', 'success', 'successful', 'delivered')) AS whatsappSent
     FROM reminder_logs AS ${alias}
     ${where}`,
    params,
    [{ scheduled: 0, sent: 0, pending: 0, failed: 0, emailSent: 0, emailFailed: 0, whatsappSent: 0 }]
  );

  if (result.missing) missingTables.add("reminder_logs");

  const settingsColumns = await getTableColumns("reminder_settings");
  const whatsappEnabledColumn = pickColumn(settingsColumns, ["whatsapp_enabled"]);
  let whatsappEnabled = false;

  if (settingsColumns && whatsappEnabledColumn) {
    const enabledResult = await safeQuery(
      `SELECT COUNT(*) AS count FROM reminder_settings WHERE ${quoteIdentifier(whatsappEnabledColumn)} = 1`,
      [],
      [{ count: 0 }]
    );
    whatsappEnabled = Number(enabledResult.rows[0]?.count || 0) > 0;
  }

  const row = result.rows[0] || {};
  const whatsappSent = Number(row.whatsappSent || 0);

  return {
    reminderSummary: {
      scheduled: Number(row.scheduled || 0),
      sent: Number(row.sent || 0),
      pending: Number(row.pending || 0),
      failed: Number(row.failed || 0)
    },
    emailDeliverySummary: {
      emailSent: Number(row.emailSent || 0),
      emailFailed: Number(row.emailFailed || 0),
      whatsappSent,
      whatsappEnabled: whatsappEnabled || whatsappSent > 0
    }
  };
}

async function getRecentPaymentUpdates(context, paymentContext, missingTables, options = {}) {
  if (!paymentContext) {
    return options.paginated
      ? { records: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }
      : [];
  }

  const userColumns = await getTableColumns("user");
  const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
  const userNameColumn = pickColumn(userColumns, ["name", "full_name", "username", "email"]);
  const canJoinUser = Boolean(paymentContext.updatedByIdExpr && userIdColumn && userNameColumn);
  const canJoinInvoice = Boolean(paymentContext.invoiceIdExpr);
  const canJoinCustomerDirect = Boolean(paymentContext.customerIdExpr);
  const customerColumns = await getTableColumns("customer");
  const customerIdColumn = pickColumn(customerColumns, ["customer_id", "id"]);
  const customerNameColumn = pickColumn(customerColumns, ["name", "customer_name", "company_name"]);
  const canJoinCustomerFromPayment = Boolean(canJoinCustomerDirect && customerIdColumn && customerNameColumn);
  const updatedByExpr = coalesceExpression(
    [
      paymentContext.updatedByExpr,
      canJoinUser ? columnExpression("payment_user", userNameColumn) : null
    ],
    "'System'"
  );
  const customerNameExpr = coalesceExpression(
    [
      canJoinInvoice ? context.customerNameExpr : null,
      canJoinCustomerFromPayment ? columnExpression("payment_customer", customerNameColumn) : null
    ],
    "NULL"
  );
  const invoiceNoExpr = canJoinInvoice ? context.invoiceNoExpr : "NULL";
  const invoiceIdExpr = canJoinInvoice ? context.idExpr : "NULL";
  const dateExpr = paymentContext.updatedAtExpr || paymentContext.dateExpr;
  const joins = [
    canJoinInvoice ? `LEFT JOIN invoice ON ${paymentContext.invoiceIdExpr} = ${context.idExpr}` : "",
    canJoinInvoice ? context.joinCustomerSql : "",
    canJoinCustomerFromPayment
      ? `LEFT JOIN customer AS payment_customer ON ${paymentContext.customerIdExpr} = payment_customer.${quoteIdentifier(customerIdColumn)}`
      : "",
    canJoinUser
      ? `LEFT JOIN user AS payment_user ON ${paymentContext.updatedByIdExpr} = payment_user.${quoteIdentifier(userIdColumn)}`
      : ""
  ].filter(Boolean).join("\n");

  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const pageSize = options.paginated
    ? Math.max(5, Math.min(100, Number.parseInt(options.pageSize, 10) || 20))
    : 10;
  const offset = options.paginated ? (page - 1) * pageSize : 0;
  const params = [];
  const filters = [];
  const status = String(options.status || "").trim();
  const method = String(options.method || "").trim();
  const keyword = String(options.keyword || "").trim().slice(0, 100);
  if (status && paymentContext.statusExpr) {
    filters.push(`LOWER(${paymentContext.statusExpr}) = LOWER(?)`);
    params.push(status);
  }
  if (method && paymentContext.methodExpr) {
    filters.push(`LOWER(${paymentContext.methodExpr}) LIKE LOWER(?)`);
    params.push(`%${method}%`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(options.dateFrom || "") && dateExpr) {
    filters.push(`${dateExpr} >= ?`);
    params.push(`${options.dateFrom} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(options.dateTo || "") && dateExpr) {
    filters.push(`${dateExpr} < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(`${options.dateTo} 00:00:00`);
  }
  if (keyword) {
    filters.push(`(${paymentContext.referenceExpr} LIKE ? OR ${invoiceNoExpr} LIKE ? OR ${customerNameExpr} LIKE ?)`);
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  let total = 0;
  if (options.paginated) {
    const countResult = await safeQuery(
      `SELECT COUNT(*) AS total
       FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
       ${joins}
       ${where}`,
      params,
      [{ total: 0 }]
    );
    total = Number(countResult.rows[0]?.total || 0);
  }

  const result = await safeQuery(
    `SELECT
      ${paymentContext.idExpr || paymentContext.referenceExpr} AS id,
      ${dateExpr || "NULL"} AS date,
      ${paymentContext.referenceExpr} AS reference,
      ${canJoinCustomerFromPayment ? paymentContext.customerIdExpr : "NULL"} AS customerId,
      ${customerNameExpr} AS customerName,
      ${invoiceIdExpr} AS invoiceId,
      ${invoiceNoExpr} AS invoiceNo,
      ${paymentContext.methodExpr || "NULL"} AS paymentMethod,
      ${paymentContext.statusExpr || "NULL"} AS status,
      ${paymentContext.amountExpr} AS amount,
      ${updatedByExpr} AS updatedBy
     FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
     ${joins}
     ${where}
     ORDER BY ${dateExpr || paymentContext.idExpr || paymentContext.referenceExpr} DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
    []
  );

  if (result.missing) missingTables.add(paymentContext.table);

  const records = result.rows.map((row) => ({
    id: row.id,
    date: row.date,
    reference: row.reference,
    customerId: row.customerId,
    customerName: row.customerName,
    invoiceId: row.invoiceId,
    invoiceNo: row.invoiceNo,
    paymentMethod: row.paymentMethod,
    status: row.status,
    amount: Number(row.amount || 0),
    updatedBy: row.updatedBy || "System"
  }));

  return options.paginated
    ? {
      records,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    }
    : records;
}

async function getAdminPaymentUpdatesData(options = {}) {
  const missingTables = new Set();
  const context = await getInvoicePerformanceContext(missingTables);
  if (!context) {
    return { records: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, missingTables: Array.from(missingTables) };
  }
  const paymentContext = await getPaymentTableContext(missingTables);
  const result = await getRecentPaymentUpdates(context, paymentContext, missingTables, { ...options, paginated: true });
  return { ...result, missingTables: Array.from(missingTables) };
}

function emptyPaymentReminderSummary(range, missingTables = []) {
  return {
    range: normalizePaymentReminderRange(range),
    paymentCards: {
      paidTodayAmount: 0,
      outstandingAmount: 0,
      stripeUpdatesToday: 0,
      bankTransferPendingAmount: 0,
      bankTransferPendingCount: 0
    },
    reminderSummary: {
      sentToday: 0,
      scheduledToday: 0,
      failedToday: 0,
      overdueRequiringReminders: 0,
      timeZone: "Asia/Singapore",
      details: {
        sentToday: [],
        scheduledToday: [],
        failedToday: [],
        overdueRequiringReminders: []
      }
    },
    emailDeliverySummary: {
      successfulToday: 0,
      failedToday: 0,
      pendingDelivery: 0,
      deliveryRate: 0
    },
    recentPaymentUpdates: [],
    missingTables
  };
}

async function getPaymentReminderSummaryData(range) {
  const rangeConfig = getPaymentReminderRangeConfig(range);
  const missingTables = new Set();
  const context = await getInvoicePerformanceContext(missingTables);

  if (!context) {
    return emptyPaymentReminderSummary(rangeConfig.range, Array.from(missingTables));
  }

  const paymentContext = await getPaymentTableContext(missingTables);
  const paymentCards = await getPaymentCards(context, paymentContext, rangeConfig, missingTables);
  await getPaymentReminderSummaryLogs(rangeConfig, missingTables);
  const reminderMonitor = await getAdminReminderMonitorData();
  const emailDelivery = await getAdminEmailDeliveryData();
  const recentPaymentUpdates = await getRecentPaymentUpdates(context, paymentContext, missingTables);

  return {
    range: rangeConfig.range,
    paymentCards,
    reminderSummary: {
      ...reminderMonitor.counts,
      timeZone: reminderMonitor.timeZone,
      details: reminderMonitor.details
    },
    emailDeliverySummary: emailDelivery.summary,
    recentPaymentUpdates,
    missingTables: Array.from(missingTables)
  };
}

function emptyInvoicePerformance(range) {
  const statuses = dashboardInvoiceStatuses.map((status) => ({
    status,
    count: 0,
    percentage: 0
  }));

  return {
    range: normalizeRange(range),
    invoiceStatus: {
      total: 0,
      statuses
    },
    invoiceActivityTrend: [],
    activityGrouping: "day",
    revenueTrend: [],
    paidVsOverdue: {
      paidCount: 0,
      paidAmount: 0,
      overdueCount: 0,
      overdueAmount: 0
    },
    documentGeneration: {
      pdfGenerated: 0,
      pdfGeneratedPercentage: 0,
      excelGenerated: 0,
      excelGeneratedPercentage: 0
    },
    recentStatusChangeSummary: [],
    recentStatusChanges: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
  };
}

async function getInvoicePerformanceContext(missingTables) {
  const invoiceColumns = await getTableColumns("invoice");

  if (!invoiceColumns) {
    missingTables.add("invoice");
    return null;
  }

  const customerColumns = await getTableColumns("customer");
  if (!customerColumns) missingTables.add("customer");

  const context = buildInvoiceContext(invoiceColumns, customerColumns);
  if (!context) {
    missingTables.add("invoice");
    return null;
  }

  const auditColumns = await getTableColumns("audit_logs");
  const affectedRecordColumn = pickColumn(auditColumns, ["affected_record", "entity_id"]);
  const actionColumn = pickColumn(auditColumns, ["action_description", "action"]);
  const auditCreatedAtColumn = pickColumn(auditColumns, ["created_at", "createdAt"]);
  const sentAtExpr = affectedRecordColumn && actionColumn && auditCreatedAtColumn
    ? `(SELECT MIN(invoice_sent_log.${quoteIdentifier(auditCreatedAtColumn)})
        FROM audit_logs AS invoice_sent_log
        WHERE CAST(invoice_sent_log.${quoteIdentifier(affectedRecordColumn)} AS UNSIGNED) = ${context.idExpr}
          AND invoice_sent_log.${quoteIdentifier(actionColumn)} IN ('invoice_sent', 'scheduled_invoice_sent'))`
    : null;

  return {
    ...context,
    sentAtExpr,
    // Imported issue dates can be historical. Report ranges should describe
    // when the invoice entered this workflow, preferring its actual send date.
    performanceDateExpr: coalesceExpression(
      [sentAtExpr, context.createdAtExpr, context.issueDateExpr, context.updatedAtExpr, context.sortExpr],
      "NULL"
    )
  };
}

async function getFailedInvoiceEmailCount(missingTables) {
  const columns = await getTableColumns("audit_logs");
  const actionColumn = pickColumn(columns, ["action_description", "action"]);
  if (!actionColumn) {
    missingTables.add("invoice email audit");
    return { count: 0, available: false };
  }
  const result = await safeQuery(
    `SELECT COUNT(*) AS count FROM audit_logs
     WHERE LOWER(${columnExpression("audit_logs", actionColumn)}) = 'invoice_email_failed'`,
    [],
    [{ count: 0 }]
  );
  return { count: Number(result.rows[0]?.count || 0), available: !result.missing };
}

async function getRemindersDueTodayCount(missingTables) {
  const invoiceColumns = await getTableColumns("invoice");
  if (!invoiceColumns) {
    missingTables.add("invoice");
    return { count: 0, available: false };
  }
  const dueDateColumn = pickColumn(invoiceColumns, ["due_date", "dueDate"]);
  const statusColumn = pickColumn(invoiceColumns, ["status", "invoice_status"]);
  if (!dueDateColumn || !statusColumn) return { count: 0, available: false };
  const result = await safeQuery(
    `SELECT COUNT(*) AS count FROM invoice
     WHERE DATE(${quoteIdentifier(dueDateColumn)}) = CURDATE()
       AND LOWER(${quoteIdentifier(statusColumn)}) NOT IN ('draft', 'scheduled', 'paid', 'void', 'cancelled', 'canceled', 'refunded')`,
    [],
    [{ count: 0 }]
  );
  return { count: Number(result.rows[0]?.count || 0), available: !result.missing };
}

function invoicePerformanceSubquery(context) {
  return `SELECT
      ${context.idExpr} AS invoiceId,
      ${context.invoiceNoExpr} AS invoiceNo,
      ${context.customerNameExpr} AS customerName,
      ${context.normalizedStatusExpr} AS normalizedStatus,
      ${context.totalAmountExpr} AS totalAmount,
      ${context.outstandingAmountExpr} AS outstandingAmount,
      ${context.dueDateExpr || "NULL"} AS dueDate,
      ${context.sentAtExpr || "NULL"} AS sentAt,
      ${context.performanceDateExpr || "NULL"} AS performanceDate
    FROM invoice
    ${context.joinCustomerSql}
    ${context.validInvoiceFilters?.length ? `WHERE ${context.validInvoiceFilters.join(" AND ")}` : ""}`;
}

async function getInvoiceStatusPerformance(context, rangeConfig, missingTables) {
  const params = [];
  const dateFilter = rangeWhere("performanceDate", rangeConfig, params);
  const whereSql = [
    "LOWER(normalizedStatus) IN ('draft', 'sent', 'viewed', 'paid', 'overdue')",
    dateFilter
  ].filter(Boolean).join(" AND ");

  const result = await safeQuery(
    `SELECT normalizedStatus AS status, COUNT(*) AS count
     FROM (${invoicePerformanceSubquery(context)}) AS performance_invoice
     WHERE ${whereSql}
     GROUP BY normalizedStatus
     ORDER BY ${statusOrderSql("normalizedStatus")}`,
    params,
    []
  );

  if (result.missing) missingTables.add("invoice");

  const counts = result.rows.reduce((items, row) => {
    const status = normalizeInvoiceStatus(row.status);
    if (status) items[status] = Number(row.count || 0);
    return items;
  }, {});
  const total = dashboardInvoiceStatuses.reduce((sum, status) => sum + Number(counts[status] || 0), 0);

  return {
    total,
    statuses: dashboardInvoiceStatuses.map((status) => ({
      status,
      count: Number(counts[status] || 0),
      percentage: percentage(counts[status], total)
    }))
  };
}

function periodSql(dateExpression, period) {
  if (period === "hour") {
    return {
      label: `DATE_FORMAT(MIN(${dateExpression}), '%l %p')`,
      key: `DATE_FORMAT(MIN(${dateExpression}), '%Y-%m-%dT%H:00:00')`,
      group: `DATE_FORMAT(${dateExpression}, '%Y-%m-%d %H')`,
      order: `MIN(${dateExpression})`,
      date: `MIN(${dateExpression})`,
      time: `DATE_FORMAT(MIN(${dateExpression}), '%l:%i %p')`
    };
  }

  if (period === "week") {
    return {
      label: `CONCAT('Week ', DATE_FORMAT(MIN(${dateExpression}), '%v %x'))`,
      key: `DATE_FORMAT(DATE_SUB(DATE(MIN(${dateExpression})), INTERVAL WEEKDAY(MIN(${dateExpression})) DAY), '%Y-%m-%d')`,
      group: `YEARWEEK(${dateExpression}, 3)`,
      order: `MIN(${dateExpression})`,
      date: `MIN(${dateExpression})`,
      time: "NULL"
    };
  }

  if (period === "month") {
    return {
      label: `DATE_FORMAT(MIN(${dateExpression}), '%b %Y')`,
      key: `DATE_FORMAT(MIN(${dateExpression}), '%Y-%m-01')`,
      group: `DATE_FORMAT(${dateExpression}, '%Y-%m')`,
      order: `MIN(${dateExpression})`,
      date: `MIN(${dateExpression})`,
      time: "NULL"
    };
  }

  return {
    label: `DATE_FORMAT(MIN(${dateExpression}), '%b %e')`,
    key: `DATE_FORMAT(MIN(${dateExpression}), '%Y-%m-%d')`,
    group: `DATE(${dateExpression})`,
    order: `MIN(${dateExpression})`,
    date: `MIN(${dateExpression})`,
    time: "NULL"
  };
}

async function getPaymentRevenueTrend(rangeConfig, missingTables) {
  const paymentTable = (await getTableColumns("payment")) ? "payment" : (await getTableColumns("payments")) ? "payments" : null;
  if (!paymentTable) return null;

  const columns = await getTableColumns(paymentTable);
  const amountColumn = pickColumn(columns, ["amount", "payment_amount", "paid_amount", "total_amount"]);
  const dateColumn = pickColumn(columns, ["paid_at", "payment_date", "paid_date", "created_at", "createdAt"]);
  const statusColumn = pickColumn(columns, ["status", "payment_status", "verification_status"]);

  if (!amountColumn || !dateColumn) return null;

  const tableAlias = "payment_record";
  const dateExpr = columnExpression(tableAlias, dateColumn);
  const period = periodSql(dateExpr, rangeConfig.period);
  const params = [];
  const dateFilter = rangeWhere(dateExpr, rangeConfig, params);
  const where = [];

  if (statusColumn) {
    where.push(`LOWER(${columnExpression(tableAlias, statusColumn)}) IN ('paid', 'completed', 'success', 'successful', 'verified')`);
  }

  if (dateFilter) where.push(dateFilter);

  const result = await safeQuery(
    `SELECT
      ${period.label} AS period,
      SUM(${columnExpression(tableAlias, amountColumn)}) AS revenue
     FROM ${quoteIdentifier(paymentTable)} AS ${tableAlias}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ${period.group}
     ORDER BY ${period.order} ASC`,
    params,
    []
  );

  if (result.missing) missingTables.add(paymentTable);

  return result.rows.map((row) => ({
    period: row.period,
    revenue: Number(row.revenue || 0)
  }));
}

async function getInvoiceRevenueTrend(context, rangeConfig, missingTables) {
  const params = [];
  const dateFilter = rangeWhere("performanceDate", rangeConfig, params);
  const period = periodSql("performanceDate", rangeConfig.period);
  const where = [
    "LOWER(normalizedStatus) = 'paid'",
    dateFilter
  ].filter(Boolean);

  const result = await safeQuery(
    `SELECT
      ${period.label} AS period,
      SUM(totalAmount) AS revenue
     FROM (${invoicePerformanceSubquery(context)}) AS performance_invoice
     WHERE ${where.join(" AND ")}
     GROUP BY ${period.group}
     ORDER BY ${period.order} ASC`,
    params,
    []
  );

  if (result.missing) missingTables.add("invoice");

  return result.rows.map((row) => ({
    period: row.period,
    revenue: Number(row.revenue || 0)
  }));
}

async function getRevenueTrend(context, rangeConfig, missingTables) {
  const paymentTrend = await getPaymentRevenueTrend(rangeConfig, missingTables);
  if (paymentTrend) return paymentTrend;

  return getInvoiceRevenueTrend(context, rangeConfig, missingTables);
}

async function getPaymentActivityTrend(rangeConfig, missingTables) {
  const paymentContext = await getPaymentTableContext(missingTables);
  if (!paymentContext?.dateExpr || !paymentContext?.amountExpr) return null;

  const period = periodSql(paymentContext.dateExpr, rangeConfig.period);
  const params = [];
  const dateFilter = rangeWhere(paymentContext.dateExpr, rangeConfig, params);
  const where = [
    successfulPaymentSql(paymentContext.statusExpr),
    dateFilter
  ].filter(Boolean);
  const paidCountExpr = paymentContext.invoiceIdExpr
    ? `COUNT(DISTINCT ${paymentContext.invoiceIdExpr})`
    : "COUNT(*)";
  const result = await safeQuery(
    `SELECT
      ${period.label} AS period,
      ${period.key} AS bucketKey,
      ${paidCountExpr} AS paidCount,
      SUM(${paymentContext.amountExpr}) AS paidAmount
     FROM ${quoteIdentifier(paymentContext.table)} AS ${paymentContext.alias}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY ${period.group}
     ORDER BY ${period.order} ASC
     LIMIT 2000`,
    params,
    []
  );

  if (result.missing) {
    missingTables.add(paymentContext.table);
    return null;
  }

  return result.rows.map((row) => ({
    period: row.period,
    bucketKey: row.bucketKey,
    paidCount: Number(row.paidCount || 0),
    paidAmount: Number(row.paidAmount || 0)
  }));
}

async function getStatusActivityTrend(rangeConfig) {
  const candidates = [
    "invoice_status_history",
    "invoice_status_histories",
    "invoice_status_logs",
    "invoice_status_log",
    "invoice_activity"
  ];

  for (const table of candidates) {
    const columns = await getTableColumns(table);
    if (!columns) continue;

    const invoiceIdColumn = pickColumn(columns, ["invoice_id", "invoiceId"]);
    const toStatusColumn = pickColumn(columns, ["to_status", "new_status", "status"]);
    const changedAtColumn = pickColumn(columns, ["changed_at", "created_at", "updated_at", "createdAt"]);
    if (!invoiceIdColumn || !toStatusColumn || !changedAtColumn) continue;

    const alias = "activity_status";
    const dateExpr = columnExpression(alias, changedAtColumn);
    const statusExpr = columnExpression(alias, toStatusColumn);
    const invoiceIdExpr = columnExpression(alias, invoiceIdColumn);
    const period = periodSql(dateExpr, rangeConfig.period);
    const params = [];
    const dateFilter = rangeWhere(dateExpr, rangeConfig, params);
    const where = [
      `LOWER(${statusExpr}) IN ('sent', 'paid')`,
      dateFilter
    ].filter(Boolean);
    const result = await safeQuery(
      `SELECT
        ${period.label} AS period,
        ${period.key} AS bucketKey,
        COUNT(DISTINCT CASE WHEN LOWER(${statusExpr}) = 'sent' THEN ${invoiceIdExpr} END) AS sentCount,
        COUNT(DISTINCT CASE WHEN LOWER(${statusExpr}) = 'paid' THEN ${invoiceIdExpr} END) AS paidCount
       FROM ${quoteIdentifier(table)} AS ${alias}
       WHERE ${where.join(" AND ")}
       GROUP BY ${period.group}
       ORDER BY ${period.order} ASC
       LIMIT 2000`,
      params,
      []
    );

    if (!result.missing) {
      return result.rows.map((row) => ({
        period: row.period,
        bucketKey: row.bucketKey,
        sentCount: Number(row.sentCount || 0),
        paidCount: Number(row.paidCount || 0)
      }));
    }
  }

  return null;
}

async function getInvoiceActivityTrend(context, rangeConfig, missingTables, includeActivityDetails = false) {
  const params = [];
  const dateFilter = rangeWhere("performanceDate", rangeConfig, params);
  const period = periodSql("performanceDate", rangeConfig.period);
  const where = [
    "performanceDate IS NOT NULL",
    dateFilter
  ].filter(Boolean);
  const result = await safeQuery(
    `SELECT
      ${period.label} AS period,
      ${period.key} AS bucketKey,
      ${period.date} AS fullDate,
      ${period.time} AS time,
      COUNT(*) AS invoiceCount,
      COUNT(*) AS createdCount,
      SUM(LOWER(normalizedStatus) IN ('sent', 'viewed', 'paid', 'overdue')) AS sentCount,
      SUM(LOWER(normalizedStatus) = 'paid') AS paidCount,
      SUM(totalAmount) AS invoicedAmount,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'paid' THEN totalAmount ELSE 0 END) AS paidAmount,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'overdue' THEN outstandingAmount ELSE 0 END) AS overdueAmount
     FROM (${invoicePerformanceSubquery(context)}) AS performance_invoice
     WHERE ${where.join(" AND ")}
     GROUP BY ${period.group}
     ORDER BY ${period.order} ASC`,
    params,
    []
  );

  if (result.missing) missingTables.add("invoice");

  const invoicePoints = result.rows.map((row) => ({
    period: row.period,
    bucketKey: row.bucketKey,
    fullDate: row.fullDate,
    time: row.time || null,
    invoiceCount: Number(row.invoiceCount || 0),
    revenue: Number(row.paidAmount || 0),
    createdCount: Number(row.createdCount || 0),
    sentCount: Number(row.sentCount || 0),
    paidCount: Number(row.paidCount || 0),
    invoicedAmount: Number(row.invoicedAmount || 0),
    paidAmount: Number(row.paidAmount || 0),
    overdueAmount: Number(row.overdueAmount || 0)
  }));

  if (!includeActivityDetails) return invoicePoints;

  const [statusPoints, paymentPoints] = await Promise.all([
    getStatusActivityTrend(rangeConfig),
    getPaymentActivityTrend(rangeConfig, missingTables)
  ]);
  const byBucket = new Map(invoicePoints.map((point) => [point.bucketKey, point]));

  if (statusPoints) {
    invoicePoints.forEach((point) => {
      point.sentCount = 0;
      if (!paymentPoints) point.paidCount = 0;
    });
  }
  if (paymentPoints) {
    invoicePoints.forEach((point) => {
      point.paidCount = 0;
      point.paidAmount = 0;
      point.revenue = 0;
    });
  }

  function pointFor(bucketKey, periodLabel) {
    if (!byBucket.has(bucketKey)) {
      byBucket.set(bucketKey, {
        period: periodLabel,
        bucketKey,
        fullDate: bucketKey,
        time: rangeConfig.period === "hour" ? periodLabel : null,
        invoiceCount: 0,
        revenue: 0,
        createdCount: 0,
        sentCount: 0,
        paidCount: 0,
        invoicedAmount: 0,
        paidAmount: 0,
        overdueAmount: 0
      });
    }
    return byBucket.get(bucketKey);
  }

  if (statusPoints) {
    statusPoints.forEach((statusPoint) => {
      const point = pointFor(statusPoint.bucketKey, statusPoint.period);
      point.sentCount = statusPoint.sentCount;
      if (!paymentPoints) point.paidCount = statusPoint.paidCount;
    });
  }

  if (paymentPoints) {
    paymentPoints.forEach((paymentPoint) => {
      const point = pointFor(paymentPoint.bucketKey, paymentPoint.period);
      point.paidCount = paymentPoint.paidCount;
      point.paidAmount = paymentPoint.paidAmount;
      point.revenue = paymentPoint.paidAmount;
    });
  }

  return Array.from(byBucket.values())
    .sort((left, right) => String(left.bucketKey).localeCompare(String(right.bucketKey)))
    .slice(-2000);
}

async function getPaidVsOverdue(context, rangeConfig, missingTables) {
  const params = [];
  const dateFilter = rangeWhere("performanceDate", rangeConfig, params);
  const where = dateFilter ? `WHERE ${dateFilter}` : "";
  const result = await safeQuery(
    `SELECT
      SUM(LOWER(normalizedStatus) = 'paid') AS paidCount,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'paid' THEN totalAmount ELSE 0 END) AS paidAmount,
      SUM(LOWER(normalizedStatus) = 'overdue') AS overdueCount,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'overdue' THEN outstandingAmount ELSE 0 END) AS overdueAmount
     FROM (${invoicePerformanceSubquery(context)}) AS performance_invoice
     ${where}`,
    params,
    [{ paidCount: 0, paidAmount: 0, overdueCount: 0, overdueAmount: 0 }]
  );

  if (result.missing) missingTables.add("invoice");

  const row = result.rows[0] || {};
  return {
    paidCount: Number(row.paidCount || 0),
    paidAmount: Number(row.paidAmount || 0),
    overdueCount: Number(row.overdueCount || 0),
    overdueAmount: Number(row.overdueAmount || 0)
  };
}

async function getDocumentGeneration(rangeConfig, totalInvoices, missingTables, notes) {
  const candidates = [
    "document_generation_logs",
    "invoice_document_generation_logs",
    "invoice_export_logs",
    "invoice_exports",
    "export_logs"
  ];

  for (const table of candidates) {
    const columns = await getTableColumns(table);
    if (!columns) continue;

    const typeColumn = pickColumn(columns, ["document_type", "file_type", "export_type", "format", "type"]);
    const createdAtColumn = pickColumn(columns, ["generated_at", "exported_at", "created_at", "createdAt"]);
    const invoiceScopeColumn = pickColumn(columns, ["entity_type", "source_type", "module", "record_type"]);

    if (!typeColumn) continue;

    const params = [];
    const dateFilter = rangeWhere(createdAtColumn ? columnExpression("document_log", createdAtColumn) : null, rangeConfig, params);
    const where = [
      invoiceScopeColumn
        ? `LOWER(${columnExpression("document_log", invoiceScopeColumn)}) LIKE '%invoice%'`
        : "",
      dateFilter
    ].filter(Boolean);
    const result = await safeQuery(
      `SELECT
        SUM(LOWER(${columnExpression("document_log", typeColumn)}) LIKE '%pdf%') AS pdfGenerated,
        SUM(LOWER(${columnExpression("document_log", typeColumn)}) LIKE '%excel%' OR LOWER(${columnExpression("document_log", typeColumn)}) LIKE '%xlsx%' OR LOWER(${columnExpression("document_log", typeColumn)}) LIKE '%xls%') AS excelGenerated
       FROM ${quoteIdentifier(table)} AS document_log
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
      params,
      [{ pdfGenerated: 0, excelGenerated: 0 }]
    );

    if (result.missing) {
      missingTables.add(table);
      continue;
    }

    const row = result.rows[0] || {};
    const pdfGenerated = Number(row.pdfGenerated || 0);
    const excelGenerated = Number(row.excelGenerated || 0);

    return {
      pdfGenerated,
      pdfGeneratedPercentage: percentage(pdfGenerated, totalInvoices),
      excelGenerated,
      excelGeneratedPercentage: percentage(excelGenerated, totalInvoices)
    };
  }

  notes.push("TODO: Add invoice document generation logs to track PDF and Excel exports.");
  return {
    pdfGenerated: 0,
    pdfGeneratedPercentage: 0,
    excelGenerated: 0,
    excelGeneratedPercentage: 0
  };
}

function statusMovementKey(fromStatus, toStatus) {
  return `${fromStatus} -> ${toStatus}`;
}

function parseStatusMovement(text) {
  const value = String(text || "");

  for (const fromStatus of dashboardInvoiceStatuses) {
    for (const toStatus of dashboardInvoiceStatuses) {
      if (fromStatus === toStatus) continue;

      const pattern = new RegExp(
        `\\b${fromStatus}\\b[\\s\\S]{0,80}(?:to|->|→)[\\s\\S]{0,80}\\b${toStatus}\\b`,
        "i"
      );

      if (pattern.test(value)) {
        return { from: fromStatus, to: toStatus };
      }
    }
  }

  return null;
}

async function getInvoiceLookup(context, invoiceIds) {
  const ids = [...new Set(invoiceIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
  if (!ids.length) return {};

  const placeholders = ids.map(() => "?").join(", ");
  const result = await safeQuery(
    `SELECT
      ${context.idExpr} AS invoiceId,
      ${context.invoiceNoExpr} AS invoiceNo,
      ${context.customerNameExpr} AS customerName,
      ${context.totalAmountExpr} AS amount
     FROM invoice
     ${context.joinCustomerSql}
     WHERE ${context.idExpr} IN (${placeholders})`,
    ids,
    []
  );

  return result.rows.reduce((items, row) => {
    items[String(row.invoiceId)] = {
      invoiceNo: row.invoiceNo,
      customerName: row.customerName,
      amount: Number(row.amount || 0)
    };
    return items;
  }, {});
}

async function getStatusHistoryChanges(context, rangeConfig, missingTables, options = {}) {
  const candidates = [
    "invoice_status_history",
    "invoice_status_histories",
    "invoice_status_logs",
    "invoice_status_log",
    "invoice_activity"
  ];

  for (const table of candidates) {
    const columns = await getTableColumns(table);
    if (!columns) continue;

    const idColumn = pickColumn(columns, ["id", "history_id", "status_history_id", "log_id"]);
    const invoiceIdColumn = pickColumn(columns, ["invoice_id", "invoiceId"]);
    const fromStatusColumn = pickColumn(columns, ["from_status", "old_status", "previous_status"]);
    const toStatusColumn = pickColumn(columns, ["to_status", "new_status", "status"]);
    const changedAtColumn = pickColumn(columns, ["changed_at", "created_at", "updated_at", "createdAt"]);
    const changedByIdColumn = pickColumn(columns, ["changed_by_user_id", "changed_by", "user_id", "admin_id"]);
    const changedByNameColumn = pickColumn(columns, ["changed_by_name", "user_name", "admin_name", "actor_name"]);

    if (!invoiceIdColumn || !fromStatusColumn || !toStatusColumn || !changedAtColumn) continue;

    const userColumns = await getTableColumns("user");
    const userIdColumn = pickColumn(userColumns, ["user_id", "id"]);
    const userNameColumn = pickColumn(userColumns, ["name", "full_name", "username", "email"]);
    const canJoinUser = Boolean(changedByIdColumn && userIdColumn && userNameColumn);
    const historyAlias = "status_history";
    const fromExpr = columnExpression(historyAlias, fromStatusColumn);
    const toExpr = columnExpression(historyAlias, toStatusColumn);
    const changedAtExpr = columnExpression(historyAlias, changedAtColumn);
    const params = [];
    const dateFilter = rangeWhere("changedOn", rangeConfig, params);
    const selectedStatus = normalizeInvoiceStatus(options.status);
    const search = String(options.search || "").trim().slice(0, 100);
    const page = Math.max(1, Math.min(100000, Number.parseInt(options.page, 10) || 1));
    const pageSize = Math.max(5, Math.min(50, Number.parseInt(options.pageSize, 10) || 10));
    const where = [
      "LOWER(fromStatus) IN ('draft', 'sent', 'viewed', 'paid', 'overdue')",
      "LOWER(toStatus) IN ('draft', 'sent', 'viewed', 'paid', 'overdue')",
      "LOWER(fromStatus) <> LOWER(toStatus)",
      dateFilter
    ].filter(Boolean);
    if (selectedStatus) {
      where.push("LOWER(toStatus) = ?");
      params.push(selectedStatus.toLowerCase());
    }
    if (search) {
      where.push("(LOWER(invoiceNo) LIKE ? OR LOWER(customerName) LIKE ?)");
      const searchParam = `%${search.toLowerCase()}%`;
      params.push(searchParam, searchParam);
    }
    const changedByExpr = coalesceExpression(
      [
        canJoinUser ? columnExpression("history_user", userNameColumn) : null,
        columnExpression(historyAlias, changedByNameColumn),
        columnExpression(historyAlias, changedByIdColumn)
      ],
      "'System'"
    );
    const invoiceJoin = `LEFT JOIN invoice ON ${columnExpression(historyAlias, invoiceIdColumn)} = ${context.idExpr}`;
    const userJoin = canJoinUser
      ? `LEFT JOIN user AS history_user ON ${columnExpression(historyAlias, changedByIdColumn)} = history_user.${quoteIdentifier(userIdColumn)}`
      : "";
    const baseQuery = `SELECT
        ${idColumn ? columnExpression(historyAlias, idColumn) : columnExpression(historyAlias, invoiceIdColumn)} AS id,
        ${columnExpression(historyAlias, invoiceIdColumn)} AS invoiceId,
        ${context.invoiceNoExpr} AS invoiceNo,
        ${context.customerNameExpr} AS customerName,
        ${fromExpr} AS fromStatus,
        ${toExpr} AS toStatus,
        ${changedAtExpr} AS changedOn,
        ${context.totalAmountExpr} AS amount,
        ${changedByExpr} AS changedBy
       FROM ${quoteIdentifier(table)} AS ${historyAlias}
       ${invoiceJoin}
       ${context.joinCustomerSql}
       ${userJoin}`;

    const countResult = await safeQuery(
      `SELECT COUNT(*) AS total
       FROM (${baseQuery}) AS status_change
       WHERE ${where.join(" AND ")}`,
      params,
      [{ total: 0 }]
    );
    const detailParams = [...params, pageSize, (page - 1) * pageSize];
    const detailResult = await safeQuery(
      `SELECT *
       FROM (${baseQuery}) AS status_change
       WHERE ${where.join(" AND ")}
       ORDER BY changedOn DESC, id DESC
       LIMIT ? OFFSET ?`,
      detailParams,
      []
    );

    if (detailResult.missing) {
      missingTables.add(table);
      continue;
    }

    const summaryResult = await safeQuery(
      `SELECT fromStatus, toStatus, COUNT(*) AS count
       FROM (${baseQuery}) AS status_change
       WHERE ${where.join(" AND ")}
       GROUP BY fromStatus, toStatus
       ORDER BY count DESC, fromStatus, toStatus
       LIMIT 6`,
      params,
      []
    );

    const recentStatusChanges = detailResult.rows
      .map((row) => {
        const fromStatus = normalizeInvoiceStatus(row.fromStatus);
        const toStatus = normalizeInvoiceStatus(row.toStatus);
        if (!fromStatus || !toStatus || fromStatus === toStatus) return null;

        return {
          id: row.id,
          invoiceId: row.invoiceId,
          invoiceNo: row.invoiceNo,
          customerName: row.customerName,
          fromStatus,
          toStatus,
          changedOn: row.changedOn,
          amount: Number(row.amount || 0),
          changedBy: row.changedBy || "System"
        };
      })
      .filter(Boolean);

    const recentStatusChangeSummary = summaryResult.rows
      .map((row) => {
        const fromStatus = normalizeInvoiceStatus(row.fromStatus);
        const toStatus = normalizeInvoiceStatus(row.toStatus);
        if (!fromStatus || !toStatus || fromStatus === toStatus) return null;

        return {
          from: fromStatus,
          to: toStatus,
          count: Number(row.count || 0)
        };
      })
      .filter(Boolean);

    const total = Number(countResult.rows[0]?.total || 0);
    return {
      recentStatusChangeSummary,
      recentStatusChanges,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  return null;
}

async function getAuditStatusChanges(context, rangeConfig, missingTables, notes, options = {}) {
  const auditColumns = await getTableColumns("audit_logs");
  const legacyAuditColumns = auditColumns ? null : await getTableColumns("audit_log");
  const table = auditColumns ? "audit_logs" : legacyAuditColumns ? "audit_log" : null;
  const columns = auditColumns || legacyAuditColumns;

  if (!table || !columns) {
    notes.push("TODO: Add invoice status history or audit logs for status movement tracking.");
    return {
      recentStatusChangeSummary: [],
      recentStatusChanges: []
    };
  }

  const isModern = table === "audit_logs";
  const idColumn = pickColumn(columns, isModern ? ["audit_log_id", "id"] : ["log_id", "id"]);
  const actionColumn = pickColumn(columns, isModern ? ["action_description", "action"] : ["action"]);
  const activityColumn = pickColumn(columns, isModern ? ["activity_type", "entity_type"] : ["entity_type"]);
  const recordColumn = pickColumn(columns, isModern ? ["affected_record", "entity_id"] : ["entity_id"]);
  const userNameColumn = pickColumn(columns, isModern ? ["user_name"] : []);
  const userIdColumn = pickColumn(columns, isModern ? ["user_id"] : ["user_user_id"]);
  const createdAtColumn = pickColumn(columns, ["created_at", "createdAt"]);

  if (!actionColumn || !createdAtColumn) {
    notes.push("TODO: Add from/to status fields to invoice status history for status movement tracking.");
    return {
      recentStatusChangeSummary: [],
      recentStatusChanges: []
    };
  }

  const userColumns = await getTableColumns("user");
  const userTableIdColumn = pickColumn(userColumns, ["user_id", "id"]);
  const userTableNameColumn = pickColumn(userColumns, ["name", "full_name", "username", "email"]);
  const canJoinUser = Boolean(userIdColumn && userTableIdColumn && userTableNameColumn);
  const auditAlias = "invoice_audit";
  const createdAtExpr = columnExpression(auditAlias, createdAtColumn);
  const params = [];
  const dateFilter = rangeWhere(createdAtExpr, rangeConfig, params);
  const activityFilter = activityColumn
    ? `LOWER(${columnExpression(auditAlias, activityColumn)}) LIKE '%invoice%'`
    : "";
  const where = [
    activityFilter,
    `LOWER(${columnExpression(auditAlias, actionColumn)}) LIKE '%status%'`,
    dateFilter
  ].filter(Boolean);
  const changedByExpr = coalesceExpression(
    [
      columnExpression(auditAlias, userNameColumn),
      canJoinUser ? columnExpression("audit_user", userTableNameColumn) : null
    ],
    "'System'"
  );
  const userJoin = canJoinUser
    ? `LEFT JOIN user AS audit_user ON ${columnExpression(auditAlias, userIdColumn)} = audit_user.${quoteIdentifier(userTableIdColumn)}`
    : "";
  const result = await safeQuery(
    `SELECT
      ${idColumn ? columnExpression(auditAlias, idColumn) : "0"} AS id,
      ${columnExpression(auditAlias, actionColumn)} AS actionDescription,
      ${recordColumn ? columnExpression(auditAlias, recordColumn) : "NULL"} AS affectedRecord,
      ${changedByExpr} AS changedBy,
      ${createdAtExpr} AS changedOn
     FROM ${quoteIdentifier(table)} AS ${auditAlias}
     ${userJoin}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${createdAtExpr} DESC
     LIMIT 200`,
    params,
    []
  );

  if (result.missing) missingTables.add(table);

  const parsedRows = result.rows
    .map((row) => {
      const movement = parseStatusMovement(row.actionDescription);
      if (!movement) return null;

      return {
        id: row.id,
        invoiceId: Number.isFinite(Number(row.affectedRecord)) ? Number(row.affectedRecord) : null,
        affectedRecord: row.affectedRecord,
        fromStatus: movement.from,
        toStatus: movement.to,
        changedOn: row.changedOn,
        changedBy: row.changedBy || "System"
      };
    })
    .filter(Boolean);
  const invoiceLookup = await getInvoiceLookup(
    context,
    parsedRows.map((row) => row.invoiceId).filter(Boolean)
  );
  const summaryMap = parsedRows.reduce((items, row) => {
    const key = statusMovementKey(row.fromStatus, row.toStatus);
    items[key] = items[key] || { from: row.fromStatus, to: row.toStatus, count: 0 };
    items[key].count += 1;
    return items;
  }, {});

  const selectedStatus = normalizeInvoiceStatus(options.status);
  const search = String(options.search || "").trim().toLowerCase().slice(0, 100);
  const page = Math.max(1, Math.min(100000, Number.parseInt(options.page, 10) || 1));
  const pageSize = Math.max(5, Math.min(50, Number.parseInt(options.pageSize, 10) || 10));
  const filteredRows = parsedRows.filter((row) => {
    if (selectedStatus && row.toStatus !== selectedStatus) return false;
    if (!search) return true;
    const invoice = invoiceLookup[String(row.invoiceId)] || {};
    return String(invoice.invoiceNo || row.affectedRecord || "").toLowerCase().includes(search)
      || String(invoice.customerName || "").toLowerCase().includes(search);
  });
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  return {
    recentStatusChangeSummary: Object.values(summaryMap)
      .sort((first, second) => second.count - first.count)
      .slice(0, 6),
    recentStatusChanges: pageRows.map((row) => {
      const invoice = invoiceLookup[String(row.invoiceId)] || {};

      return {
        id: row.id,
        invoiceId: row.invoiceId,
        invoiceNo: invoice.invoiceNo || row.affectedRecord || "-",
        customerName: invoice.customerName || "-",
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        changedOn: row.changedOn,
        amount: Number(invoice.amount || 0),
        changedBy: row.changedBy
      };
    }),
    pagination: {
      page,
      pageSize,
      total: filteredRows.length,
      totalPages: Math.max(1, Math.ceil(filteredRows.length / pageSize))
    }
  };
}

async function getStatusChanges(context, rangeConfig, missingTables, notes, options = {}) {
  const historyChanges = await getStatusHistoryChanges(context, rangeConfig, missingTables, options);
  if (historyChanges) return historyChanges;

  return getAuditStatusChanges(context, rangeConfig, missingTables, notes, options);
}

async function getInvoicePerformanceData(range, options = {}) {
  const rangeConfig = getRangeConfig(range, options);
  const missingTables = new Set();
  const notes = [];
  const context = await getInvoicePerformanceContext(missingTables);

  if (!context) {
    return emptyInvoicePerformance(rangeConfig.range);
  }

  const allowedSections = new Set(["all", "status", "activity", "paid-vs-overdue", "status-changes"]);
  const requestedSection = String(options.section || "all").toLowerCase();
  const section = allowedSections.has(requestedSection) ? requestedSection : "all";
  const wants = (name) => section === "all" || section === name;
  const invoiceStatus = wants("status")
    ? await getInvoiceStatusPerformance(context, rangeConfig, missingTables)
    : undefined;
  const includeActivityDetails = String(options.activityDetails || "").toLowerCase() === "true";
  const invoiceActivityTrend = wants("activity")
    ? await getInvoiceActivityTrend(context, rangeConfig, missingTables, includeActivityDetails)
    : undefined;
  const revenueTrend = invoiceActivityTrend?.map((item) => ({
    period: item.period,
    fullDate: item.fullDate,
    time: item.time,
    revenue: item.revenue,
    invoiceCount: item.invoiceCount
  }));
  const paidVsOverdue = wants("paid-vs-overdue")
    ? await getPaidVsOverdue(context, rangeConfig, missingTables)
    : undefined;
  const documentGeneration = String(options.includeDocuments || "").toLowerCase() === "true"
    ? await getDocumentGeneration(rangeConfig, invoiceStatus?.total || 0, missingTables, notes)
    : undefined;
  const statusChanges = wants("status-changes")
    ? await getStatusChanges(context, rangeConfig, missingTables, notes, options)
    : undefined;

  return {
    range: rangeConfig.range,
    activityGrouping: rangeConfig.period,
    invoiceStatus,
    invoiceActivityTrend,
    revenueTrend,
    paidVsOverdue,
    documentGeneration,
    recentStatusChangeSummary: statusChanges?.recentStatusChangeSummary,
    recentStatusChanges: statusChanges?.recentStatusChanges,
    pagination: statusChanges?.pagination
  };
}

async function getAdminDashboardData(userId) {
  const missingTables = new Set();
  const admin = await getAdminProfile(userId, missingTables);
  const invoiceOverview = await getInvoiceOverview(missingTables);
  const reminderFailures = await getReminderFailedCount(missingTables);
  const failedInvoiceEmails = await getFailedInvoiceEmailCount(missingTables);
  const remindersDueToday = await getRemindersDueTodayCount(missingTables);
  const paymentsToVerify = await getPaymentsToVerifyCount(missingTables);
  const validationErrors = await getValidationErrorsCount(missingTables);
  const counts = invoiceOverview.counts;
  const todayFocus = [
    validationErrors.count > 0 && {
      type: "validation-errors",
      title: "Validation Errors",
      count: validationErrors.count,
      description: `${validationErrors.count} unresolved invoice upload issue${validationErrors.count === 1 ? "" : "s"} require review.`,
      severity: "Critical",
      priority: 1,
      destination: "validation-errors"
    },
    reminderFailures.count > 0 && {
      type: "reminder-failures",
      title: "Reminder Failed",
      count: reminderFailures.count,
      description: `${reminderFailures.count} reminder${reminderFailures.count === 1 ? "" : "s"} failed to send.`,
      severity: "High",
      priority: 2,
      destination: "payment-reminder-summary"
    },
    paymentsToVerify.count > 0 && {
      type: "payments-to-verify",
      title: "Payments to Verify",
      count: paymentsToVerify.count,
      description: paymentsToVerify.oldestPendingDays === null
        ? "Manual payment proofs are waiting for verification."
        : `Oldest pending proof: ${paymentsToVerify.oldestPendingDays} day${paymentsToVerify.oldestPendingDays === 1 ? "" : "s"}.`,
      severity: "Medium",
      priority: 3,
      destination: "payment-reminder-summary"
    },
    paymentsToVerify.mismatchCount > 0 && {
      type: "payment-mismatch",
      title: "Payment Mismatch",
      count: paymentsToVerify.mismatchCount,
      description: `${paymentsToVerify.mismatchCount} pending payment${paymentsToVerify.mismatchCount === 1 ? " does" : "s do"} not match the remaining invoice balance.`,
      severity: "High",
      priority: 3.5,
      destination: "payment-reminder-summary"
    },
    counts.overdue > 0 && {
      type: "overdue-invoices",
      title: "Overdue Invoices",
      count: counts.overdue,
      amount: counts.overdueOutstandingAmount,
      description: `${counts.overdue} invoice${counts.overdue === 1 ? "" : "s"} are past due with an unpaid balance.`,
      severity: "Medium",
      priority: 4,
      destination: "invoice-performance"
    },
    counts.draft > 0 && {
      type: "draft-invoices",
      title: "Draft Invoices Not Sent",
      count: counts.draft,
      description: `${counts.draft} draft invoice${counts.draft === 1 ? " has" : "s have"} not been sent.`,
      severity: "Low",
      priority: 5,
      destination: "invoice-performance"
    },
    failedInvoiceEmails.count > 0 && {
      type: "failed-email-deliveries",
      title: "Failed Email Deliveries",
      count: failedInvoiceEmails.count,
      description: `${failedInvoiceEmails.count} invoice email${failedInvoiceEmails.count === 1 ? "" : "s"} failed to send.`,
      severity: "High",
      priority: 6,
      destination: "invoice-performance"
    },
    remindersDueToday.count > 0 && {
      type: "reminders-due-today",
      title: "Reminders Due Today",
      count: remindersDueToday.count,
      description: `${remindersDueToday.count} unpaid invoice${remindersDueToday.count === 1 ? " has" : "s have"} a payment reminder due today.`,
      severity: "Low",
      priority: 7,
      destination: "payment-reminder-summary"
    }
  ].filter(Boolean).sort((left, right) => left.priority - right.priority);

  return {
    admin,
    summary: {
      totalInvoices: counts.totalInvoices,
      paidRevenue: counts.paidRevenue,
      outstandingAmount: counts.outstandingAmount,
      overdueInvoices: counts.overdue,
      paymentsToVerify: paymentsToVerify.count,
      validationErrors: validationErrors.count,
      voidInvoices: counts.void
    },
    invoiceStatus: {
      draft: counts.draft,
      sent: counts.sent,
      viewed: counts.viewed,
      paid: counts.paid,
      overdue: counts.overdue,
      void: counts.void
    },
    todayFocus,
    availability: {
      invoices: invoiceOverview.invoiceAvailable,
      payments: invoiceOverview.paymentAvailable && paymentsToVerify.available,
      reminders: reminderFailures.available,
      validation: validationErrors.available
    },
    lastRefreshed: new Date().toISOString()
  };
}

module.exports = {
  getAdminDashboardData,
  getAdminPaymentUpdatesData,
  getInvoicePerformanceData,
  getPaymentReminderSummaryData
};
