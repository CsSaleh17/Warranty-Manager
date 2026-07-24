const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const database = require('../config/database');
const requireAuthentication = require('../middleware/requireAuthentication');
const { calculateWarranty, getWarrantyStatus, parseDate } = require('../services/warranty');
const { normalizeCategory, cleanStoreName } = require('../services/categories');
const auditLogger = require('../services/auditLogger');
const { MIME_TYPES, validateInvoiceFile } = require('../services/invoiceFiles');
const { loadEnvironment } = require('../config/environment');

const router = express.Router();
const VALID_WARRANTY_UNITS = ['days', 'months', 'years'];
const runtimeConfig = loadEnvironment();
const invoiceDirectory = runtimeConfig.uploadDirectory;
const allowedExtensions = new Set(Object.keys(MIME_TYPES));
const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => { fs.mkdirSync(invoiceDirectory, { recursive: true }); callback(null, invoiceDirectory); },
    filename: (req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: runtimeConfig.uploadMaxBytes },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isAllowed = allowedExtensions.has(extension) && MIME_TYPES[extension].has(file.mimetype);
    return callback(isAllowed ? null : new Error('Unsupported invoice attachment.'), isAllowed);
  },
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many invoice uploads. Please try again later.' },
});

function databaseBoolean(value) {
  return value === true || value === 1 || value === '1';
}

function removeInvoiceFile(invoicePath) {
  if (!invoicePath) return;
  const filePath = path.resolve(invoiceDirectory, path.basename(invoicePath));
  if (filePath.startsWith(invoiceDirectory + path.sep)) fs.unlink(filePath, () => {});
}

function validateStoredInvoice(req, res, next) {
  if (!req.file) return next();
  try {
    const buffer = fs.readFileSync(req.file.path);
    if (validateInvoiceFile({ ...req.file, buffer })) return next();
  } catch {
    // Treat unreadable temporary uploads as invalid content.
  }
  removeInvoiceFile(req.file.filename);
  req.file = undefined;
  return res.status(400).json({ error: 'Invoice file content does not match its declared type.' });
}

router.use(requireAuthentication);

function validateProduct(input = {}) {
  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const category = normalizeCategory(input.category);
  const storeName = cleanStoreName(input.storeName);
  const purchaseDate = typeof input.purchaseDate === 'string' ? input.purchaseDate : '';
  const warrantyDuration = (typeof input.warrantyDuration === 'string' || typeof input.warrantyDuration === 'number') ? Number(input.warrantyDuration) : Number.NaN;
  const warrantyUnit = typeof input.warrantyUnit === 'string' ? input.warrantyUnit : '';
  const serialNumber = typeof input.serialNumber === 'string' ? input.serialNumber.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const reminderEnabled = input.reminderEnabled === true || input.reminderEnabled === 'true' || input.reminderEnabled === '1';
  const reminderDaysBefore = input.reminderDaysBefore === '' || input.reminderDaysBefore === undefined ? null : Number(input.reminderDaysBefore);
  const parsedPurchaseDate = parseDate(purchaseDate);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  if (!name) errors.name = 'Product name is required.';
  else if (name.length > 255) errors.name = 'Product name must be 255 characters or fewer.';
  if (!category) errors.category = 'Category is required.';
  if (!storeName) errors.storeName = 'Store name is required.';
  else if (storeName.length > 255) errors.storeName = 'Store name must be 255 characters or fewer.';
  if (!purchaseDate) errors.purchaseDate = 'Purchase date is required.';
  else if (!parsedPurchaseDate || parsedPurchaseDate.getTime() > todayUtc) errors.purchaseDate = 'Purchase date must be valid and cannot be in the future.';
  if (!Number.isInteger(warrantyDuration) || warrantyDuration < 1) errors.warrantyDuration = 'Warranty duration must be a positive whole number.';
  else if (warrantyDuration > 3650) errors.warrantyDuration = 'Warranty duration must be a whole number between 1 and 3650.';
  if (!VALID_WARRANTY_UNITS.includes(warrantyUnit)) errors.warrantyUnit = 'Warranty unit must be days, months, or years.';
  if (serialNumber.length > 255) errors.serialNumber = 'Serial number must be 255 characters or fewer.';
  if (notes.length > 5000) errors.notes = 'Notes must be 5000 characters or fewer.';
  if (reminderEnabled && (!Number.isInteger(reminderDaysBefore) || reminderDaysBefore < 1 || reminderDaysBefore > 3650)) errors.reminderDaysBefore = 'Reminder days must be a whole number between 1 and 3650.';

  return {
    errors,
    product: { name, category, storeName, purchaseDate, warrantyDuration, warrantyUnit, serialNumber, notes, reminderEnabled, reminderDaysBefore: reminderEnabled ? reminderDaysBefore : null },
  };
}

function toProductResponse(product) {
  const warranty = getWarrantyStatus(product.expiration_date);
  const invoiceName = product.invoice_path ? path.basename(product.invoice_path) : null;
  const invoiceExtension = invoiceName ? path.extname(invoiceName).toLowerCase() : '';
  const invoiceMimeType = invoiceExtension === '.pdf' ? 'application/pdf' : invoiceExtension ? `image/${invoiceExtension.slice(1).replace('jpg', 'jpeg')}` : null;
  return {
    id: product.id,
    name: product.name,
    category: normalizeCategory(product.category),
    storeName: cleanStoreName(product.store_name),
    purchaseDate: product.purchase_date,
    warrantyDuration: product.warranty_duration,
    warrantyUnit: product.warranty_unit,
    expirationDate: product.expiration_date,
    serialNumber: product.serial_number,
    notes: product.notes,
    reminderEnabled: databaseBoolean(product.reminder_enabled), reminderDaysBefore: product.reminder_days_before === null ? null : Number(product.reminder_days_before), isReminded: databaseBoolean(product.is_reminded), reminderSentAt: product.reminder_sent_at,
    hasInvoice: Boolean(product.invoice_path),
    invoiceFileName: invoiceName,
    invoiceMimeType,
    invoiceViewUrl: product.invoice_path ? `/api/products/${product.id}/invoice/view` : null,
    invoiceDownloadUrl: product.invoice_path ? `/api/products/${product.id}/invoice/download` : null,
    ...warranty,
  };
}

function productFromInput(id, product, warranty) {
  return {
    id,
    ...product,
    expirationDate: warranty.expirationDate,
    isReminded: false,
    reminderSentAt: null,
    ...warranty,
  };
}

function validProductId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

const SORTS = { recent: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)), oldest: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)), name_asc: (a, b) => a.name.localeCompare(b.name), name_desc: (a, b) => b.name.localeCompare(a.name), purchase_newest: (a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate)), purchase_oldest: (a, b) => String(a.purchaseDate).localeCompare(String(b.purchaseDate)), expiration_nearest: (a, b) => String(a.expirationDate).localeCompare(String(b.expirationDate)), expiration_farthest: (a, b) => String(b.expirationDate).localeCompare(String(a.expirationDate)), remaining_least: (a, b) => a.remainingWarrantyDays - b.remainingWarrantyDays, remaining_most: (a, b) => b.remainingWarrantyDays - a.remainingWarrantyDays };
function readQuery(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1); const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 12));
  const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  return { search: typeof query.search === 'string' ? query.search.trim().toLowerCase().slice(0, 100) : '', status: ['Active', 'Expiring Soon', 'Expired'].includes(query.status) ? query.status : '', store: typeof query.store === 'string' ? query.store.trim().slice(0, 255) : '', category: typeof query.category === 'string' ? query.category.trim().slice(0, 100) : '', purchaseDateFrom: date(query.purchaseDateFrom), purchaseDateTo: date(query.purchaseDateTo), expirationDateFrom: date(query.expirationDateFrom), expirationDateTo: date(query.expirationDateTo), remainingDaysPreset: ['7', '30', '60', '90', 'more-90', 'expired'].includes(query.remainingDaysPreset) ? query.remainingDaysPreset : '', minRemainingDays: number(query.minRemainingDays), maxRemainingDays: number(query.maxRemainingDays), warrantyDurationPreset: ['lt-6m', '6-12m', '1-2y', 'gt-2y'].includes(query.warrantyDurationPreset) ? query.warrantyDurationPreset : '', sort: SORTS[query.sort] ? query.sort : 'recent', page, limit };
}

router.get('/', async (req, res) => {
  try {
    const query = readQuery(req.query);
    const [products] = await database.execute(
      'SELECT id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, serial_number, notes, invoice_path, reminder_enabled, reminder_days_before, is_reminded, reminder_sent_at, created_at FROM products WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id],
    );
    const mapped = products.map((product) => ({ ...toProductResponse(product), createdAt: product.created_at }));
    const filtered = mapped.filter((product) => { const text = `${product.name} ${product.storeName} ${product.serialNumber || ''} ${product.category}`.toLowerCase(); const remaining = product.remainingWarrantyDays; const lengthMonths = product.warrantyDuration * (product.warrantyUnit === 'years' ? 12 : product.warrantyUnit === 'days' ? 1 / 30 : 1); const preset = !query.remainingDaysPreset || (query.remainingDaysPreset === 'more-90' ? remaining > 90 : query.remainingDaysPreset === 'expired' ? remaining < 0 : remaining >= 0 && remaining <= Number(query.remainingDaysPreset)); const length = !query.warrantyDurationPreset || (query.warrantyDurationPreset === 'lt-6m' ? lengthMonths < 6 : query.warrantyDurationPreset === '6-12m' ? lengthMonths >= 6 && lengthMonths <= 12 : query.warrantyDurationPreset === '1-2y' ? lengthMonths > 12 && lengthMonths <= 24 : lengthMonths > 24); return (!query.search || text.includes(query.search)) && (!query.status || product.warrantyStatus === query.status) && (!query.store || product.storeName === query.store) && (!query.category || product.category === query.category) && (!query.purchaseDateFrom || product.purchaseDate >= query.purchaseDateFrom) && (!query.purchaseDateTo || product.purchaseDate <= query.purchaseDateTo) && (!query.expirationDateFrom || product.expirationDate >= query.expirationDateFrom) && (!query.expirationDateTo || product.expirationDate <= query.expirationDateTo) && preset && (query.minRemainingDays === null || remaining >= query.minRemainingDays) && (query.maxRemainingDays === null || remaining <= query.maxRemainingDays) && length; });
    filtered.sort(SORTS[query.sort]); const totalItems = filtered.length; const start = (query.page - 1) * query.limit;
    return res.status(200).json({ products: filtered.slice(start, start + query.limit), pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) }, availableFilters: { stores: [...new Set(mapped.map((p) => p.storeName).filter(Boolean))].sort(), categories: [...new Set(mapped.map((p) => p.category).filter(Boolean))].sort() } });
  } catch {
    return res.status(500).json({ error: 'Unable to load products. Please try again.' });
  }
});

router.post('/', uploadLimiter, attachmentUpload.single('invoice'), validateStoredInvoice, async (req, res) => {
  const invoiceAction = req.body?.invoiceAction;
  if (!['none', 'save', undefined].includes(invoiceAction) || (invoiceAction === 'save' && !req.file)) { removeInvoiceFile(req.file?.filename); return res.status(400).json({ error: 'Invalid invoice action.' }); }
  const { errors, product } = validateProduct(req.body);
  if (Object.keys(errors).length > 0) { removeInvoiceFile(req.file?.filename); return res.status(400).json({ errors }); }

  const warranty = calculateWarranty(product.purchaseDate, product.warrantyDuration, product.warrantyUnit);
  try {
    const [result] = await database.execute(
      'INSERT INTO products (user_id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, serial_number, notes, invoice_path, reminder_enabled, reminder_days_before) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.session.user.id, product.name, product.category, product.storeName, product.purchaseDate, product.warrantyDuration, product.warrantyUnit, warranty.expirationDate, product.serialNumber || null, product.notes || null, req.file?.filename || null, product.reminderEnabled, product.reminderDaysBefore],
    );
    auditLogger.productMutation('product_create', { productId: result.insertId, userId: req.session.user.id, outcome: 'success' });
    return res.status(201).json({ message: 'Product added successfully.', product: productFromInput(result.insertId, product, warranty) });
  } catch {
    removeInvoiceFile(req.file?.filename);
    return res.status(500).json({ error: 'Unable to add product. Please try again.' });
  }
});

router.get('/:id', async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Product not found.' });

  try {
    const [products] = await database.execute(
      'SELECT id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, serial_number, notes, invoice_path, reminder_enabled, reminder_days_before, is_reminded, reminder_sent_at FROM products WHERE id = ? AND user_id = ?',
      [id, req.session.user.id],
    );
    if (!products[0]) return res.status(404).json({ error: 'Product not found.' });
    return res.status(200).json({ product: toProductResponse(products[0]) });
  } catch {
    return res.status(500).json({ error: 'Unable to load product. Please try again.' });
  }
});

router.put('/:id', uploadLimiter, attachmentUpload.single('invoice'), validateStoredInvoice, async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) { removeInvoiceFile(req.file?.filename); return res.status(404).json({ error: 'Product not found.' }); }

  const { errors, product } = validateProduct(req.body);
  if (Object.keys(errors).length > 0) { removeInvoiceFile(req.file?.filename); return res.status(400).json({ errors }); }

  const warranty = calculateWarranty(product.purchaseDate, product.warrantyDuration, product.warrantyUnit);
  try {
    const [existing] = await database.execute('SELECT invoice_path, expiration_date, reminder_enabled, reminder_days_before, is_reminded, reminder_sent_at FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    if (!existing[0]) { auditLogger.productMutation('product_update', { productId: id, userId: req.session.user.id, outcome: 'not_found' }); removeInvoiceFile(req.file?.filename); return res.status(404).json({ error: 'Product not found.' }); }
    const requestedInvoiceAction = req.body.invoiceAction || 'keep';
    const invoiceAction = requestedInvoiceAction === 'none' ? 'keep' : requestedInvoiceAction === 'save' ? 'replace' : requestedInvoiceAction;
    if (!['keep', 'replace', 'remove'].includes(invoiceAction) || (invoiceAction === 'replace' && !req.file) || (invoiceAction !== 'replace' && req.file)) { removeInvoiceFile(req.file?.filename); return res.status(400).json({ error: 'Invalid invoice action.' }); }
    const invoicePath = invoiceAction === 'replace' ? req.file.filename : invoiceAction === 'remove' ? null : existing[0].invoice_path;
    const reminderChanged = databaseBoolean(existing[0].reminder_enabled) !== product.reminderEnabled || Number(existing[0].reminder_days_before) !== Number(product.reminderDaysBefore) || String(existing[0].expiration_date) !== warranty.expirationDate;
    const isReminded = product.reminderEnabled && (!reminderChanged ? existing[0].is_reminded : false);
    const reminderSentAt = product.reminderEnabled && !reminderChanged ? existing[0].reminder_sent_at : null;
    const [result] = await database.execute(
      'UPDATE products SET name = ?, category = ?, store_name = ?, purchase_date = ?, warranty_duration = ?, warranty_unit = ?, expiration_date = ?, serial_number = ?, notes = ?, invoice_path = ?, reminder_enabled = ?, reminder_days_before = ?, is_reminded = ?, reminder_sent_at = ? WHERE id = ? AND user_id = ?',
      [product.name, product.category, product.storeName, product.purchaseDate, product.warrantyDuration, product.warrantyUnit, warranty.expirationDate, product.serialNumber || null, product.notes || null, invoicePath, product.reminderEnabled, product.reminderDaysBefore, isReminded, reminderSentAt, id, req.session.user.id],
    );
    if (result.affectedRows === 0) { auditLogger.productMutation('product_update', { productId: id, userId: req.session.user.id, outcome: 'not_modified' }); removeInvoiceFile(req.file?.filename); return res.status(404).json({ error: 'Product not found.' }); }
    if (existing[0].invoice_path && existing[0].invoice_path !== invoicePath) removeInvoiceFile(existing[0].invoice_path);
    auditLogger.productMutation('product_update', { productId: id, userId: req.session.user.id, outcome: 'success' });
    return res.status(200).json({ message: 'Product updated successfully.', product: { ...productFromInput(id, product, warranty), isReminded: Boolean(isReminded), reminderSentAt } });
  } catch {
    removeInvoiceFile(req.file?.filename);
    return res.status(500).json({ error: 'Unable to update product. Please try again.' });
  }
});

async function viewInvoice(req, res) {
  const id = validProductId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Invoice not found.' });
  try {
    const [products] = await database.execute('SELECT invoice_path FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    const invoicePath = products[0]?.invoice_path;
    if (!invoicePath) return res.status(404).json({ error: 'Invoice not found.' });
    const filePath = path.resolve(invoiceDirectory, path.basename(invoicePath));
    if (!filePath.startsWith(invoiceDirectory + path.sep) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Invoice not found.' });
    return res.type(path.extname(invoicePath)).sendFile(filePath, { headers: { 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'Accept-Ranges': 'none' } });
  } catch {
    return res.status(500).json({ error: 'Unable to access invoice. Please try again.' });
  }
}

router.get('/:id/invoice', viewInvoice);
router.get('/:id/invoice/view', viewInvoice);

router.get('/:id/invoice/download', async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Invoice not found.' });
  try {
    const [products] = await database.execute('SELECT invoice_path FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    const invoicePath = products[0]?.invoice_path;
    const filePath = invoicePath && path.resolve(invoiceDirectory, path.basename(invoicePath));
    if (!filePath || !filePath.startsWith(invoiceDirectory + path.sep) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'Invoice not found.' });
    res.type(path.extname(invoicePath));
    res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'Accept-Ranges': 'none' });
    return res.download(filePath, path.basename(invoicePath));
  } catch { return res.status(500).json({ error: 'Unable to download invoice. Please try again.' }); }
});

router.delete('/:id', async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Product not found.' });

  try {
    const [products] = await database.execute('SELECT invoice_path FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    if (!products[0]) { auditLogger.productMutation('product_delete', { productId: id, userId: req.session.user.id, outcome: 'not_found' }); return res.status(404).json({ error: 'Product not found.' }); }
    const [result] = await database.execute('DELETE FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    if (result.affectedRows === 0) { auditLogger.productMutation('product_delete', { productId: id, userId: req.session.user.id, outcome: 'not_deleted' }); return res.status(404).json({ error: 'Product not found.' }); }
    removeInvoiceFile(products[0].invoice_path);
    auditLogger.productMutation('product_delete', { productId: id, userId: req.session.user.id, outcome: 'success' });
    return res.status(200).json({ message: 'Product deleted successfully.' });
  } catch {
    return res.status(500).json({ error: 'Unable to delete product. Please try again.' });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `Invoice attachment must be ${Math.floor(runtimeConfig.uploadMaxBytes / (1024 * 1024))} MB or smaller.` });
  if (error) return res.status(400).json({ error: 'Invoice attachment must be a supported image format or PDF file.' });
  return next();
});

module.exports = router;
