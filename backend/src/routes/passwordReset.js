const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const database = require('../config/database');
const auditLogger = require('../services/auditLogger');
const { loadEnvironment } = require('../config/environment');
const { sendEmail } = require('../services/emailService');

const router = express.Router();
const genericMessage = 'If an account exists for this email, a password reset link has been sent.';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const validPassword = (password) => typeof password === 'string' && password.length >= 8;

// The delivery adapter is deliberately environment-driven. Configure SMTP in deployment;
// development still completes the secure token workflow without exposing the token in API output.
async function sendResetEmail(email, token) {
  const config = loadEnvironment();
  const url = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: email, subject: 'Reset your Warranty Manager password', text: `Use this link to reset your password: ${url}` });
}

router.post('/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: genericMessage } }), async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email)) return res.status(400).json({ errors: { email: 'Enter a valid email address.' } });
  try {
    const [users] = await database.execute('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
    if (users[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      await database.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [users[0].id]);
      await database.execute('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))', [users[0].id, hashToken(token)]);
      try {
        await sendResetEmail(users[0].email, token);
        auditLogger.securityEvent('password_reset_requested', { userId: users[0].id, outcome: 'accepted' });
      } catch {
        auditLogger.securityEvent('password_reset_delivery_failure', { userId: users[0].id, outcome: 'delivery_failed' });
      }
    }
    return res.json({ message: genericMessage });
  } catch { return res.status(500).json({ error: 'Unable to process the password reset request.' }); }
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body || {};
  const errors = {};
  if (typeof token !== 'string' || !token) errors.token = 'This password reset link is invalid or has expired.';
  if (!validPassword(newPassword)) errors.newPassword = 'New password must be at least 8 characters.';
  if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const [result] = await database.execute(
      `UPDATE users u JOIN password_reset_tokens t ON t.user_id = u.id
       LEFT JOIN password_reset_tokens all_tokens ON all_tokens.user_id = u.id AND all_tokens.used_at IS NULL
       LEFT JOIN sessions active_sessions ON JSON_UNQUOTE(JSON_EXTRACT(active_sessions.data, '$.user.id')) = CAST(u.id AS CHAR)
       SET u.password_hash = ?, t.used_at = NOW(), all_tokens.used_at = NOW(), active_sessions.expires_at = NOW()
       WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()`,
      [passwordHash, hashToken(token)],
    );
    if (!result.affectedRows) {
      auditLogger.securityEvent('password_reset_failure', { outcome: 'invalid_token' });
      return res.status(400).json({ errors: { token: 'This password reset link is invalid or has expired.' } });
    }
    auditLogger.securityEvent('password_reset_success', { outcome: 'success' });
    return res.json({ message: 'Your password has been reset. You can now log in with your new password.' });
  } catch { return res.status(500).json({ error: 'Unable to reset password.' }); }
});

module.exports = router;
