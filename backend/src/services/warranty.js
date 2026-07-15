const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function calculateWarranty(purchaseDate, warrantyDuration, warrantyUnit, now = new Date()) {
  const expirationDate = parseDate(purchaseDate);
  if (!expirationDate) {
    return null;
  }

  if (warrantyUnit === 'days') expirationDate.setUTCDate(expirationDate.getUTCDate() + warrantyDuration);
  if (warrantyUnit === 'months') expirationDate.setUTCMonth(expirationDate.getUTCMonth() + warrantyDuration);
  if (warrantyUnit === 'years') expirationDate.setUTCFullYear(expirationDate.getUTCFullYear() + warrantyDuration);

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const remainingWarrantyDays = Math.ceil((expirationDate.getTime() - today.getTime()) / DAY_IN_MILLISECONDS);
  const warrantyStatus = remainingWarrantyDays < 0 ? 'Expired'
    : remainingWarrantyDays <= 30 ? 'Expiring Soon'
      : 'Active';

  return { expirationDate: formatDate(expirationDate), remainingWarrantyDays, warrantyStatus };
}

function getWarrantyStatus(expirationDate, now = new Date()) {
  const parsedExpirationDate = parseDate(expirationDate);
  if (!parsedExpirationDate) return { remainingWarrantyDays: null, warrantyStatus: 'Unknown' };

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const remainingWarrantyDays = Math.ceil((parsedExpirationDate.getTime() - today.getTime()) / DAY_IN_MILLISECONDS);
  return {
    remainingWarrantyDays,
    warrantyStatus: remainingWarrantyDays < 0 ? 'Expired' : remainingWarrantyDays <= 30 ? 'Expiring Soon' : 'Active',
  };
}

module.exports = { calculateWarranty, getWarrantyStatus, parseDate };
