const SUCCESSFUL_PAYMENT_STATUSES = ["paid", "completed", "success", "successful", "verified"];
const REFUNDED_PAYMENT_STATUSES = ["refunded", "refund", "reversed", "reversal", "chargeback"];

function currency(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

function deriveInvoicePaymentState({ totalAmount, confirmedPaid, dueDate, fallbackStatus = "Sent" }) {
  const total = Math.max(currency(totalAmount), 0);
  const paid = Math.max(currency(confirmedPaid), 0);
  const outstandingAmount = Math.max(currency(total - paid), 0);

  if (outstandingAmount === 0 && total > 0) {
    return { status: "Paid", confirmedPaid: paid, outstandingAmount };
  }

  const dueTimestamp = dueDate ? new Date(dueDate).getTime() : Number.NaN;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isFinite(dueTimestamp) && dueTimestamp < today.getTime()) {
    return { status: "Overdue", confirmedPaid: paid, outstandingAmount };
  }

  if (paid > 0) {
    // Keep the reporting lifecycle to Draft/Sent/Viewed/Paid/Overdue. A partial
    // payment proves that the customer has interacted with the invoice.
    return { status: "Viewed", confirmedPaid: paid, outstandingAmount };
  }

  const safeFallback = ["Draft", "Scheduled", "Sent", "Viewed", "Overdue"].includes(fallbackStatus)
    ? fallbackStatus
    : "Sent";
  return { status: safeFallback, confirmedPaid: paid, outstandingAmount };
}

async function getConfirmedPaymentTotal(connection, invoiceId) {
  const [rows] = await connection.query(
    `SELECT GREATEST(COALESCE(SUM(CASE
       WHEN LOWER(status) IN (?) THEN amount
       WHEN LOWER(status) IN (?) THEN -ABS(amount)
       ELSE 0 END), 0), 0) AS confirmed_paid
     FROM payment
     WHERE invoice_invoice_id = ?`,
    [SUCCESSFUL_PAYMENT_STATUSES, REFUNDED_PAYMENT_STATUSES, invoiceId]
  );
  return currency(rows[0]?.confirmed_paid);
}

async function settleInvoiceFromConfirmedPayments(connection, invoiceId, fallbackStatus = "Sent") {
  const [invoiceRows] = await connection.query(
    "SELECT total_amount, due_date, status FROM invoice WHERE invoice_id = ? LIMIT 1 FOR UPDATE",
    [invoiceId]
  );
  if (!invoiceRows.length) return null;

  const invoice = invoiceRows[0];
  const confirmedPaid = await getConfirmedPaymentTotal(connection, invoiceId);
  const settlement = deriveInvoicePaymentState({
    totalAmount: invoice.total_amount,
    confirmedPaid,
    dueDate: invoice.due_date,
    fallbackStatus: invoice.status === "Pending Review" ? fallbackStatus : invoice.status
  });

  await connection.query(
    "UPDATE invoice SET status = ?, payment_status = ? WHERE invoice_id = ?",
    [settlement.status, settlement.status === "Paid" ? "paid" : settlement.confirmedPaid > 0 ? "partially_paid" : null, invoiceId]
  );
  return settlement;
}

module.exports = {
  deriveInvoicePaymentState,
  getConfirmedPaymentTotal,
  settleInvoiceFromConfirmedPayments
};
