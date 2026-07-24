const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, أبريل: 4, مايو: 5, يونيو: 6, يوليو: 7, اغسطس: 8, أغسطس: 8, سبتمبر: 9, اكتوبر: 10, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12 };
const LABELS = {
  productName: ['Product Name', 'Product', 'Item', 'اسم المنتج', 'المنتج', 'الصنف', 'وصف المنتج', 'وصف الصنف', 'البيان', 'تفاصيل المنتج'],
  storeName: ['Store', 'Merchant', 'Seller', 'اسم المتجر', 'المتجر', 'البائع', 'اسم البائع', 'المورد', 'اسم المورد', 'المنشأة', 'اسم المنشأة', 'الشركة', 'اسم الشركة', 'التاجر'],
  purchaseDate: ['Purchase Date', 'Invoice Date', 'Date', 'تاريخ الشراء', 'تاريخ الفاتورة', 'تاريخ العملية', 'تاريخ الطلب', 'تاريخ الإصدار'],
  warranty: ['Warranty Period', 'Warranty', 'مدة الضمان', 'فترة الضمان', 'الضمان'],
  serialNumber: ['Serial Number', 'Serial No', 'S/N', 'الرقم التسلسلي', 'رقم تسلسلي', 'الرقم المتسلسل', 'سيريال'],
  category: ['Category', 'التصنيف', 'الفئة', 'نوع المنتج'],
};

function normalizeInvoiceText(value = '') {
  return String(value).normalize('NFKC').replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit))).replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit))).replace(/\r\n?/g, '\n').replace(/[،؛]/g, ' ').replace(/[\t\f\v]+/g, ' ').replace(/ +/g, ' ').replace(/ *\n */g, '\n').trim();
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function labelled(lines, labels) {
  const expression = new RegExp(`^(?:${labels.map(escapeRegExp).join('|')})\\s*(?::|#|-)?\\s*(.*)$`, 'i');
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(expression);
    if (!match) continue;
    const value = match[1].trim() || lines.slice(index + 1).find(Boolean)?.trim() || '';
    if (value && !labels.some((label) => value.toLowerCase() === label.toLowerCase())) return value.slice(0, 255);
  }
  return '';
}
const METADATA = /\b(?:id|register\s*no|receipt\s*no|invoice\s*(?:no|number)?|date|time|receipt\s*type|tax|vat|sku|barcode|sale)\b/iu;
const GENERIC_PRODUCT = /^(?:number|id|invoice(?: number)?|receipt(?: number)?|register no\.?|sku|barcode|item(?: number)?|product|description|date|time|sale|tax invoice|qty|quantity|unit price|value|discount|total|vat|البيان|الصنف|المنتج|الرقم|رقم الفاتورة|رقم الإيصال|الرقم الضريبي|الكمية|سعر الوحدة|القيمة|الخصم|الإجمالي|رمز الضريبة)$/iu;
const GENERIC_STORE = /^(?:store|merchant|seller|retailer|supplier|المتجر|البائع|المورد|الشركة|المنشأة)$/iu;
function metadataCount(value) { return (value.match(/\b(?:id|register\s*no|receipt\s*no|invoice\s*(?:no|number)?|date|time|receipt\s*type|tax|vat|sale)\b/giu) || []).length; }
function productScore(value) {
  const text = value.trim(); if (!text || text.length < 4 || GENERIC_PRODUCT.test(text) || METADATA.test(text)) return -100;
  let score = text.split(/\s+/).length >= 2 ? 3 : 0;
  if (/[a-z\p{Script=Arabic}]/iu.test(text) && /[a-z\p{Script=Arabic}]/iu.test(text.replace(/\b(?:qty|price|total|vat)\b/giu, ''))) score += 2;
  if (/\b(?:iphone|samsung|galaxy|apple|lenovo|sony|model)\b/iu.test(text)) score += 2;
  if (/\b(?:qty|price|total|vat|discount)\b/iu.test(text)) score -= 2;
  return score;
}
function storeScore(value) {
  const text = value.trim(); if (!text || text.length < 3 || text.length > 90 || GENERIC_STORE.test(text) || metadataCount(text) > 0 || /^\d+[\d\s:./-]*$/.test(text)) return -100;
  let score = text.split(/\s+/).length >= 2 ? 2 : 0;
  if (/\b(?:llc|ltd|inc|company|co\.?|electronics|trading|store|market)\b|شركة|مؤسسة|متجر/iu.test(text)) score += 3;
  return score;
}
function bestCandidate(candidates, scorer, minimum) { const ranked = candidates.map((value) => ({ value, score: scorer(value) })).sort((a, b) => b.score - a.score); return ranked[0]?.score >= minimum ? ranked[0].value.slice(0, 255) : ''; }
function fieldValue(lines, labels, scorer, minimum) {
  const expression = new RegExp(`^(?:${labels.map(escapeRegExp).join('|')})\\s*(?::|#|-)?\\s*(.*)$`, 'i');
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) { const match = lines[index].match(expression); if (match) { const value = match[1].trim() || lines[index + 1]?.trim() || ''; if (scorer(value) >= minimum) candidates.push(value); } }
  return bestCandidate(candidates, scorer, minimum);
}
function productFromTable(lines) {
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) if (/^(?:description|item(?: number)?|product|البيان|الصنف|الوصف)$/iu.test(lines[index])) { for (const line of lines.slice(index + 1, index + 22)) if (productScore(line) >= 4) candidates.push(line); }
  return bestCandidate(candidates, productScore, 4);
}
function storeHeading(lines) { const beforeMetadata = lines.findIndex((line) => metadataCount(line) > 0); return bestCandidate(lines.slice(0, beforeMetadata < 0 ? 4 : beforeMetadata), storeScore, 3); }
function inlineDate(text) { const match = normalizeInvoiceText(text).match(/\bdate\s*:\s*([^\n]+)/i); return match ? parseDate(match[1]) : ''; }
function inlineSerial(text) { const match = normalizeInvoiceText(text).match(/\bserial\s*(?:number|no\.?|#)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/-]{2,})/i); return match ? match[1] : ''; }
function inlineWarranty(text) { for (const line of normalizeInvoiceText(text).split('\n')) if (/(?:warranty|ضمان)/iu.test(line)) { const warranty = parseWarranty(line); if (warranty.duration) return warranty; } return { duration: '', unit: '' }; }
function validDate(year, month, day) { const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day; }
function formatDate(year, month, day) { return validDate(year, month, day) ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''; }
function parseDate(value) {
  const text = normalizeInvoiceText(value).toLowerCase();
  let match = text.match(/\b(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})\b/);
  if (match) return formatDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})\b/);
  if (match) return formatDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = text.match(/\b(\d{1,2})\s+([\p{L}]+)\s+(\d{4})\b/u);
  return match && MONTHS[match[2]] ? formatDate(Number(match[3]), MONTHS[match[2]], Number(match[1])) : '';
}
function parseWarranty(value) {
  const text = normalizeInvoiceText(value).toLowerCase();
  const words = [[/سنتان|سنتين/g, 2, 'years'], [/سنة واحدة|عام واحد/g, 1, 'years']];
  for (const [pattern, duration, unit] of words) if (pattern.test(text)) return { duration: String(duration), unit };
  const match = text.match(/(?:^|\s)(\d{1,4})\s*(day|days|month|months|year|years|يوم|أيام|ايام|شهر|أشهر|اشهر|سنة|سنوات|عام|أعوام|اعوام)(?:\s|$)/iu);
  if (!match || Number(match[1]) < 1) return { duration: '', unit: '' };
  const unit = /day|يوم|أيام|ايام/u.test(match[2]) ? 'days' : /month|شهر|أشهر|اشهر/u.test(match[2]) ? 'months' : 'years';
  return { duration: match[1], unit };
}
function mapCategory(value) {
  const text = normalizeInvoiceText(value).toLowerCase();
  if (/smartphone|phone|mobile|هاتف|جوال|هواتف/u.test(text)) return 'Smartphones';
  if (/laptop|notebook|ideapad|thinkpad|حاسوب|لابتوب/u.test(text)) return 'Laptops';
  if (/tablet|تابلت|جهاز لوحي/u.test(text)) return 'Tablets';
  if (/camera|كاميرا/u.test(text)) return 'Cameras';
  if (/television|tv|شاشة|تلفاز/u.test(text)) return 'Televisions and Screens';
  if (/gaming|game|ألعاب|العاب/u.test(text)) return 'Gaming Devices';
  if (/furniture|أثاث|اثاث/u.test(text)) return 'Furniture';
  if (/kitchen|مطبخ/u.test(text)) return 'Kitchen Appliances';
  if (/appliance|منزلي/u.test(text)) return 'Home Appliances';
  if (/accessor|ملحق/u.test(text)) return 'Accessories';
  if (/automotive|سيارة|سيارات/u.test(text)) return 'Automotive Products';
  return '';
}
function extractInvoiceFields(text = '') {
  const normalized = normalizeInvoiceText(text); const lines = normalized.split('\n').map((line) => line.trim());
  const explicitProduct = fieldValue(lines, LABELS.productName, productScore, 3);
  const fields = { productName: explicitProduct || productFromTable(lines), storeName: fieldValue(lines, LABELS.storeName, storeScore, 2) || storeHeading(lines), purchaseDate: '', serialNumber: labelled(lines, LABELS.serialNumber), warrantyDuration: '', warrantyUnit: '', category: '' };
  const arabicProduct = normalized.match(/\u0627\u0633\u0645\s+\u0627\u0644\u0645\u0646\u062a\u062c\s*:\s*(.+?)(?=\s+\u0627\u0644\u062a\u0635\u0646\u064a\u0641\s*:|$)/u);
  const arabicStore = normalized.match(/\u0627\u0633\u0645\s+\u0627\u0644\u0645\u062a\u062c\u0631\s*:\s*(.+?)(?=\s+(?:\u0637\u0631\u064a\u0642\u0629\s+\u0627\u0644\u062f\u0641\u0639|\u0648\u0633\u064a\u0644\u0629\s+\u0627\u0644\u062f\u0641\u0639)\s*:|$)/u);
  const arabicPurchaseDate = normalized.match(/\u062a\u0627\u0631\u064a\u062e\s+\u0627\u0644\u0634\u0631\u0627\u0621\s*:\s*([^\n]+)/u);
  const arabicSerial = normalized.match(/\u0627\u0644\u0631\u0642\u0645\s+\u0627\u0644\u062a\u0633\u0644\u0633\u0644\u064a\s*:\s*([A-Za-z0-9][A-Za-z0-9/-]{2,})/u);
  if (arabicProduct && productScore(arabicProduct[1]) >= 3) fields.productName = arabicProduct[1].trim();
  if (arabicStore && storeScore(arabicStore[1]) >= 2) fields.storeName = arabicStore[1].trim();
  fields.purchaseDate = parseDate(labelled(lines, LABELS.purchaseDate)) || inlineDate(normalized) || (arabicPurchaseDate && parseDate(arabicPurchaseDate[1])) || '';
  fields.serialNumber = fields.serialNumber || inlineSerial(normalized) || (arabicSerial && arabicSerial[1]) || '';
  const warranty = parseWarranty(labelled(lines, LABELS.warranty)); const fallbackWarranty = inlineWarranty(normalized); fields.warrantyDuration = warranty.duration || fallbackWarranty.duration; fields.warrantyUnit = warranty.unit || fallbackWarranty.unit;
  fields.category = mapCategory(labelled(lines, LABELS.category)) || mapCategory(fields.productName);
  if (!fields.category && /\u0644\u0627\u0628\u062a\u0648\u0628|\u0627\u0644\u0628\u062a\u0648\u0628|\u0643\u0645\u0628\u064a\u0648\u062a\u0631/u.test(fields.productName)) fields.category = 'Laptops';
  return fields;
}
module.exports = { extractInvoiceFields, normalizeInvoiceText, parseDate, parseWarranty };
