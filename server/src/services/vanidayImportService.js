/**
 * Vaniday Import Service
 *
 * Handles the complete flow of importing Vaniday booking CSV/Excel data:
 * 1. Parse uploaded file
 * 2. Map Vaniday fields to system fields using configurable mapping
 * 3. Validate each record (required fields, format, duplicates, conflicts)
 * 4. Match or create customers by email
 * 5. Generate invoices with proper line items
 * 6. Auto-determine payment status from Vaniday data
 *
 * Supports two payment situations:
 * - Situation A: Customer already paid online (Stripe) → auto Paid
 * - Situation B: Customer has not paid → Sent/Unpaid with payment instructions
 */

const { pool } = require("../config/db");
const { getInvoiceSettings, defaultSettings } = require("../models/invoiceSettingsModel");
const { reserveNextInvoiceNumber } = require("../models/invoiceSettingsModel");
const { assessInvoiceRisk } = require("./fraudDetectionService");

// =====================================================
// Default Vaniday Field Mapping
// =====================================================

const DEFAULT_VANIDAY_MAPPING = {
  customerName: "customerName",
  email: "email",
  contactNo: "contactNo",
  customerId: "customerId",
  shopTitle: "shop_title",
  sellerId: "seller_id",
  serviceName: "serviceName",
  bookedDate: "bookedDate",
  serviceDuration: "service_duration",
  staffName: "staffName",
  staffId: "staffId",
  quantity: "qty",
  totalRevenue: "Total_Revenue",
  creditCard: "credit_Card",
  paymentMethod: "paymentMethod",
  orderId: "OrderID",
  status: "status",
  orderStatus: "orderStatus",
  vanidayCommission: "vanidayCommission",
  vanidayShare: "vanidayShare",
  salonShare: "salonshare",
  cashbackDiscount: "cashbackDiscount",
  productType: "productType"
};

// =====================================================
// Field Extraction Helpers
// =====================================================

// Multi-alias lookup: each system field maps to a list of possible CSV column names
// Listed in priority order (first match wins). Case-insensitive.
const FIELD_ALIASES = {
  orderId:         ["orderid", "order_id", "order id", "ordernumber", "order_number", "order number", "id"],
  customerName:    ["customername", "customer_name", "customer name", "name", "client name", "clientname", "buyer"],
  email:           ["email", "customer_email", "customeremail", "email address", "emailaddress"],
  contactNo:       ["contactno", "contact_no", "contact no", "phone", "mobile", "phonenumber", "phone_number"],
  customerId:      ["customerid", "customer_id", "client_id", "clientid"],
  shopTitle:       ["shoptitle", "shop_title", "shop title", "shop", "merchant", "merchantname", "merchant_name", "salon", "salonname", "salon name", "venue", "location"],
  sellerId:        ["sellerid", "seller_id", "providerid", "provider_id"],
  serviceName:     ["servicename", "service_name", "service name", "service", "product", "item", "description", "booking", "treatment"],
  bookedDate:      ["bookeddate", "booked_date", "booking_date", "bookingdate", "date", "appointment_date", "appointmentdate", "service_date", "servicedate", "invoice_date"],
  serviceDuration: ["serviceduration", "service_duration", "duration", "minutes"],
  staffName:       ["staffname", "staff_name", "staff", "therapist", "stylist", "provider", "employee"],
  staffId:         ["staffid", "staff_id"],
  quantity:        ["qty", "quantity", "count", "units"],
  totalRevenue:    ["total_revenue", "totalrevenue", "total revenue", "revenue", "amount", "total", "total_amount", "totalamount", "price", "total price", "subtotal", "sub_total", "gross", "gross_revenue", "grossrevenue"],
  creditCard:      ["credit_card", "creditcard", "credit card", "card_amount", "cardamount", "online_payment", "onlinepayment", "paid_amount", "paidamount", "stripe", "stripe_amount"],
  paymentMethod:   ["paymentmethod", "payment_method", "payment method", "method", "pay_method"],
  status:          ["status", "booking_status", "bookingstatus"],
  orderStatus:     ["orderstatus", "order_status", "completion_status", "order_completion"],
  vanidayCommission: ["vanidaycommission", "vaniday_commission", "commission", "platform_fee", "platformfee"],
  vanidayShare:    ["vanidayshare", "vaniday_share", "platform_share", "platformshare", "net_revenue", "netrevenue"],
  salonShare:      ["salonshare", "salon_share", "salon share", "merchant_share", "merchantshare", "payout"],
  cashbackDiscount:["cashbackdiscount", "cashback_discount", "cashback", "discount"],
  productType:     ["producttype", "product_type", "type", "category", "service_type", "servicetype"]
};

function getFieldValue(row, mapping, fieldName) {
  const rowKeys = Object.keys(row || {});
  const rowKeysNormalized = rowKeys.map(k => k.replace(/^\uFEFF/, "").trim().toLowerCase());

  const configuredColumn = mapping[fieldName];
  if (configuredColumn) {
    const normalized = configuredColumn.replace(/^\uFEFF/, "").trim().toLowerCase();
    const idx = rowKeysNormalized.indexOf(normalized);
    if (idx !== -1) {
      return String(row[rowKeys[idx]] || "").trim();
    }
  }

  const aliases = FIELD_ALIASES[fieldName] || [];
  for (const alias of aliases) {
    const idx = rowKeysNormalized.indexOf(alias.toLowerCase());
    if (idx !== -1) {
      return String(row[rowKeys[idx]] || "").trim();
    }
  }

  for (const alias of aliases) {
    const idx = rowKeysNormalized.findIndex(k => k.includes(alias.toLowerCase()));
    if (idx !== -1) {
      return String(row[rowKeys[idx]] || "").trim();
    }
  }

  const fallbackMap = {
    orderId: ["invoice_id", "invoiceid", "id"],
    customerName: ["customer_name", "customername", "name"],
    email: ["customer_email", "customeremail", "email"],
    shopTitle: ["company_name", "company", "vendor_name"],
    serviceName: ["invoice_number", "invoice_no", "invoice", "service"],
    totalRevenue: ["amount", "total_amount", "totalamount", "amount_due", "grand_total"]
  };

  for (const fallback of fallbackMap[fieldName] || []) {
    const idx = rowKeysNormalized.indexOf(fallback.toLowerCase());
    if (idx !== -1) {
      return String(row[rowKeys[idx]] || "").trim();
    }
  }

  return "";
}

function parseAmount(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

function parseDate(value, dateFormat = "DD/MM/YYYY") {
  if (!value) return null;
  const str = String(value).trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  // Parse DD/MM/YYYY or D/M/YYYY format
  if (dateFormat === "DD/MM/YYYY" || dateFormat === "D/M/YYYY") {
    const parts = str.split(/[\/\-\s]/);
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (day && month && year) {
        const fullYear = year < 100 ? 2000 + year : year;
        const d = new Date(fullYear, month - 1, day);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
    }
  }

  // Parse MM/DD/YYYY
  if (dateFormat === "MM/DD/YYYY") {
    const parts = str.split(/[\/\-\s]/);
    if (parts.length >= 3) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (day && month && year) {
        const fullYear = year < 100 ? 2000 + year : year;
        const d = new Date(fullYear, month - 1, day);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
    }
  }

  // Fallback: let JS parse it
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function isCompletedOrder(status, orderStatus) {
  const s = String(status || "").toLowerCase().trim();
  const os = String(orderStatus || "").toLowerCase().trim();
  // If neither status field is provided, treat as completed
  if (!s && !os) return true;
  // Accept any of these as "completed"
  const completedValues = ["complete", "completed", "done", "finish", "finished", "success",
    "successful", "paid", "confirmed", "approved", "active", "1", "true", "yes"];
  // Reject only explicitly failed/cancelled orders
  const rejectedValues = ["cancelled", "canceled", "refunded", "failed", "rejected",
    "void", "voided", "expired", "pending_cancel"];
  const combined = [s, os].filter(Boolean);
  // If any field has a rejected value, block it
  if (combined.some(v => rejectedValues.includes(v))) return false;
  // If any field has a completed value, allow it
  if (combined.some(v => completedValues.includes(v))) return true;
  // For any other non-empty status not in rejected list, allow it
  // (e.g. custom statuses from Vaniday like "Complete" already handled above)
  return true;
}

function isAlreadyPaidOnline(paymentMethod, creditCard, totalRevenue) {
  const method = String(paymentMethod || "").toLowerCase().replace(/[\s_]/g, "");
  const paid = parseAmount(creditCard);
  const total = parseAmount(totalRevenue);
  // Online methods that mean the customer already paid
  const onlineMethods = ["stripepayments", "stripe", "creditcard", "credit", "applepay", "googlepay", "paynow", "grabpay", "visa", "mastercard", "amex"];
  const isOnline = onlineMethods.some(m => method.includes(m));
  return isOnline && paid > 0 && total > 0 && Math.abs(paid - total) < 0.01;
}

const SUPPORTED_PAYMENT_METHODS = [
  "stripe_payments", "stripe", "credit_card", "creditcard",
  "bank_transfer", "paynow", "cash", "apple_pay", "google_pay", "grabpay"
];

// =====================================================
// Validation
// =====================================================

function validateRecord(record, index, mapping, dateFormat) {
  const errors = [];
  const row_number = index + 1;

  // Required fields
  if (!record.orderId) errors.push("OrderID is required");
  if (!record.customerName) errors.push("Customer name is required");
  if (!record.email) errors.push("Customer email is required");
  else if (!isValidEmail(record.email)) errors.push("Invalid email format");
  if (!record.shopTitle) errors.push("Shop/service provider is required");
  if (!record.serviceName) errors.push("Service name is required");
  if (!record.totalRevenue || parseAmount(record.totalRevenue) <= 0) {
    // Only fail if the value is truly missing — zero-amount records might be valid (e.g. fully discounted)
    if (!record.totalRevenue) {
      errors.push("Total revenue is required");
    }
    // Note: zero-amount invoices are allowed (e.g. 100% cashback/discount)
  }

  // Format validation
  if (record.contactNo && !/^[\d\s\+\-\(\)]{6,20}$/.test(record.contactNo)) {
    errors.push("Contact number format is invalid");
  }

  // Payment method validation — warn but don't block
  // Any non-empty payment method is accepted; unsupported ones default to "cash"

  // Order status validation (only fail if status is explicitly non-complete)
  if ((record.status || record.orderStatus) && !isCompletedOrder(record.status, record.orderStatus)) {
    errors.push(`Order is not completed (status: ${record.status || "N/A"}, orderStatus: ${record.orderStatus || "N/A"}). Only completed orders can generate invoices.`);
  }

  return { row_number, errors, is_valid: errors.length === 0 };
}

// =====================================================
// Duplicate & Conflict Detection
// =====================================================

function detectDuplicatesAndConflicts(records) {
  const orderGroups = new Map();

  records.forEach((record, index) => {
    if (!record.orderId) return;
    if (!orderGroups.has(record.orderId)) {
      orderGroups.set(record.orderId, []);
    }
    // Preserve the source row number after invalid rows are filtered out.
    orderGroups.get(record.orderId).push({ ...record, _index: record._sourceIndex ?? index });
  });

  const duplicates = []; // exact duplicate rows (skip)
  const conflicts = []; // same OrderID but different data (review required)
  const validGroups = new Map(); // groups to process

  for (const [orderId, group] of orderGroups) {
    if (group.length === 1) {
      validGroups.set(orderId, group);
      continue;
    }

    // Check if all records in the group are exact duplicates
    const fingerprints = group.map(r => `${r.customerName}|${r.email}|${r.serviceName}|${r.bookedDate}|${r.totalRevenue}|${r.shopTitle}|${r.paymentMethod}`);
    const uniqueFingerprints = [...new Set(fingerprints)];

    if (uniqueFingerprints.length === 1) {
      // All identical — keep one, mark rest as duplicates
      validGroups.set(orderId, [group[0]]);
      for (let i = 1; i < group.length; i++) {
        duplicates.push({
          row_number: group[i]._index + 1,
          orderId,
          reason: "Exact duplicate record — skipped"
        });
      }
    } else {
      // Same OrderID but different data — could be multiple line items or a conflict
      // Check if customer + shop are the same (multiple services = OK)
      const customerShopPairs = [...new Set(group.map(r => `${r.email}|${r.shopTitle}`))];
      if (customerShopPairs.length === 1) {
        // Same customer, same shop — treat as multiple line items for one invoice
        validGroups.set(orderId, group);
      } else {
        // Different customer or shop — conflict
        group.forEach(r => {
          conflicts.push({
            row_number: r._index + 1,
            orderId,
            reason: "Same OrderID contains different customer/shop information — review required"
          });
        });
      }
    }
  }

  return { duplicates, conflicts, validGroups };
}

// =====================================================
// Customer Matching / Creation
// =====================================================

async function findOrCreateCustomer(connection, record) {
  const email = record.email.toLowerCase().trim();

  // Search by email
  const [existing] = await connection.query(
    "SELECT customer_id, name, email FROM customer WHERE LOWER(email) = ? LIMIT 1",
    [email]
  );

  if (existing.length > 0) {
    const customer = existing[0];
    // Update phone if changed and available
    if (record.contactNo) {
      try {
        await connection.query(
          "UPDATE customer SET phone = ? WHERE customer_id = ? AND (phone IS NULL OR phone = '')",
          [record.contactNo, customer.customer_id]
        );
      } catch { /* phone column may not exist */ }
    }
    return customer.customer_id;
  }

  // Create new customer
  const [result] = await connection.query(
    `INSERT INTO customer (name, email, address, created_at)
     VALUES (?, ?, ?, NOW())`,
    [
      record.customerName,
      email,
      record.contactNo ? `Phone: ${record.contactNo}` : ""
    ]
  );

  return result.insertId;
}

// =====================================================
// Main Validation Function
// =====================================================

async function validateVanidayImport(rows, options = {}) {
  const settings = (await getInvoiceSettings()) || defaultSettings;
  const mapping = settings.vanidayFieldMapping || DEFAULT_VANIDAY_MAPPING;
  const dateFormat = options.dateFormat || settings.displayDateFormat || "DD/MM/YYYY";

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      success: false,
      message: "File does not contain any records.",
      totalRecords: 0,
      validRecords: 0,
      duplicateRecords: 0,
      conflictRecords: 0,
      invalidRecords: 0,
      readyForInvoice: 0,
      records: [],
      duplicates: [],
      conflicts: [],
      errors: []
    };
  }

  // Step 1: Extract and map fields
  const mappedRecords = rows.map((row, sourceIndex) => ({
    orderId: getFieldValue(row, mapping, "orderId"),
    customerName: getFieldValue(row, mapping, "customerName"),
    email: getFieldValue(row, mapping, "email"),
    contactNo: getFieldValue(row, mapping, "contactNo"),
    customerId: getFieldValue(row, mapping, "customerId"),
    shopTitle: getFieldValue(row, mapping, "shopTitle"),
    sellerId: getFieldValue(row, mapping, "sellerId"),
    serviceName: getFieldValue(row, mapping, "serviceName"),
    bookedDate: getFieldValue(row, mapping, "bookedDate"),
    serviceDuration: getFieldValue(row, mapping, "serviceDuration"),
    staffName: getFieldValue(row, mapping, "staffName"),
    quantity: getFieldValue(row, mapping, "quantity") || "1",
    totalRevenue: getFieldValue(row, mapping, "totalRevenue"),
    creditCard: getFieldValue(row, mapping, "creditCard"),
    paymentMethod: getFieldValue(row, mapping, "paymentMethod"),
    status: getFieldValue(row, mapping, "status"),
    orderStatus: getFieldValue(row, mapping, "orderStatus"),
    vanidayCommission: getFieldValue(row, mapping, "vanidayCommission"),
    vanidayShare: getFieldValue(row, mapping, "vanidayShare"),
    salonShare: getFieldValue(row, mapping, "salonShare"),
    cashbackDiscount: getFieldValue(row, mapping, "cashbackDiscount"),
    productType: getFieldValue(row, mapping, "productType"),
    _rawRow: row,
    _sourceIndex: sourceIndex
  }));

  // Debug: log the first mapped record so we can see what was extracted
  if (mappedRecords.length > 0) {
    const first = mappedRecords[0];
    console.log("[VanidayImport] CSV headers detected:", Object.keys(rows[0]));
    console.log("[VanidayImport] First row mapped:", {
      orderId: first.orderId,
      customerName: first.customerName,
      email: first.email,
      shopTitle: first.shopTitle,
      serviceName: first.serviceName,
      totalRevenue: first.totalRevenue,
      status: first.status,
      orderStatus: first.orderStatus,
      paymentMethod: first.paymentMethod,
    });
  }

  // Step 2: Validate each record
  const validationResults = mappedRecords.map((record, index) =>
    validateRecord(record, index, mapping, dateFormat)
  );

  const invalidRecords = validationResults.filter(r => !r.is_valid);

  // Step 3: Duplicate & conflict detection (only on valid records)
  const validRecordsList = mappedRecords.filter((_, i) => validationResults[i].is_valid);
  const { duplicates, conflicts, validGroups } = detectDuplicatesAndConflicts(validRecordsList);

  // Step 4: Check against existing OrderIDs in database (avoid duplicate imports)
  // If allowReimport is set, skip this check
  const orderIds = [...validGroups.keys()];
  let existingOrderIds = new Set();
  if (orderIds.length > 0 && !options.allowReimport) {
    try {
      const [existingRows] = await pool.query(
        "SELECT DISTINCT vaniday_order_id FROM invoice WHERE vaniday_order_id IN (?) AND invoiceId <> '__SETTINGS__'",
        [orderIds]
      );
      existingOrderIds = new Set(existingRows.map(r => r.vaniday_order_id));
    } catch {
      // vaniday_order_id column may not exist yet — skip duplicate check
      existingOrderIds = new Set();
    }
  }

  // Mark already-imported orders
  const alreadyImported = [];
  for (const orderId of existingOrderIds) {
    if (validGroups.has(orderId)) {
      const group = validGroups.get(orderId);
      group.forEach(r => {
        alreadyImported.push({
          row_number: r._index + 1,
          orderId,
          reason: "Order already imported — skipped"
        });
      });
      validGroups.delete(orderId);
    }
  }

  const readyForInvoice = validGroups.size;

  return {
    success: true,
    message: "",
    totalRecords: rows.length,
    validRecords: validRecordsList.length,
    duplicateRecords: duplicates.length,
    conflictRecords: conflicts.length,
    invalidRecords: invalidRecords.length,
    alreadyImportedCount: alreadyImported.length,
    readyForInvoice,
    records: mappedRecords,
    validationResults,
    duplicates,
    conflicts,
    alreadyImportedList: alreadyImported,
    validGroups,
    errors: invalidRecords.map(r => ({
      row_number: r.row_number,
      errors: r.errors
    }))
  };
}

// =====================================================
// Process Valid Records → Generate Invoices
// =====================================================

async function processVanidayImport(validationResult, userId) {
  const settings = (await getInvoiceSettings()) || defaultSettings;
  const mapping = settings.vanidayFieldMapping || DEFAULT_VANIDAY_MAPPING;
  const dateFormat = settings.displayDateFormat || "DD/MM/YYYY";
  const { validGroups } = validationResult;

  // validGroups can be a Map (from validateVanidayImport) or an array (serialized from controller)
  // Normalize to a Map
  let groupsMap;
  if (validGroups instanceof Map) {
    groupsMap = validGroups;
  } else if (Array.isArray(validGroups)) {
    // Re-validate from records if validGroups was serialized (shouldn't happen, but just in case)
    groupsMap = new Map();
    validGroups.forEach(g => groupsMap.set(g.orderId, [g]));
  } else {
    return { success: false, message: "No valid groups to process.", invoices: [] };
  }

  if (!groupsMap || groupsMap.size === 0) {
    return { success: false, message: "No valid records to process.", invoices: [] };
  }

  const connection = await pool.getConnection();
  const createdInvoices = [];
  const skippedAlreadyImported = [];

  try {
    await connection.beginTransaction();

    for (const [orderId, records] of groupsMap) {
      const primaryRecord = records[0];

      // Validation happens before this transaction, so re-check inside it.  This
      // closes the race where two users submit the same file at the same time.
      const [existingOrder] = await connection.query(
        "SELECT invoice_id FROM invoice WHERE vaniday_order_id = ? LIMIT 1 FOR UPDATE",
        [orderId]
      );
      if (existingOrder.length > 0) {
        skippedAlreadyImported.push(orderId);
        continue;
      }

      // Step 1: Find or create customer by email
      const customerId = await findOrCreateCustomer(connection, primaryRecord);

      // Step 2: Generate invoice number
      const { invoiceId } = await reserveNextInvoiceNumber(connection, new Date());

      // Step 3: Build line items from records (multiple services = multiple items)
      const lineItems = records.map(record => {
        const qty = parseInt(record.quantity, 10) || 1;
        const total = parseAmount(record.totalRevenue);
        const unitPrice = qty > 0 ? Number((total / qty).toFixed(2)) : total;
        const bookedDate = parseDate(record.bookedDate, dateFormat);

        let description = record.serviceName;
        if (record.shopTitle) description += ` (${record.shopTitle})`;
        if (bookedDate) description += ` — ${bookedDate}`;
        if (record.serviceDuration) description += ` [${record.serviceDuration} min]`;
        if (record.staffName) description += ` Staff: ${record.staffName}`;

        return {
          description,
          quantity: qty,
          unit_price: unitPrice,
          amount: total
        };
      });

      const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

      // Step 4: Determine payment status
      const creditCardPaid = parseAmount(primaryRecord.creditCard);
      const alreadyPaidOnline = isAlreadyPaidOnline(
        primaryRecord.paymentMethod,
        primaryRecord.creditCard,
        primaryRecord.totalRevenue
      );
      const invoiceStatus = alreadyPaidOnline ? "Paid" : "Draft";
      const bookedDate = parseDate(primaryRecord.bookedDate, dateFormat) || new Date().toISOString().slice(0, 10);
      const dueDate = new Date(new Date(bookedDate).getTime() + (settings.dueDays || 30) * 86400000).toISOString().slice(0, 10);

      // Step 5: Insert invoice (use core columns first, then try extended columns)
      let invoiceResult;
      try {
        [invoiceResult] = await connection.query(
          `INSERT INTO invoice
            (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at,
             vaniday_order_id, shop_title, seller_id, payment_method, service_provider,
             vaniday_share, salon_share, vaniday_commission)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceStatus,
            bookedDate,
            dueDate,
            invoiceId,
            totalAmount,
            customerId,
            orderId,
            primaryRecord.shopTitle || null,
            primaryRecord.sellerId || null,
            primaryRecord.paymentMethod || null,
            primaryRecord.shopTitle || null,
            parseAmount(primaryRecord.vanidayShare) || null,
            parseAmount(primaryRecord.salonShare) || null,
            parseAmount(primaryRecord.vanidayCommission) || null
          ]
        );
      } catch (extendedColError) {
        // Fallback: insert with core columns only if extended columns don't exist
        [invoiceResult] = await connection.query(
          `INSERT INTO invoice
            (status, issue_date, due_date, invoiceId, total_amount, customer_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [invoiceStatus, bookedDate, dueDate, invoiceId, totalAmount, customerId]
        );
        // Try updating extended columns one by one (best-effort)
        const invPk = invoiceResult.insertId;
        for (const [col, val] of [
          ["vaniday_order_id", orderId],
          ["shop_title", primaryRecord.shopTitle || null],
          ["service_provider", primaryRecord.shopTitle || null],
          ["payment_method", primaryRecord.paymentMethod || null],
        ]) {
          try {
            await connection.query(`UPDATE invoice SET ${col} = ? WHERE invoice_id = ?`, [val, invPk]);
          } catch { /* column doesn't exist — skip */ }
        }
      }

      const invoicePk = invoiceResult.insertId;

      // Step 6: Store line items as JSON.  The workflow migration provides this
      // column; retaining the guarded write lets older installations still
      // complete the core invoice import rather than failing after insertion.
      try {
        await connection.query(
          "UPDATE invoice SET items_json = ? WHERE invoice_id = ?",
          [JSON.stringify(lineItems), invoicePk]
        );
      } catch (error) {
        if (error.code !== "ER_BAD_FIELD_ERROR") throw error;
      }

      // Step 7: Try to insert into invoice_item table too
      try {
        const itemValues = lineItems.map(item => [
          item.description, item.quantity, item.unit_price, item.amount, invoicePk
        ]);
        await connection.query(
          "INSERT INTO invoice_item (description, quantity, unit_price, amount, invoice_invoice_id) VALUES ?",
          [itemValues]
        );
      } catch { /* table may not exist */ }

      // Step 8: If already paid, create payment record
      if (alreadyPaidOnline) {
        try {
          await connection.query(
            `INSERT INTO payment (payment_date, amount, status, transaction_id, invoice_invoice_id, payment_method_name)
             VALUES (?, ?, 'Completed', ?, ?, ?)`,
            [bookedDate, String(creditCardPaid), `VANIDAY-${orderId}`, invoicePk, primaryRecord.paymentMethod || "Stripe"]
          );
          await connection.query(
            "UPDATE invoice SET payment_date = ?, transaction_id = ?, payment_status = 'paid' WHERE invoice_id = ?",
            [bookedDate, `VANIDAY-${orderId}`, invoicePk]
          );
        } catch { /* payment columns may not all exist */ }
      }

      // Persist a fraud assessment with the newly-created invoice.  This is
      // deliberately in the same transaction as the invoice and its customer.
      await assessInvoiceRisk(connection, invoicePk, {
        vendor_name: primaryRecord.shopTitle,
        source: "vaniday_import"
      });

      // Step 9: Audit log
      try {
        await connection.query(
          `INSERT INTO audit_logs (user_id, module, activity_type, action_description, affected_record, status, created_at, previous_value, new_value)
           VALUES (?, 'Invoice', 'invoice', ?, ?, 'Success', NOW(), NULL, ?)`,
          [userId, `vaniday_import:${invoiceStatus}`, String(invoicePk), JSON.stringify({ orderId, shopTitle: primaryRecord.shopTitle, amount: totalAmount })]
        );
      } catch { /* audit_logs may have different schema */ }

      createdInvoices.push({
        invoice_id: invoicePk,
        invoiceId,
        orderId,
        customerName: primaryRecord.customerName,
        customerEmail: primaryRecord.customerEmail,
        shopTitle: primaryRecord.shopTitle,
        totalAmount,
        status: invoiceStatus,
        lineItemCount: lineItems.length
      });
    }

    await connection.commit();

    // Completed Vaniday payments are official paid invoices. Send the customer
    // a payment confirmation after the database transaction is safely committed.
    const paidInvoices = createdInvoices.filter((invoice) => invoice.status === "Paid" && invoice.customerEmail);
    if (paidInvoices.length > 0) {
      try {
        const { sendPaymentReceiptEmail } = require("./invoiceDeliveryService");
        await Promise.allSettled(paidInvoices.map((invoice) => sendPaymentReceiptEmail(
          {
            invoiceId: invoice.invoiceId,
            total_amount: invoice.totalAmount,
            customer_email: invoice.customerEmail
          },
          `VANIDAY-${invoice.orderId}`
        )));
      } catch { /* invoice creation remains committed if notification setup is unavailable */ }
    }

    return {
      success: true,
      message: `Successfully created ${createdInvoices.length} invoice(s) from Vaniday data.`,
      invoices: createdInvoices,
      totalCreated: createdInvoices.length,
      paidCount: createdInvoices.filter(i => i.status === "Paid").length,
      unpaidCount: createdInvoices.filter(i => i.status === "Draft").length,
      skippedAlreadyImported
    };
  } catch (error) {
    await connection.rollback();
    return { success: false, message: `Import failed: ${error.message}`, invoices: [] };
  } finally {
    connection.release();
  }
}

module.exports = {
  DEFAULT_VANIDAY_MAPPING,
  detectDuplicatesAndConflicts,
  findOrCreateCustomer,
  isAlreadyPaidOnline,
  isCompletedOrder,
  parseAmount,
  parseDate,
  processVanidayImport,
  validateVanidayImport
};
