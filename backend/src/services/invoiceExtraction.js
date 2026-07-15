function extractInvoiceFields(text = '') {
  const fields = { productName: '', storeName: '', purchaseDate: '', serialNumber: '', warrantyDuration: '', warrantyUnit: '', category: '' };
  const labelled = (labels) => {
    const pattern = labels.join('|');
    const match = text.match(new RegExp(`(?:^|\\n)\\s*(?:${pattern})\\s*[:#-]\\s*([^\\n]+)`, 'i'));
    return match ? match[1].trim().slice(0, 255) : '';
  };
  fields.productName = labelled(['Product Name', 'Product', 'Item']);
  fields.storeName = labelled(['Store', 'Merchant', 'Seller']);
  fields.serialNumber = labelled(['Serial Number', 'Serial No', 'S/N']);
  fields.category = labelled(['Category']);
  const rawDate = labelled(['Purchase Date', 'Invoice Date', 'Date']);
  const dmy = rawDate.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  const iso = rawDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) fields.purchaseDate = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  if (dmy) fields.purchaseDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const warranty = labelled(['Warranty', 'Warranty Period']).match(/(\d+)\s*(day|days|month|months|year|years)/i);
  if (warranty) { fields.warrantyDuration = warranty[1]; fields.warrantyUnit = warranty[2].toLowerCase().replace(/s$/, '') + 's'; }
  return fields;
}
module.exports = { extractInvoiceFields };
