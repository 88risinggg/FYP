const { calculateInvoiceTax } = require("./invoiceTaxCalculator");

test.each([
  [9, 9, 109],
  [10, 10, 110]
])("calculates tax-exclusive invoices at %s%%", (taxRate, expectedTax, expectedTotal) => {
  expect(calculateInvoiceTax({
    subtotal: 100,
    taxRate,
    taxInclusive: false
  })).toEqual({
    subtotalAmount: 100,
    taxAmount: expectedTax,
    totalAmount: expectedTotal
  });
});

test("extracts inclusive 10% GST without increasing the invoice total", () => {
  expect(calculateInvoiceTax({
    subtotal: 100,
    taxRate: 10,
    taxInclusive: true
  })).toEqual({
    subtotalAmount: 100,
    taxAmount: 9.09,
    totalAmount: 100
  });
});
