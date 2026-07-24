const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const database = require('../config/database');
const auditLogger = require('../services/auditLogger');

const router = express.Router();
const registrationResponse = { message: 'If this email can be registered, the account is ready to use.' };

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

function validateRegistration({ fullName, email, password }) {
  const errors = {};
  const normalizedName = typeof fullName === 'string' ? fullName.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (normalizedName.length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  } else if (normalizedName.length > 100) {
    errors.fullName = 'Full name must be 100 characters or fewer.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return { errors, normalizedName, normalizedEmail };
}

router.post('/', registrationLimiter, async (req, res) => {
  const { errors, normalizedName, normalizedEmail } = validateRegistration(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const [result] = await database.execute(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
      [normalizedName, normalizedEmail, passwordHash],
    );

    auditLogger.securityEvent('registration_success', { userId: result.insertId, outcome: 'created' });
    return res.status(202).json(registrationResponse);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      auditLogger.securityEvent('registration_duplicate', { outcome: 'accepted' });
      return res.status(202).json(registrationResponse);
    }

    auditLogger.securityEvent('registration_failure', { outcome: 'internal_error' });
    return res.status(500).json({ error: 'Unable to create your account. Please try again.' });
  }
});

module.exports = router;
