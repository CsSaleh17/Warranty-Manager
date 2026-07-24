const CATEGORIES = ['Smartphones', 'Laptops', 'Tablets', 'Televisions and Screens', 'Gaming Devices', 'Cameras', 'Home Appliances', 'Kitchen Appliances', 'Accessories', 'Furniture', 'Automotive Products', 'Other'];

const aliases = new Map([
  ['smartphone', 'Smartphones'], ['smartphones', 'Smartphones'], ['phone', 'Smartphones'],
  ['laptop', 'Laptops'], ['laptops', 'Laptops'], ['tablet', 'Tablets'], ['tablets', 'Tablets'],
  ['camera', 'Cameras'], ['cameras', 'Cameras'], ['accessory', 'Accessories'], ['accessories', 'Accessories'],
]);

function normalizeCategory(value) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (!cleaned) return '';
  return aliases.get(cleaned.toLowerCase()) || (CATEGORIES.includes(cleaned) ? cleaned : 'Other');
}

function cleanStoreName(value) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned.replace(/^\s*(?:(?:store\s+)?name|store|اسم\s+المتجر|المتجر)\s*:\s*/i, '').trim();
}

module.exports = { CATEGORIES, normalizeCategory, cleanStoreName };
