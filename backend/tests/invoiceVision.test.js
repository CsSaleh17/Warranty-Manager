jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn(), Type: { OBJECT: 'OBJECT', STRING: 'STRING', INTEGER: 'INTEGER', ARRAY: 'ARRAY' } }));

const { GoogleGenAI } = require('@google/genai');
const { analyzeInvoiceWithGemini } = require('../src/services/invoiceVision');

const validResponse = { text: JSON.stringify({ product_name: 'Phone', store_name: 'Jarir', purchase_date: '2026-01-01', warranty_duration: 12, warranty_unit: 'Months', serial_number: null, category: 'Smartphones', warnings: [] }) };
const providerError = (status) => Object.assign(new Error('provider error'), { status });

describe('Gemini invoice vision', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; jest.clearAllMocks(); });

  it('validates structured fields and rejects unsupported category values', async () => {
    GoogleGenAI.mockImplementation(() => ({ models: { generateContent: jest.fn().mockResolvedValue({ text: JSON.stringify({ product_name: 'Phone', store_name: 'Jarir', purchase_date: '2026-01-01', warranty_duration: 12, warranty_unit: 'Months', serial_number: null, category: 'Not a category', warnings: [] }) }) } }));
    await expect(analyzeInvoiceWithGemini({ buffer: Buffer.from('image'), mimeType: 'image/jpeg' })).resolves.toMatchObject({ productName: 'Phone', category: null, warrantyDuration: 12, warrantyUnit: 'months' });
  });

  it('rejects malformed provider JSON', async () => {
    GoogleGenAI.mockImplementation(() => ({ models: { generateContent: jest.fn().mockResolvedValue({ text: 'not-json' }) } }));
    await expect(analyzeInvoiceWithGemini({ buffer: Buffer.from('image'), mimeType: 'image/jpeg' })).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });

  it('maps a 503 to AI_UNAVAILABLE after two bounded retries', async () => {
    const generateContent = jest.fn().mockRejectedValue(providerError(503));
    GoogleGenAI.mockImplementation(() => ({ models: { generateContent } }));
    await expect(analyzeInvoiceWithGemini({ buffer: Buffer.from('image'), mimeType: 'image/jpeg', retryDelay: () => Promise.resolve() })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('does not retry authentication or invalid request errors', async () => {
    for (const status of [401, 403, 400]) {
      const generateContent = jest.fn().mockRejectedValue(providerError(status));
      GoogleGenAI.mockImplementation(() => ({ models: { generateContent } }));
      await expect(analyzeInvoiceWithGemini({ buffer: Buffer.from('image'), mimeType: 'image/jpeg', retryDelay: () => Promise.resolve() })).rejects.toMatchObject({ code: status === 400 ? 'AI_REQUEST_ERROR' : 'AI_AUTH_ERROR' });
      expect(generateContent).toHaveBeenCalledTimes(1);
    }
  });

  it('returns the successful model after an initial transient failure', async () => {
    const generateContent = jest.fn().mockRejectedValueOnce(providerError(503)).mockResolvedValueOnce(validResponse);
    GoogleGenAI.mockImplementation(() => ({ models: { generateContent } }));
    await expect(analyzeInvoiceWithGemini({ buffer: Buffer.from('image'), mimeType: 'image/jpeg', retryDelay: () => Promise.resolve() })).resolves.toMatchObject({ productName: 'Phone', model: 'gemini-3.5-flash' });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
