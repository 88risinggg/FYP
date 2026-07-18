const { pool } = require("../config/db");

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
  return date.toISOString().slice(0, 10);
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
    return {
      range: normalized,
      startDate,
      endDate: customEndDate,
      period: "day"
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

function mapStatusCounts(row = {}) {
  return {
    totalInvoices: Number(row.totalInvoices || 0),
    draft: Number(row.draft || 0),
    sent: Number(row.sent || 0),
    viewed: Number(row.viewed || 0),
    paid: Number(row.paid || 0),
    overdue: Number(row.overdue || 0),
    totalRevenue: Number(row.totalRevenue || 0),
    outstandingAmount: Number(row.outstandingAmount || 0)
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
    outstandingAmountExpr,
    dueDateExpr,
    issueDateExpr,
    updatedAtExpr,
    sortExpr,
    normalizedStatusExpr,
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
  const result = await safeQuery(
    "SELECT COUNT(*) AS count FROM reminder_logs WHERE LOWER(delivery_status) = 'failed'",
    [],
    [{ count: 0 }]
  );

  if (result.missing) missingTables.add("reminder_logs");
  return Number(result.rows[0]?.count || 0);
}

async function getPaymentsToVerifyCount(missingTables) {
  const paymentTable = (await getTableColumns("payment")) ? "payment" : (await getTableColumns("payments")) ? "payments" : null;

  if (!paymentTable) {
    missingTables.add("payment");
    return 0;
  }

  const columns = await getTableColumns(paymentTable);
  const statusColumn = pickColumn(columns, ["status", "payment_status", "verification_status"]);

  if (!statusColumn) {
    return 0;
  }

  const statusExpr = columnExpression(paymentTable, statusColumn);
  const result = await safeQuery(
    `SELECT COUNT(*) AS count
     FROM ${quoteIdentifier(paymentTable)} AS ${quoteIdentifier(paymentTable)}
     WHERE LOWER(${statusExpr}) IN ('pending', 'pending verification', 'pending-verification', 'requires verification', 'unverified')`,
    [],
    [{ count: 0 }]
  );

  if (result.missing) missingTables.add(paymentTable);
  return Number(result.rows[0]?.count || 0);
}

async function getValidationErrorsCount(missingTables) {
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
    return Number(result.rows[0]?.count || 0);
  }

  return 0;
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
      summary: mapStatusCounts(),
      upcomingDueInvoices: [],
      recentInvoices: []
    };
  }

  const customerColumns = await getTableColumns("customer");
  if (!customerColumns) missingTables.add("customer");

  const context = buildInvoiceContext(invoiceColumns, customerColumns);

  if (!context) {
    missingTables.add("invoice");
    return {
      summary: mapStatusCounts(),
      upcomingDueInvoices: [],
      recentInvoices: []
    };
  }

  const {
    idExpr,
    invoiceNoExpr,
    totalAmountExpr,
    outstandingAmountExpr,
    dueDateExpr,
    issueDateExpr,
    updatedAtExpr,
    sortExpr,
    normalizedStatusExpr,
    customerNameExpr,
    joinCustomerSql
  } = context;

  const summaryResult = await safeQuery(
    `SELECT
      COUNT(*) AS totalInvoices,
      SUM(LOWER(normalizedStatus) = 'draft') AS draft,
      SUM(LOWER(normalizedStatus) = 'sent') AS sent,
      SUM(LOWER(normalizedStatus) = 'viewed') AS viewed,
      SUM(LOWER(normalizedStatus) = 'paid') AS paid,
      SUM(LOWER(normalizedStatus) = 'overdue') AS overdue,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'paid' THEN totalAmount ELSE 0 END) AS totalRevenue,
      SUM(CASE WHEN LOWER(normalizedStatus) IN ('sent', 'viewed', 'overdue') THEN outstandingAmount ELSE 0 END) AS outstandingAmount
     FROM (
      SELECT
        ${normalizedStatusExpr} AS normalizedStatus,
        ${totalAmountExpr} AS totalAmount,
        ${outstandingAmountExpr} AS outstandingAmount
      FROM invoice
     ) AS dashboard_invoice_summary`,
    [],
    [mapStatusCounts()]
  );

  if (summaryResult.missing) missingTables.add("invoice");

  const upcomingResult = dueDateExpr
    ? await safeQuery(
        `SELECT
          ${idExpr} AS id,
          ${invoiceNoExpr} AS invoiceNo,
          ${customerNameExpr} AS customerName,
          ${dueDateExpr} AS dueDate,
          ${totalAmountExpr} AS amount,
          DATEDIFF(${dueDateExpr}, CURDATE()) AS daysLeft,
          ${normalizedStatusExpr} AS status
         FROM invoice
         ${joinCustomerSql}
         WHERE LOWER(${normalizedStatusExpr}) IN ('sent', 'viewed')
           AND ${dueDateExpr} >= CURDATE()
         ORDER BY ${dueDateExpr} ASC, ${idExpr} DESC
         LIMIT 5`,
        [],
        []
      )
    : { rows: [], missing: false };

  if (upcomingResult.missing) missingTables.add("invoice");

  const recentResult = await safeQuery(
    `SELECT
      ${idExpr} AS id,
      ${invoiceNoExpr} AS invoiceNo,
      ${customerNameExpr} AS customerName,
      ${normalizedStatusExpr} AS status,
      ${issueDateExpr || "NULL"} AS issueDate,
      ${dueDateExpr || "NULL"} AS dueDate,
      ${totalAmountExpr} AS amount,
      ${updatedAtExpr || "NULL"} AS updatedAt
     FROM invoice
     ${joinCustomerSql}
     ORDER BY ${sortExpr} DESC
     LIMIT 5`,
    [],
    []
  );

  if (recentResult.missing) missingTables.add("invoice");

  return {
    summary: mapStatusCounts(summaryResult.rows[0]),
    upcomingDueInvoices: upcomingResult.rows.map((row) => ({
      id: row.id,
      invoiceNo: row.invoiceNo,
      customerName: row.customerName,
      dueDate: row.dueDate,
      amount: Number(row.amount || 0),
      daysLeft: Number(row.daysLeft || 0),
      status: normalizeInvoiceStatus(row.status) || row.status
    })),
    recentInvoices: recentResult.rows.map((row) => ({
      id: row.id,
      invoiceNo: row.invoiceNo,
      customerName: row.customerName,
      status: normalizeInvoiceStatus(row.status) || "Draft",
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      amount: Number(row.amount || 0),
      updatedAt: row.updatedAt
    }))
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
  const methodColumn = pickColumn(columns, ["payment_method", "method", "payment_type", "source"]);
  const referenceColumn = pickColumn(columns, ["reference", "reference_no", "payment_reference", "transaction_id", "stripe_payment_intent_id"]);
  const invoiceIdColumn = pickColumn(columns, ["invoice_id", "invoiceId"]);
  const customerIdColumn = pickColumn(columns, ["customer_id", "customerId"]);
  const dateColumn = pickColumn(columns, ["paid_at", "payment_date", "paid_date", "created_at", "createdAt"]);
  const updatedAtColumn = pickColumn(columns, ["updated_at", "updatedAt", "created_at", "createdAt", "payment_date"]);
  const updatedByColumn = pickColumn(columns, ["updated_by_name", "verified_by_name", "user_name"]);
  const updatedByIdColumn = pickColumn(columns, ["updated_by", "verified_by", "user_id", "admin_id"]);

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
    updatedByIdExpr: columnExpression(alias, updatedByIdColumn)
  };
}

function successfulPaymentSql(statusExpr) {
  return statusExpr
    ? `LOWER(${statusExpr}) IN ('paid', 'completed', 'success', 'successful', 'verified')`
    : "1 = 1";
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

async function getRecentPaymentUpdates(context, paymentContext, missingTables) {
  if (!paymentContext) return [];

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
     ORDER BY ${dateExpr || paymentContext.idExpr || paymentContext.referenceExpr} DESC
     LIMIT 10`,
    [],
    []
  );

  if (result.missing) missingTables.add(paymentContext.table);

  return result.rows.map((row) => ({
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
  const reminderData = await getPaymentReminderSummaryLogs(rangeConfig, missingTables);
  const recentPaymentUpdates = await getRecentPaymentUpdates(context, paymentContext, missingTables);

  return {
    range: rangeConfig.range,
    paymentCards,
    reminderSummary: reminderData.reminderSummary,
    emailDeliverySummary: reminderData.emailDeliverySummary,
    recentPaymentUpdates,
    missingTables: Array.from(missingTables)
  };
}

function emptyInvoicePerformance(range, missingTables = []) {
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
    missingTables,
    notes: []
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

  return {
    ...context,
    performanceDateExpr: context.issueDateExpr || context.updatedAtExpr || context.sortExpr
  };
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
      ${context.performanceDateExpr || "NULL"} AS performanceDate
    FROM invoice
    ${context.joinCustomerSql}`;
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
      label: `DATE_FORMAT(${dateExpression}, '%l %p')`,
      group: `DATE_FORMAT(${dateExpression}, '%Y-%m-%d %H')`,
      order: `MIN(${dateExpression})`,
      date: `MIN(${dateExpression})`,
      time: `DATE_FORMAT(MIN(${dateExpression}), '%l:%i %p')`
    };
  }

  if (period === "week") {
    return {
      label: `CONCAT('Week ', DATE_FORMAT(${dateExpression}, '%v %x'))`,
      group: `YEARWEEK(${dateExpression}, 3)`,
      order: `MIN(${dateExpression})`,
      date: `MIN(${dateExpression})`,
      time: "NULL"
    };
  }

  if (period === "month") {
    return {
      label: `DATE_FORMAT(${dateExpression}, '%b %Y')`,
      group: `DATE_FORMAT(${dateExpression}, '%Y-%m')`,
      order: `MIN(${dateExpression})`,
      date: `MIN(${dateExpression})`,
      time: "NULL"
    };
  }

  return {
    label: `DATE_FORMAT(${dateExpression}, '%b %e')`,
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

async function getInvoiceActivityTrend(context, rangeConfig, missingTables) {
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
      ${period.date} AS fullDate,
      ${period.time} AS time,
      COUNT(*) AS invoiceCount,
      SUM(CASE WHEN LOWER(normalizedStatus) = 'paid' THEN totalAmount ELSE 0 END) AS revenue
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
    fullDate: row.fullDate,
    time: row.time || null,
    invoiceCount: Number(row.invoiceCount || 0),
    revenue: Number(row.revenue || 0)
  }));
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

async function getStatusHistoryChanges(context, rangeConfig, missingTables) {
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
    const where = [
      "LOWER(fromStatus) IN ('draft', 'sent', 'viewed', 'paid', 'overdue')",
      "LOWER(toStatus) IN ('draft', 'sent', 'viewed', 'paid', 'overdue')",
      "LOWER(fromStatus) <> LOWER(toStatus)",
      dateFilter
    ].filter(Boolean);
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

    const detailResult = await safeQuery(
      `SELECT *
       FROM (${baseQuery}) AS status_change
       WHERE ${where.join(" AND ")}
       ORDER BY changedOn DESC, id DESC
       LIMIT 10`,
      params,
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

    return {
      recentStatusChangeSummary,
      recentStatusChanges
    };
  }

  return null;
}

async function getAuditStatusChanges(context, rangeConfig, missingTables, notes) {
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

  return {
    recentStatusChangeSummary: Object.values(summaryMap)
      .sort((first, second) => second.count - first.count)
      .slice(0, 6),
    recentStatusChanges: parsedRows.slice(0, 10).map((row) => {
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
    })
  };
}

async function getStatusChanges(context, rangeConfig, missingTables, notes) {
  const historyChanges = await getStatusHistoryChanges(context, rangeConfig, missingTables);
  if (historyChanges) return historyChanges;

  return getAuditStatusChanges(context, rangeConfig, missingTables, notes);
}

async function getInvoicePerformanceData(range, options = {}) {
  const rangeConfig = getRangeConfig(range, options);
  const missingTables = new Set();
  const notes = [];
  const context = await getInvoicePerformanceContext(missingTables);

  if (!context) {
    const empty = emptyInvoicePerformance(rangeConfig.range, Array.from(missingTables));
    return {
      ...empty,
      notes
    };
  }

  const invoiceStatus = await getInvoiceStatusPerformance(context, rangeConfig, missingTables);
  const invoiceActivityTrend = await getInvoiceActivityTrend(context, rangeConfig, missingTables);
  const revenueTrend = invoiceActivityTrend.map((item) => ({
    period: item.period,
    fullDate: item.fullDate,
    time: item.time,
    revenue: item.revenue,
    invoiceCount: item.invoiceCount
  }));
  const paidVsOverdue = await getPaidVsOverdue(context, rangeConfig, missingTables);
  const documentGeneration = await getDocumentGeneration(
    rangeConfig,
    invoiceStatus.total,
    missingTables,
    notes
  );
  const statusChanges = await getStatusChanges(context, rangeConfig, missingTables, notes);

  return {
    range: rangeConfig.range,
    invoiceStatus,
    invoiceActivityTrend,
    revenueTrend,
    paidVsOverdue,
    documentGeneration,
    recentStatusChangeSummary: statusChanges.recentStatusChangeSummary,
    recentStatusChanges: statusChanges.recentStatusChanges,
    missingTables: Array.from(missingTables),
    notes
  };
}

async function getAdminDashboardData(userId) {
  const missingTables = new Set();
  const admin = await getAdminProfile(userId, missingTables);
  const invoiceOverview = await getInvoiceOverview(missingTables);
  const reminderFailed = await getReminderFailedCount(missingTables);
  const paymentsToVerify = await getPaymentsToVerifyCount(missingTables);
  const validationErrors = await getValidationErrorsCount(missingTables);
  const auditEventsToday = await getAuditEventsToday(missingTables);

  return {
    admin,
    currentDateTime: new Date().toISOString(),
    summary: invoiceOverview.summary,
    todayFocus: {
      overdueInvoices: invoiceOverview.summary.overdue,
      reminderFailed,
      draftInvoicesNotSent: invoiceOverview.summary.draft,
      paymentsToVerify,
      validationErrors
    },
    upcomingDueInvoices: invoiceOverview.upcomingDueInvoices,
    recentInvoices: invoiceOverview.recentInvoices,
    notifications: {
      unreadCount: auditEventsToday + invoiceOverview.summary.overdue + reminderFailed
    },
    missingTables: Array.from(missingTables)
  };
}

module.exports = {
  getAdminDashboardData,
  getInvoicePerformanceData,
  getPaymentReminderSummaryData
};
