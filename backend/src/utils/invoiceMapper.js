import { invoices } from "../data.js";

export function normalizePaymentMethod(method = "") {
  const value = method.toLowerCase();
  if (value.includes("stripe") || value.includes("card")) return "Stripe";
  if (value.includes("paynow")) return "PayNow";
  return "Bank transfer";
}

export function normalizeInvoiceStatus(row) {
  const status = `${row.status || ""} ${row.orderStatus || ""}`.toLowerCase();
  if (status.includes("complete") || status.includes("paid")) return "Paid";
  if (status.includes("overdue")) return "Overdue";
  if (status.includes("viewed")) return "Viewed";
  if (status.includes("sent")) return "Sent";
  return "Draft";
}

export function mapVanidayInvoiceRow(row, index) {
  const amount = Number(row.Total_Revenue || row.total_revenue || 0);
  const quantity = Number(row.qty || 1) || 1;
  return {
    id: invoices.length + index + 1,
    invoiceNumber: `INV-${row.OrderID || row.orderId || Date.now()}-${index + 1}`,
    orderId: row.OrderID,
    sellerId: row.seller_id,
    shopTitle: row.shop_title,
    customerId: row.customerId,
    customerName: row.customerName || "Customer",
    customerEmail: row.email || "customer@example.com",
    customerPhone: row.contactNo || "",
    issueDate: row.bookedDate ? new Date(row.bookedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueDate: row.bookedDate ? new Date(row.bookedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: normalizeInvoiceStatus(row),
    paymentMethod: normalizePaymentMethod(row.paymentMethod),
    amount,
    vanidayCommission: Number(row.vanidayCommission || 0),
    vanidayShare: Number(row.vanidayShare || 0),
    salonShare: Number(row.salonshare || 0),
    cashbackFee: Number(row.cashbackFee || 0),
    cashbackDiscount: Number(row.cashbackDiscount || 0),
    items: [{
      description: row.serviceName || row.productType || "Vaniday service booking",
      quantity,
      unitPrice: quantity ? amount / quantity : amount,
      serviceDuration: row.service_duration,
      staffId: row.staffId,
      staffName: row.staffName
    }]
  };
}
