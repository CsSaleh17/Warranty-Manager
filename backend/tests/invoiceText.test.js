jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn(),
}));

const { PDFParse } = require('pdf-parse');
const { extractPdfText } = require('../src/services/invoiceText');

describe('PDF invoice text extraction', () => {
  it('uses the installed PDFParse class API and disposes the parser', async () => {
    const parser = { getText: jest.fn().mockResolvedValue({ text: 'Product: Phone' }), destroy: jest.fn().mockResolvedValue() };
    PDFParse.mockImplementation(() => parser);

    await expect(extractPdfText(Buffer.from('%PDF-test'))).resolves.toBe('Product: Phone');
    expect(PDFParse).toHaveBeenCalledWith({ data: expect.any(Buffer) });
    expect(parser.destroy).toHaveBeenCalled();
  });
});
