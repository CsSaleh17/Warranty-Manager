const express = require('express');
const path = require('path');
const multer = require('multer');
const { recognize } = require('tesseract.js');
const convertHeic = require('heic-convert');
const pdf = require('pdf-parse');
const requireAuthentication = require('../middleware/requireAuthentication');
const { extractInvoiceFields } = require('../services/invoiceExtraction');
const router = express.Router();
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.pdf']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const valid = extensions.has(path.extname(file.originalname).toLowerCase()) && (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'));
  cb(valid ? null : new Error('Unsupported invoice file.'), valid);
} });
router.use(requireAuthentication);
router.post('/analyze', upload.single('invoice'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Select an invoice image or PDF first.' });
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const text = ext === '.pdf' ? (await pdf(req.file.buffer)).text : (await recognize(['.heic', '.heif'].includes(ext) ? await convertHeic({ buffer: req.file.buffer, format: 'JPEG', quality: 0.9 }) : req.file.buffer, 'eng')).data.text;
    const fields = extractInvoiceFields(text);
    const found = Object.values(fields).filter(Boolean).length;
    return res.json({ fields, message: found ? 'Invoice analysis completed. Review detected values before saving.' : 'No supported invoice information could be extracted. Please enter it manually.' });
  } catch { return res.status(422).json({ error: 'The invoice could not be analyzed. Please use a clear supported file.' }); }
});
router.use((error, req, res, next) => error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? res.status(400).json({ error: 'Invoice file must be 10 MB or smaller.' }) : error ? res.status(400).json({ error: 'Invoice must be a supported image format or PDF file.' }) : next());
module.exports = router;
