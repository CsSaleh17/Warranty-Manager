const crypto = require('crypto');
const nodemailer = require('nodemailer');
const database = require('../config/database');
const { loadEnvironment } = require('../config/environment');

function transport() {
  const config = loadEnvironment();
  return nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, requireTLS: config.smtp.requireTls,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
}

function reminderMessage(row) {
  const date = String(row.expiration_date).slice(0, 10);
  const remainingDays = Math.max(0, Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.now()) / 86400000));
  const detailsUrl = `${loadEnvironment().frontendUrl}/products/${row.id}`;
  const lines = [`Your warranty for ${row.name} expires on ${date}.`, `Remaining days: ${remainingDays}.`];
  if (row.store_name) lines.push(`Store: ${row.store_name}.`);
  if (row.category) lines.push(`Category: ${row.category}.`);
  if (row.serial_number) lines.push(`Serial number: ${row.serial_number}.`);
  lines.push(`View product details: ${detailsUrl}`);
  return lines.join('\n');
}

async function runDueReminders() {
  const [rows] = await database.execute(`SELECT p.id,p.name,p.category,p.store_name,p.serial_number,p.expiration_date,p.reminder_days_before,u.email
    FROM products p JOIN users u ON u.id = p.user_id
    WHERE p.reminder_enabled = 1 AND p.is_reminded = 0 AND p.reminder_sent_at IS NULL
      AND p.expiration_date >= CURDATE() AND DATE_SUB(p.expiration_date, INTERVAL p.reminder_days_before DAY) <= CURDATE()
      AND (p.reminder_claim_token IS NULL OR p.reminder_claimed_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE))`);
  const mailer = transport();
  let sent = 0;
  for (const row of rows) {
    const claimToken = crypto.randomUUID();
    try {
      const [claim] = await database.execute(`UPDATE products SET reminder_claim_token = ?, reminder_claimed_at = NOW()
        WHERE id = ? AND reminder_enabled = 1 AND is_reminded = 0 AND reminder_sent_at IS NULL
          AND (reminder_claim_token IS NULL OR reminder_claimed_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE))`, [claimToken, row.id]);
      if (!claim.affectedRows) continue;
      try {
        await mailer.sendMail({ from: loadEnvironment().smtp.from, to: row.email, subject: `Warranty reminder: ${row.name}`, text: reminderMessage(row) });
        const [complete] = await database.execute('UPDATE products SET is_reminded = 1, reminder_sent_at = NOW(), reminder_claim_token = NULL, reminder_claimed_at = NULL WHERE id = ? AND reminder_claim_token = ?', [row.id, claimToken]);
        if (complete.affectedRows) sent += 1;
      } catch (error) {
        await database.execute('UPDATE products SET reminder_claim_token = NULL, reminder_claimed_at = NULL WHERE id = ? AND reminder_claim_token = ?', [row.id, claimToken]);
        console.error('Warranty reminder delivery failed:', error?.code || error?.name);
      }
    } catch (error) { console.error('Warranty reminder processing failed:', error?.code || error?.name); }
  }
  return { processed: rows.length, sent };
}

module.exports = { runDueReminders, reminderMessage };
