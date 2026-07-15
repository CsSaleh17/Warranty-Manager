const express = require('express');
const bcrypt = require('bcrypt');
const database = require('../config/database');
const requireAuthentication = require('../middleware/requireAuthentication');

const router = express.Router();
router.use(requireAuthentication);

function validName(fullName) {
  const value = typeof fullName === 'string' ? fullName.trim() : '';
  return value.length >= 2 && value.length <= 100 ? value : null;
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await database.execute('SELECT full_name, email, created_at FROM users WHERE id = ?', [req.session.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found.' });
    const user = rows[0];
    return res.json({ success: true, data: { fullName: user.full_name, email: user.email, createdAt: user.created_at } });
  } catch { return res.status(500).json({ error: 'Unable to load profile.' }); }
});

router.put('/', async (req, res) => {
  const fullName = validName(req.body.fullName);
  if (!fullName) return res.status(400).json({ errors: { fullName: 'Full name must be between 2 and 100 characters.' } });
  try {
    await database.execute('UPDATE users SET full_name = ? WHERE id = ?', [fullName, req.session.user.id]);
    req.session.user.fullName = fullName;
    return res.json({ message: 'Profile updated successfully.', user: req.session.user });
  } catch { return res.status(500).json({ error: 'Unable to update profile.' }); }
});

router.put('/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const errors = {};
  if (typeof currentPassword !== 'string' || !currentPassword) errors.currentPassword = 'Current password is required.';
  if (typeof newPassword !== 'string' || newPassword.length < 8) errors.newPassword = 'New password must be at least 8 characters.';
  if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  try {
    const [rows] = await database.execute('SELECT password_hash FROM users WHERE id = ?', [req.session.user.id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) return res.status(400).json({ errors: { currentPassword: 'Current password is incorrect.' } });
    const hash = await bcrypt.hash(newPassword, 12);
    await database.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.session.user.id]);
    return res.json({ message: 'Password updated successfully.' });
  } catch { return res.status(500).json({ error: 'Unable to update password.' }); }
});

module.exports = router;
