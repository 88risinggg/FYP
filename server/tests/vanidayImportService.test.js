jest.mock('../src/models/invoiceSettingsModel', () => ({
  getInvoiceSettings: jest.fn().mockResolvedValue({
    vanidayFieldMapping: null,
    displayDateFormat: 'DD/MM/YYYY',
    dueDays: 30
  }),
  defaultSettings: {
    vanidayFieldMapping: null,
    displayDateFormat: 'DD/MM/YYYY',
    dueDays: 30
  },
  reserveNextInvoiceNumber: jest.fn()
}));

jest.mock('../src/config/db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue([[]])
  }
}));

jest.mock('../src/services/fraudDetectionService', () => ({
  assessInvoiceRisk: jest.fn().mockResolvedValue(undefined)
}));

const { validateVanidayImport } = require('../src/services/vanidayImportService');

describe('vaniday import fallback mapping', () => {
  it('derives required Vaniday fields from invoice-style CSV columns', async () => {
    const rows = [{
      invoice_id: 'INV-001',
      invoice_number: 'INV-2026-000001',
      customer_name: 'Alicia Tan',
      company_name: 'Vaniday Pte. Ltd.',
      customer_email: 'alicia@example.com',
      issue_date: '2026-01-10',
      due_date: '2026-02-10',
      amount: '125.00',
      currency: 'SGD',
      total_amount: '125.00',
      payment_method: 'PayNow',
      invoice_status: 'Draft',
      notes: 'Invoice import fallback test'
    }];

    const result = await validateVanidayImport(rows, { dateFormat: 'DD/MM/YYYY' });

    expect(result.success).toBe(true);
    expect(result.validationResults[0].is_valid).toBe(true);
    expect(result.records[0].orderId).toBe('INV-001');
    expect(result.records[0].shopTitle).toBe('Vaniday Pte. Ltd.');
    expect(result.records[0].serviceName).toBe('INV-2026-000001');
    expect(result.records[0].customerName).toBe('Alicia Tan');
    expect(result.records[0].email).toBe('alicia@example.com');
    expect(result.records[0].totalRevenue).toBe('125.00');
  });
});
