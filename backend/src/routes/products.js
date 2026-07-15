const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const database = require('../config/database');
const requireAuthentication = require('../middleware/requireAuthentication');
const { calculateWarranty, getWarrantyStatus, parseDate } = require('../services/warranty');

const router = express.Router();
const VALID_WARRANTY_UNITS = ['days', 'months', 'years'];
const invoiceDirectory = path.resolve(__dirname, '../../uploads/invoices');
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.pdf']);
const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => { fs.mkdirSync(invoiceDirectory, { recursive: true }); callback(null, invoiceDirectory); },
    filename: (req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isAllowed = allowedExtensions.has(extension) && (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'));
    return callback(isAllowed ? null : new Error('Unsupported invoice attachment.'), isAllowed);
  },
});

function removeInvoiceFile(invoicePath) {
  if (!invoicePath) return;
  const filePath = path.resolve(invoiceDirectory, path.basename(invoicePath));
  if (filePath.startsWith(invoiceDirectory + path.sep)) fs.unlink(filePath, () => {});
}

router.use(requireAuthentication);

function validateProduct(input = {}) {
  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const storeName = typeof input.storeName === 'string' ? input.storeName.trim() : '';
  const purchaseDate = typeof input.purchaseDate === 'string' ? input.purchaseDate : '';
  const warrantyDuration = (typeof input.warrantyDuration === 'string' || typeof input.warrantyDuration === 'number') ? Number(input.warrantyDuration) : Number.NaN;
  const warrantyUnit = typeof input.warrantyUnit === 'string' ? input.warrantyUnit : '';
  const serialNumber = typeof input.serialNumber === 'string' ? input.serialNumber.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const parsedPurchaseDate = parseDate(purchaseDate);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  if (!name) errors.name = 'Product name is required.';
  if (!category) errors.category = 'Category is required.';
  if (!storeName) errors.storeName = 'Store name is required.';
  if (!purchaseDate) errors.purchaseDate = 'Purchase date is required.';
  else if (!parsedPurchaseDate || parsedPurchaseDate.getTime() > todayUtc) errors.purchaseDate = 'Purchase date must be valid and cannot be in the future.';
  if (!Number.isInteger(warrantyDuration) || warrantyDuration <= 0) errors.warrantyDuration = 'Warranty duration must be a positive whole number.';
  if (!VALID_WARRANTY_UNITS.includes(warrantyUnit)) errors.warrantyUnit = 'Warranty unit must be days, months, or years.';
  if (serialNumber.length > 255) errors.serialNumber = 'Serial number must be 255 characters or fewer.';
  if (notes.length > 5000) errors.notes = 'Notes must be 5000 characters or fewer.';

  return {
    errors,
    product: { name, category, storeName, purchaseDate, warrantyDuration, warrantyUnit, serialNumber, notes },
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
    category: product.category,
    storeName: product.store_name,
    purchaseDate: product.purchase_date,
    warrantyDuration: product.warranty_duration,
    warrantyUnit: product.warranty_unit,
    expirationDate: product.expiration_date,
    serialNumber: product.serial_number,
    notes: product.notes,
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
    ...warranty,
  };
}

function validProductId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

router.get('/', async (req, res) => {
  try {
    const [products] = await database.execute(
      'SELECT id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, serial_number, notes, invoice_path FROM products WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id],
    );
    return res.status(200).json({ products: products.map(toProductResponse) });
  } catch {
    return res.status(500).json({ error: 'Unable to load products. Please try again.' });
  }
});

router.post('/', attachmentUpload.single('invoice'), async (req, res) => {
  const { errors, product } = validateProduct(req.body);
  if (Object.keys(errors).length > 0) { removeInvoiceFile(req.file?.filename); return res.status(400).json({ errors }); }

  const warranty = calculateWarranty(product.purchaseDate, product.warrantyDuration, product.warrantyUnit);
  try {
    const [result] = await database.execute(
      'INSERT INTO products (user_id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, serial_number, notes, invoice_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.session.user.id, product.name, product.category, product.storeName, product.purchaseDate, product.warrantyDuration, product.warrantyUnit, warranty.expirationDate, product.serialNumber || null, product.notes || null, req.file?.filename || null],
    );
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
      'SELECT id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, serial_number, notes, invoice_path FROM products WHERE id = ? AND user_id = ?',
      [id, req.session.user.id],
    );
    if (!products[0]) return res.status(404).json({ error: 'Product not found.' });
    return res.status(200).json({ product: toProductResponse(products[0]) });
  } catch {
    return res.status(500).json({ error: 'Unable to load product. Please try again.' });
  }
});

router.put('/:id', attachmentUpload.single('invoice'), async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) { removeInvoiceFile(req.file?.filename); return res.status(404).json({ error: 'Product not found.' }); }

  const { errors, product } = validateProduct(req.body);
  if (Object.keys(errors).length > 0) { removeInvoiceFile(req.file?.filename); return res.status(400).json({ errors }); }

  const warranty = calculateWarranty(product.purchaseDate, product.warrantyDuration, product.warrantyUnit);
  try {
    const [existing] = await database.execute('SELECT invoice_path FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    if (!existing[0]) { removeInvoiceFile(req.file?.filename); return res.status(404).json({ error: 'Product not found.' }); }
    const removeInvoice = req.body.removeInvoice === 'true' || req.body.removeInvoice === true;
    const invoicePath = req.file?.filename || (removeInvoice ? null : existing[0].invoice_path);
    const [result] = await database.execute(
      'UPDATE products SET name = ?, category = ?, store_name = ?, purchase_date = ?, warranty_duration = ?, warranty_unit = ?, expiration_date = ?, serial_number = ?, notes = ?, invoice_path = ? WHERE id = ? AND user_id = ?',
      [product.name, product.category, product.storeName, product.purchaseDate, product.warrantyDuration, product.warrantyUnit, warranty.expirationDate, product.serialNumber || null, product.notes || null, invoicePath, id, req.session.user.id],
    );
    if (result.affectedRows === 0) { removeInvoiceFile(req.file?.filename); return res.status(404).json({ error: 'Product not found.' }); }
    if (existing[0].invoice_path && existing[0].invoice_path !== invoicePath) removeInvoiceFile(existing[0].invoice_path);
    return res.status(200).json({ message: 'Product updated successfully.', product: productFromInput(id, product, warranty) });
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
    return res.type(path.extname(invoicePath)).sendFile(filePath, { headers: { 'Content-Disposition': 'inline' } });
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
    return res.download(filePath, path.basename(invoicePath));
  } catch { return res.status(500).json({ error: 'Unable to download invoice. Please try again.' }); }
});

router.delete('/:id', async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Product not found.' });

  try {
    const [products] = await database.execute('SELECT invoice_path FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    if (!products[0]) return res.status(404).json({ error: 'Product not found.' });
    const [result] = await database.execute('DELETE FROM products WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found.' });
    removeInvoiceFile(products[0].invoice_path);
    return res.status(200).json({ message: 'Product deleted successfully.' });
  } catch {
    return res.status(500).json({ error: 'Unable to delete product. Please try again.' });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Invoice attachment must be 10 MB or smaller.' });
  if (error) return res.status(400).json({ error: 'Invoice attachment must be a supported image format or PDF file.' });
  return next();
});

module.exports = router;
