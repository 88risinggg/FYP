/**
 * EVALUATION HEADER
 * FEATURE: INVOICE - SHARED
 * PURPOSE: Provides reusable invoice Tax Calculator business or integration operations.
 * LAYER: Backend service - contains reusable business rules or external integrations.
 * FIND RELATED CODE: Use Find All References to locate controllers, workers, or services that call it.
 */
function currency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateInvoiceTax({ subtotal, taxRate, taxInclusive = false }) {
  const normalizedSubtotal = currency(subtotal);
  const normalizedRate = Number(taxRate) || 0;
  const taxAmount = taxInclusive
    ? currency(normalizedSubtotal - normalizedSubtotal / (1 + normalizedRate / 100))
    : currency(normalizedSubtotal * (normalizedRate / 100));

  return {
    subtotalAmount: normalizedSubtotal,
    taxAmount,
    totalAmount: taxInclusive
      ? normalizedSubtotal
      : currency(normalizedSubtotal + taxAmount)
  };
}

module.exports = { calculateInvoiceTax };
