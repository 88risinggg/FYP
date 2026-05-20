export const financeCustomers = [
  { id: "CUS-001", name: "Luxe Nails Studio", contact: "Maya Tan", email: "billing@luxenails.sg", terms: "Net 7", status: "Active" },
  { id: "CUS-002", name: "Glow Beauty Bar", contact: "Priya Nair", email: "accounts@glowbeauty.sg", terms: "Net 14", status: "Active" },
  { id: "CUS-003", name: "Urban Spa", contact: "Daniel Lim", email: "finance@urbanspa.sg", terms: "Net 7", status: "Active" },
  { id: "CUS-004", name: "Vaniday Marketplace", contact: "Operations", email: "settlements@vaniday.sg", terms: "Net 30", status: "Active" }
];

export const financeInvoices = [
  {
    id: "INV-2026-0108",
    customerId: "CUS-001",
    customer: "Luxe Nails Studio",
    source: "Vaniday CSV",
    issueDate: "2026-05-18",
    dueDate: "2026-05-25",
    amount: 1240,
    status: "Draft",
    paymentStatus: "Awaiting issue",
    emailStatus: "Not sent",
    pdf: "Not generated",
    items: 12
  },
  {
    id: "INV-2026-0111",
    customerId: "CUS-002",
    customer: "Glow Beauty Bar",
    source: "Manual entry",
    issueDate: "2026-05-17",
    dueDate: "2026-05-31",
    amount: 820.5,
    status: "Issued",
    paymentStatus: "Pending proof",
    emailStatus: "Sent",
    pdf: "Generated",
    items: 7
  },
  {
    id: "INV-2026-0114",
    customerId: "CUS-003",
    customer: "Urban Spa",
    source: "Vaniday CSV",
    issueDate: "2026-05-10",
    dueDate: "2026-05-17",
    amount: 468,
    status: "Overdue",
    paymentStatus: "Pending payment",
    emailStatus: "Reminder sent",
    pdf: "Generated",
    items: 4
  },
  {
    id: "INV-2026-0118",
    customerId: "CUS-004",
    customer: "Vaniday Marketplace",
    source: "Vaniday CSV",
    issueDate: "2026-05-05",
    dueDate: "2026-06-04",
    amount: 3920.75,
    status: "Paid",
    paymentStatus: "Paid",
    emailStatus: "Sent",
    pdf: "Generated",
    items: 38
  }
];

export const financePayments = [
  { id: "PAY-1042", invoiceId: "INV-2026-0108", customer: "Luxe Nails Studio", method: "PayNow", amount: 1240, status: "Pending admin approval", proof: "paynow-proof-1042.png", receivedDate: "2026-05-19" },
  { id: "PAY-1043", invoiceId: "INV-2026-0111", customer: "Glow Beauty Bar", method: "Bank Transfer", amount: 820.5, status: "Pending admin approval", proof: "bank-transfer-1043.pdf", receivedDate: "2026-05-19" },
  { id: "PAY-1044", invoiceId: "INV-2026-0114", customer: "Urban Spa", method: "PayNow", amount: 468, status: "Verified", proof: "paynow-proof-1044.png", receivedDate: "2026-05-18" },
  { id: "PAY-1045", invoiceId: "INV-2026-0118", customer: "Vaniday Marketplace", method: "Stripe", amount: 3920.75, status: "Settled", proof: "stripe-charge-ch_1045", receivedDate: "2026-05-06" }
];

export const financeReports = [
  { id: "RPT-501", name: "Monthly invoice summary", period: "May 2026", format: "PDF", status: "Ready", updatedAt: "Today, 09:05" },
  { id: "RPT-502", name: "Outstanding payments", period: "May 2026", format: "CSV", status: "Ready", updatedAt: "Today, 08:45" },
  { id: "RPT-503", name: "Vaniday commission breakdown", period: "May 2026", format: "Excel", status: "Draft", updatedAt: "Yesterday, 17:10" }
];

export const financeNotifications = [
  { id: "MAIL-7001", invoiceId: "INV-2026-0111", customer: "Glow Beauty Bar", type: "Invoice email", status: "Delivered", sentAt: "2026-05-17 10:04" },
  { id: "MAIL-7002", invoiceId: "INV-2026-0114", customer: "Urban Spa", type: "Overdue reminder", status: "Delivered", sentAt: "2026-05-18 09:00" },
  { id: "MAIL-7003", invoiceId: "INV-2026-0108", customer: "Luxe Nails Studio", type: "Invoice email", status: "Queued", sentAt: "Pending issue" }
];
