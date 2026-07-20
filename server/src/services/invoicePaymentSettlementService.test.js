const {
  deriveInvoicePaymentState,
  settleInvoiceFromConfirmedPayments
} = require("./invoicePaymentSettlementService");

describe("invoice payment settlement", () => {
  test("a partial payment reduces outstanding without marking the invoice paid", () => {
    expect(deriveInvoicePaymentState({
      totalAmount: 200,
      confirmedPaid: 50,
      dueDate: "2099-01-01",
      fallbackStatus: "Sent"
    })).toEqual({ status: "Viewed", confirmedPaid: 50, outstandingAmount: 150 });
  });

  test("an unpaid balance past its due date remains overdue", () => {
    expect(deriveInvoicePaymentState({
      totalAmount: 100,
      confirmedPaid: 40,
      dueDate: "2020-01-01",
      fallbackStatus: "Sent"
    })).toEqual({ status: "Overdue", confirmedPaid: 40, outstandingAmount: 60 });
  });

  test("confirmed full payment marks the invoice paid", () => {
    expect(deriveInvoicePaymentState({
      totalAmount: 80,
      confirmedPaid: 80,
      dueDate: "2099-01-01",
      fallbackStatus: "Sent"
    })).toEqual({ status: "Paid", confirmedPaid: 80, outstandingAmount: 0 });
  });

  test("settlement persists the calculated status", async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ total_amount: 200, due_date: "2099-01-01", status: "Pending Review" }]])
        .mockResolvedValueOnce([[{ confirmed_paid: 50 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
    };

    const result = await settleInvoiceFromConfirmedPayments(connection, 7, "Sent");

    expect(result).toEqual({ status: "Viewed", confirmedPaid: 50, outstandingAmount: 150 });
    expect(connection.query).toHaveBeenLastCalledWith(
      "UPDATE invoice SET status = ?, payment_status = ? WHERE invoice_id = ?",
      ["Viewed", "partially_paid", 7]
    );
  });
});
