const nodemailer = require('nodemailer');
const { loadEnvironment } = require('../config/environment');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
class EmailDeliveryError extends Error { constructor(code, retryable = false) { super(code); this.name = 'EmailDeliveryError'; this.code = code; this.retryable = retryable; } }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function createEmailService({ config = loadEnvironment(), fetch = global.fetch, nodemailer: mailer = nodemailer, sleep: wait = sleep } = {}) {
  const { email, smtp } = config;
  if (!email || !['smtp', 'https_api'].includes(email.provider)) throw new Error('EMAIL_PROVIDER must be smtp or https_api.');
  if (email.provider === 'https_api') { let url; try { url = new URL(email.httpsApiUrl); } catch {} if (!url || url.protocol !== 'https:') throw new Error('HTTPS email API URL must use HTTPS.'); if (!email.httpsApiKey || !email.from) throw new Error('HTTPS email API configuration is required.'); }
  async function send(message) {
    if (!message || !emailPattern.test(message.to || '') || !message.subject || typeof message.text !== 'string') throw new EmailDeliveryError('invalid_message');
    if (email.provider === 'smtp') {
      const transport = mailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, requireTLS: smtp.requireTls, auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
      const result = await transport.sendMail({ from: smtp.from, to: message.to, subject: message.subject, text: message.text });
      if ((!Array.isArray(result.accepted) || !result.accepted.includes(message.to)) && !result.messageId) throw new EmailDeliveryError('provider_rejected');
      return { provider: 'smtp', id: result.messageId || 'accepted' };
    }
    for (let attempt = 0; attempt <= email.httpsMaxRetries; attempt += 1) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), email.httpsTimeoutMs);
      try {
        const response = await fetch(email.httpsApiUrl, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${email.httpsApiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'warranty-manager/1.0', ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}) }, body: JSON.stringify({ from: email.from, to: [message.to], subject: message.subject, text: message.text }) });
        const body = await response.json().catch(() => ({}));
        if (response.ok && typeof body.id === 'string' && body.id) return { provider: 'https_api', id: body.id };
        if (!(response.status === 429 || response.status >= 500)) throw new EmailDeliveryError('provider_rejected');
        if (attempt === email.httpsMaxRetries) throw new EmailDeliveryError('provider_unavailable', true);
      } catch (error) { if (error instanceof EmailDeliveryError) throw error; if (attempt === email.httpsMaxRetries) throw new EmailDeliveryError(error?.name === 'AbortError' ? 'timeout' : 'network_failure', true); } finally { clearTimeout(timer); }
      await wait(100 * (attempt + 1));
    }
  }
  return { send };
}
const sendEmail = (message) => createEmailService().send(message);
module.exports = { createEmailService, sendEmail, EmailDeliveryError };
