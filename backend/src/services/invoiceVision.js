const { GoogleGenAI, Type } = require('@google/genai');

const CATEGORIES = ['Smartphones', 'Laptops', 'Tablets', 'Televisions and Screens', 'Gaming Devices', 'Cameras', 'Home Appliances', 'Kitchen Appliances', 'Accessories', 'Furniture', 'Automotive Products', 'Other'];
const schema = { type: Type.OBJECT, properties: { product_name: { type: Type.STRING, nullable: true }, store_name: { type: Type.STRING, nullable: true }, purchase_date: { type: Type.STRING, nullable: true }, warranty_duration: { type: Type.INTEGER, nullable: true }, warranty_unit: { type: Type.STRING, nullable: true }, serial_number: { type: Type.STRING, nullable: true }, category: { type: Type.STRING, nullable: true }, warnings: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['product_name', 'store_name', 'purchase_date', 'warranty_duration', 'warranty_unit', 'serial_number', 'category', 'warnings'] };
const clean = (value, max = 255) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function models() {
  return [...new Set((process.env.GEMINI_MODELS || process.env.GEMINI_INVOICE_MODEL || 'gemini-3.5-flash').split(',').map((model) => model.trim()).filter(Boolean))];
}

function statusOf(cause) { return Number(cause?.status || cause?.response?.status || cause?.error?.code); }
function errorCode(cause) {
  if (cause?.code && String(cause.code).startsWith('AI_')) return cause.code;
  const status = statusOf(cause);
  if (status === 503) return 'AI_UNAVAILABLE';
  if (status === 429) return 'AI_RATE_LIMITED';
  if (status === 401 || status === 403) return 'AI_AUTH_ERROR';
  if (status === 400) return 'AI_REQUEST_ERROR';
  if (status === 404 || /model.*not.*found/i.test(String(cause?.message))) return 'AI_MODEL_ERROR';
  return 'AI_UNAVAILABLE';
}
function retryable(code, cause) {
  return ['AI_UNAVAILABLE', 'AI_RATE_LIMITED'].includes(code) && ![400, 401, 403, 404].includes(statusOf(cause));
}
function retryAfterMs(cause, attempt) {
  const header = cause?.response?.headers?.get?.('retry-after') || cause?.response?.headers?.['retry-after'] || cause?.headers?.['retry-after'];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5000);
  return (attempt === 0 ? 500 : 1500) + Math.floor(Math.random() * 100);
}
function safeError(code, status) { const error = new Error('Invoice AI service could not analyze this invoice.'); error.code = code; if (status) error.status = status; return error; }

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw safeError('AI_INVALID_RESPONSE');
  const unit = clean(raw.warranty_unit)?.toLowerCase();
  const duration = Number.isInteger(raw.warranty_duration) && raw.warranty_duration > 0 && raw.warranty_duration <= 3650 ? raw.warranty_duration : null;
  const date = clean(raw.purchase_date);
  return { productName: clean(raw.product_name), storeName: clean(raw.store_name), purchaseDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : null, warrantyDuration: duration, warrantyUnit: duration && ['day', 'days', 'month', 'months', 'year', 'years'].includes(unit) ? `${unit.replace(/s$/, '')}s` : null, serialNumber: clean(raw.serial_number), category: CATEGORIES.includes(raw.category) ? raw.category : null, warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((value) => ['MULTIPLE_PRODUCTS_FOUND', 'PURCHASE_DATE_UNCERTAIN', 'WARRANTY_NOT_FOUND', 'SERIAL_NUMBER_NOT_FOUND'].includes(value)) : [] };
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(safeError('AI_TIMEOUT')), timeoutMs); })]); } finally { clearTimeout(timer); }
}

async function analyzeInvoiceWithGemini({ buffer, mimeType, text, images, retryDelay = sleep }) {
  if (!process.env.GEMINI_API_KEY) throw safeError('AI_UNAVAILABLE');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = 'The invoice may be Arabic, English, or bilingual, including right-to-left layouts. Extract only clearly supported product information. Preserve product, merchant, and serial text exactly in its original language; do not translate names. Treat Arabic and English digits as equivalent. Return dates as YYYY-MM-DD and warranty units as days, months, or years. Return null when uncertain. Never use invoice, order, SKU, model, tax, or barcode numbers as serial numbers. Use only the supplied category values.';
  const contents = text ? [prompt, `Invoice text:\n${text.slice(0, 20000)}`] : [...(images || [buffer]).map((image) => ({ inlineData: { mimeType: images ? 'image/png' : mimeType, data: image.toString('base64') } })), prompt];
  const configuredModels = models();
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const model = configuredModels[Math.min(attempt, configuredModels.length - 1)];
    try {
      const response = await withTimeout(ai.models.generateContent({ model, contents, config: { responseMimeType: 'application/json', responseSchema: schema } }), 12000);
      let raw;
      try { raw = JSON.parse(response.text); } catch { throw safeError('AI_INVALID_RESPONSE'); }
      return { ...normalize(raw), model };
    } catch (cause) {
      const code = errorCode(cause); lastError = safeError(code, statusOf(cause));
      if (!retryable(code, cause) || attempt === 2) throw lastError;
      await retryDelay(retryAfterMs(cause, attempt));
    }
  }
  throw lastError || safeError('AI_UNAVAILABLE');
}

async function checkGeminiHealth() {
  if (!process.env.GEMINI_API_KEY) throw safeError('AI_UNAVAILABLE');
  const model = models()[0]; const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    await withTimeout(ai.models.generateContent({ model, contents: 'Reply with OK.' }), 12000);
    return { model };
  } catch (cause) { throw safeError(errorCode(cause), statusOf(cause)); }
}

module.exports = { analyzeInvoiceWithGemini, checkGeminiHealth, normalize, errorCode };
