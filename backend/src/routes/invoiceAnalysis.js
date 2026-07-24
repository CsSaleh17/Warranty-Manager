const express = require('express');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const convertHeic = require('heic-convert');
const requireAuthentication = require('../middleware/requireAuthentication');
const { extractInvoiceFields } = require('../services/invoiceExtraction');
const { extractPdfText } = require('../services/invoiceText');
const { analyzeInvoiceWithGemini } = require('../services/invoiceVision');
const { renderPdfPages } = require('../services/pdfRender');
const { recognizeInvoiceText } = require('../services/invoiceOcr');
const { normalizeCategory } = require('../services/categories');
const { MIME_TYPES, validateInvoiceFile } = require('../services/invoiceFiles');
const { loadEnvironment } = require('../config/environment');
const router = express.Router();
function cleanDetectedValue(value) {
  return typeof value === 'string' ? value.replace(/^\s*(?:name|store|merchant|seller|product(?:\s*name)?|serial(?:\s*(?:number|no\.?))?)\s*:\s*/i, '').trim() : value;
}
function cleanDetectedFields(fields) {
  return { ...fields, productName: cleanDetectedValue(fields.productName), storeName: cleanDetectedValue(fields.storeName), serialNumber: cleanDetectedValue(fields.serialNumber), category: fields.category ? normalizeCategory(fields.category) : '' };
}
const extensions = new Set(Object.keys(MIME_TYPES));
const runtimeConfig = loadEnvironment();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: runtimeConfig.uploadMaxBytes }, fileFilter: (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const valid = extensions.has(extension) && MIME_TYPES[extension].has(file.mimetype);
  cb(valid ? null : new Error('Unsupported invoice file.'), valid);
} });
const analysisLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many invoice analysis requests. Please try again later.' } });
router.use(requireAuthentication);
router.post('/analyze', analysisLimiter, upload.single('invoice'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Select an invoice image or PDF first.' });
  if (!validateInvoiceFile(req.file)) return res.status(400).json({ error: 'Invoice file content does not match its declared type.' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  try {
    const isPdf = ext === '.pdf';
    const text = isPdf ? await extractPdfText(req.file.buffer) : '';
    let fields;
    let source = 'fallback';
    let fallbackReason = null;
    try {
      const images = isPdf && !text.trim() ? await renderPdfPages(req.file.buffer) : undefined;
      fields = await analyzeInvoiceWithGemini({ buffer: req.file.buffer, mimeType: req.file.mimetype, text: isPdf && text.trim() ? text : undefined, images });
      source = 'ai';
    } catch (aiError) {
      fallbackReason = aiError.code || 'AI_UNAVAILABLE';
      let fallbackText = text;
      if (!fallbackText && isPdf) {
        const pages = await renderPdfPages(req.file.buffer);
        fallbackText = (await Promise.all(pages.map((page) => recognizeInvoiceText(page)))).join('\n');
      }
      if (!fallbackText) fallbackText = await recognizeInvoiceText(['.heic', '.heif'].includes(ext) ? await convertHeic({ buffer: req.file.buffer, format: 'JPEG', quality: 0.9 }) : req.file.buffer);
      fields = extractInvoiceFields(fallbackText);
    }
    fields = cleanDetectedFields(fields);
    const found = Object.values(fields).filter(Boolean).length;
    const analysis_method = source === 'ai' ? 'gemini' : isPdf ? 'pdf_text_fallback' : 'ocr_fallback';
    const message = 'Invoice scanning may not detect all information correctly. Please review all detected values and make sure the purchase date, warranty duration, and warranty unit are entered correctly before saving.';
    return res.json({ status: found ? 'success' : 'no_data', analysis_method, fallback_reason: fallbackReason, fields, message });
  } catch (error) { console.error('Invoice analysis failed:', error.code || error.name); return res.status(422).json({ error: ext === '.pdf' ? 'This PDF could not be read. Please upload a valid text-based PDF.' : 'This image could not be read. Please use a clear JPG or PNG invoice.' }); }
});
router.use((error, req, res, next) => error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? res.status(400).json({ error: `Invoice file must be ${Math.floor(runtimeConfig.uploadMaxBytes / (1024 * 1024))} MB or smaller.` }) : error ? res.status(400).json({ error: 'Invoice must be a supported image format or PDF file.' }) : next());
module.exports = router;
