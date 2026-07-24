const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const database = require('../config/database');
const auditLogger = require('../services/auditLogger');
const { loadEnvironment } = require('../config/environment');

const router = express.Router();
const DUMMY_PASSWORD_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function validateLogin({ email, password }) {
  const errors = {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }
  if (typeof password !== 'string' || password.length === 0) {
    errors.password = 'Password is required.';
  }

  return { errors, normalizedEmail };
}

function toPublicUser(user) {
  return { id: user.id, fullName: user.full_name, email: user.email };
}

router.post('/login', loginLimiter, async (req, res) => {
  const { errors, normalizedEmail } = validateLogin(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const [users] = await database.execute(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail],
    );
    const user = users[0];
    const passwordMatches = await bcrypt.compare(req.body.password, user?.password_hash || DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      auditLogger.securityEvent('login_failure', { outcome: 'invalid_credentials' });
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const publicUser = toPublicUser(user);
    return req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        return res.status(500).json({ error: 'Unable to start a secure session. Please try again.' });
      }

      req.session.user = publicUser;
      return req.session.save((saveError) => {
        if (saveError) {
          auditLogger.securityEvent('login_error', { userId: user.id, outcome: 'session_save_failed' });
          return res.status(500).json({ error: 'Unable to start a secure session. Please try again.' });
        }
        auditLogger.securityEvent('login_success', { userId: user.id, outcome: 'success' });
        return res.status(200).json({ message: 'Login successful.', user: publicUser });
      });
    });
  } catch {
    auditLogger.securityEvent('login_error', { outcome: 'internal_error' });
    return res.status(500).json({ error: 'Unable to log in. Please try again.' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }
  return res.status(200).json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  const userId = req.session.user?.id;
  req.session.destroy((error) => {
    if (error) {
      auditLogger.securityEvent('logout_failure', { userId, outcome: 'session_destroy_failed' });
      return res.status(500).json({ error: 'Unable to log out. Please try again.' });
    }
    res.clearCookie('warranty.sid', { httpOnly: true, sameSite: 'lax', secure: loadEnvironment().secureCookies, path: '/' });
    auditLogger.securityEvent('logout_success', { userId, outcome: 'success' });
    res.status(200).json({ message: 'Logged out successfully.' });
  });
});

module.exports = router;
