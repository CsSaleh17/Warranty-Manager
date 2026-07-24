const express = require('express');
const database = require('../config/database');
const requireAuthentication = require('../middleware/requireAuthentication');
const { getWarrantyStatus } = require('../services/warranty');
const { normalizeCategory, cleanStoreName } = require('../services/categories');
const router = express.Router();
router.use(requireAuthentication);
router.get('/', async (req, res) => {
  try {
    const [rows] = await database.execute('SELECT id, name, category, store_name, serial_number, purchase_date, expiration_date FROM products WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
    const products = rows.map((row) => ({ id: row.id, name: row.name, category: normalizeCategory(row.category), storeName: cleanStoreName(row.store_name), serialNumber: row.serial_number, purchaseDate: row.purchase_date, expirationDate: row.expiration_date, ...getWarrantyStatus(row.expiration_date) }));
    const statistics = { total: products.length, active: 0, expiringSoon: 0, expired: 0 };
    products.forEach((product) => { if (product.warrantyStatus === 'Active') statistics.active += 1; if (product.warrantyStatus === 'Expiring Soon') statistics.expiringSoon += 1; if (product.warrantyStatus === 'Expired') statistics.expired += 1; });
    const nearestExpiration = products.filter((product) => product.remainingWarrantyDays >= 0).sort((a, b) => a.remainingWarrantyDays - b.remainingWarrantyDays).slice(0, 5);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase().slice(0, 100) : '';
    const searchResults = search ? products.filter((product) => `${product.name} ${product.storeName} ${product.serialNumber || ''}`.toLowerCase().includes(search)) : [];
    return res.json({ statistics, recentlyAdded: products.slice(0, 5), nearestExpiration, searchResults });
  } catch { return res.status(500).json({ error: 'Unable to load dashboard.' }); }
});
module.exports = router;
