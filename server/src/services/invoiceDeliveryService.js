async function sendInvoiceEmail(invoice) {
  // Replace this stub with SendGrid, SES, SMTP, or your existing delivery adapter.
  console.log(
    `Sending invoice ${invoice.invoiceId} to ${invoice.customer_email} for ${invoice.customer_name}`
  );

  return {
    provider: "console",
    deliveredAt: new Date().toISOString()
  };
}

module.exports = {
  sendInvoiceEmail
};
