const path = require('path');

const MIME_TYPES = {
  '.jpg': new Set(['image/jpeg']),
  '.jpeg': new Set(['image/jpeg']),
  '.png': new Set(['image/png']),
  '.webp': new Set(['image/webp']),
  '.heic': new Set(['image/heic', 'image/heif']),
  '.heif': new Set(['image/heic', 'image/heif']),
  '.avif': new Set(['image/avif']),
  '.gif': new Set(['image/gif']),
  '.bmp': new Set(['image/bmp', 'image/x-ms-bmp']),
  '.tif': new Set(['image/tiff']),
  '.tiff': new Set(['image/tiff']),
  '.pdf': new Set(['application/pdf']),
};

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function hasIsoBrand(buffer, brands) {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const header = buffer.toString('ascii', 8, Math.min(buffer.length, 64));
  return brands.some((brand) => header.includes(brand));
}

function contentMatchesExtension(buffer, extension) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (['.jpg', '.jpeg'].includes(extension)) return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (extension === '.png') return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (extension === '.bmp') return buffer.subarray(0, 2).toString('ascii') === 'BM';
  if (['.tif', '.tiff'].includes(extension)) return startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a]);
  if (extension === '.webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (['.heic', '.heif'].includes(extension)) return hasIsoBrand(buffer, ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1']);
  if (extension === '.avif') return hasIsoBrand(buffer, ['avif', 'avis']);
  return false;
}

function validateInvoiceFile({ originalname, mimetype, buffer }) {
  const extension = path.extname(originalname || '').toLowerCase();
  return Boolean(MIME_TYPES[extension]?.has(mimetype) && contentMatchesExtension(buffer, extension));
}

module.exports = { MIME_TYPES, validateInvoiceFile };
