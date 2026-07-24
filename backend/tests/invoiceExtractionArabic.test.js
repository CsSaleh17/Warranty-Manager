const { extractInvoiceFields, normalizeInvoiceText } = require('../src/services/invoiceExtraction');

describe('Arabic and bilingual invoice extraction', () => {
  it('normalizes Arabic-Indic and Persian digits without changing Arabic text', () => {
    expect(normalizeInvoiceText('فاتورة ١٥/٠٨/٢٠٢٥ و ۱۲ شهر')).toBe('فاتورة 15/08/2025 و 12 شهر');
  });

  it('extracts labelled Arabic invoice fields and maps a category', () => {
    const fields = extractInvoiceFields(`اسم المتجر: متجر التقنية\nاسم المنتج: آيفون 15 برو 256 جيجابايت\nتاريخ الفاتورة: ١٥/٠٨/٢٠٢٥\nمدة الضمان: ٢٤ شهر\nالرقم التسلسلي: A1B-22/C\nالتصنيف: هواتف ذكية`);
    expect(fields).toEqual({ productName: 'آيفون 15 برو 256 جيجابايت', storeName: 'متجر التقنية', purchaseDate: '2025-08-15', serialNumber: 'A1B-22/C', warrantyDuration: '24', warrantyUnit: 'months', category: 'Smartphones' });
  });

  it('supports separate Arabic label values, month names, and bilingual warranty text', () => {
    const fields = extractInvoiceFields(`المتجر\nشركة المثال\nالمنتج\nLaptop Lenovo IdeaPad 5\nتاريخ الشراء: 15 أغسطس 2025\nWarranty: 2 years\nSerial No: EN-991`);
    expect(fields).toMatchObject({ storeName: 'شركة المثال', productName: 'Laptop Lenovo IdeaPad 5', purchaseDate: '2025-08-15', warrantyDuration: '2', warrantyUnit: 'years', serialNumber: 'EN-991' });
  });

  it('does not use invoice numbers as serial numbers and rejects invalid dates', () => {
    const fields = extractInvoiceFields('رقم الفاتورة: INV-123\nتاريخ الفاتورة: 31/02/2025\nالضمان: سنتان');
    expect(fields.serialNumber).toBe('');
    expect(fields.purchaseDate).toBe('');
    expect(fields).toMatchObject({ warrantyDuration: '2', warrantyUnit: 'years' });
  });

  it('rejects generic product headers and merged receipt metadata', () => {
    const fields = extractInvoiceFields(`Store\nID: 00128 Register No.: 005 Receipt No.: 2814 Date: 15-08-2025 Time: 16:52.45 Receipt Type: SALE\nProduct\nNumber\nDescription\nSamsung Galaxy S25 Ultra 256GB\nQty 1 Price 4999`);
    expect(fields.productName).toBe('Samsung Galaxy S25 Ultra 256GB');
    expect(fields.storeName).toBe('');
  });

  it('selects a clean merchant heading above receipt metadata', () => {
    const fields = extractInvoiceFields(`Al Noor Electronics LLC\nID: 00128 Register No.: 005 Receipt No.: 2814\nItem\nApple iPhone 15 Pro 256GB\nQty 1`);
    expect(fields.storeName).toBe('Al Noor Electronics LLC');
    expect(fields.productName).toBe('Apple iPhone 15 Pro 256GB');
  });

  it('extracts conservative inline values from a bilingual receipt table', () => {
    const fields = extractInvoiceFields(`Al Mansoura - Riyadh Cashier: 64620\nStore ID: 00128 Register No.: 005 Receipt No.: 2814 Date: 15-08-2025 Time: 16:52.45 Receipt Type: SALE\nItem Number\nQTY\nNB Ideapad Flex 5 I7-13620H 2 in 1\n26-83KX002LAD - Serial # SYX0EXWNF ضمان المصنع - 24 شهر`);
    expect(fields).toMatchObject({ productName: 'NB Ideapad Flex 5 I7-13620H 2 in 1', purchaseDate: '2025-08-15', serialNumber: 'SYX0EXWNF', warrantyDuration: '24', warrantyUnit: 'months', category: 'Laptops', storeName: '' });
  });
});
