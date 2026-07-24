jest.mock('tesseract.js', () => ({ createWorker: jest.fn() }));
const { createWorker } = require('tesseract.js');
const { recognizeInvoiceText, resetInvoiceOcrWorker } = require('../src/services/invoiceOcr');

describe('bilingual invoice OCR', () => {
  beforeEach(async () => { await resetInvoiceOcrWorker(); jest.clearAllMocks(); });
  it('initializes one Arabic and English worker and preserves Unicode OCR text', async () => {
    const worker = { recognize: jest.fn().mockResolvedValue({ data: { text: 'متجر التقنية\nInvoice' } }), terminate: jest.fn() };
    createWorker.mockResolvedValue(worker);
    await expect(recognizeInvoiceText(Buffer.from('image'))).resolves.toBe('متجر التقنية\nInvoice');
    await expect(recognizeInvoiceText(Buffer.from('image'))).resolves.toBe('متجر التقنية\nInvoice');
    expect(createWorker).toHaveBeenCalledWith('ara+eng');
    expect(worker.recognize).toHaveBeenCalledTimes(2);
  });
});
