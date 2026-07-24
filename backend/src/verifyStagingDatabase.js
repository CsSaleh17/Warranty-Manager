const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const database = require('./config/database');
const { readDeploymentContext, assertDatabaseMutationAllowed } = require('./deploymentSafety');
const { inspectDatabase } = require('./databaseDeployment');

async function main() {
  const context = readDeploymentContext();
  if (context.environment !== 'staging') throw new Error('Database behavior verification is restricted to staging.');
  assertDatabaseMutationAllowed(context, 'verify');
  const connection = await database.getConnection();
  try {
    const inspection = await inspectDatabase(connection);
    if (inspection.status !== 'ok') throw new Error('Staging schema inspection is incomplete.');
    const [charsetRows] = await connection.execute('SELECT @@character_set_database AS charset_name, @@collation_database AS collation_name');
    if (!String(charsetRows[0]?.charset_name).startsWith('utf8mb4')) throw new Error('Staging database does not use utf8mb4.');
    const marker = crypto.randomUUID();
    const email = `staging-${marker}@example.invalid`;
    const tokenHash = crypto.createHash('sha256').update(marker).digest('hex');
    await connection.beginTransaction();
    try {
      const [userResult] = await connection.execute('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)', ['مستخدم اختبار مرحلي', email, '$2b$12$stagingVerificationOnly']);
      const [userRows] = await connection.execute('SELECT full_name FROM users WHERE id = ?', [userResult.insertId]);
      if (userRows[0]?.full_name !== 'مستخدم اختبار مرحلي') throw new Error('Arabic and Unicode round-trip verification failed.');
      await connection.execute(`INSERT INTO products
        (user_id, name, category, store_name, purchase_date, warranty_duration, warranty_unit, expiration_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userResult.insertId, 'جهاز اختبار', 'Other', 'متجر اختبار', '2026-01-01', 1, 'years', '2027-01-01', 'بيانات مؤقتة']);
      await connection.execute('INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 10 MINUTE))', [`staging-${marker}`, JSON.stringify({ user: { id: userResult.insertId, name: 'مستخدم اختبار مرحلي' } })]);
      await connection.execute('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [userResult.insertId, tokenHash]);
      const [firstUse] = await connection.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [tokenHash]);
      const [replay] = await connection.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [tokenHash]);
      if (firstUse.affectedRows !== 1 || replay.affectedRows !== 0) throw new Error('Password-reset single-use verification failed.');
    } finally {
      await connection.rollback();
    }
    console.log(JSON.stringify({ type: 'staging_database_verification', status: 'ok', database: context.databaseName, checks: ['schema', 'utf8mb4', 'arabic_round_trip', 'session_row', 'reset_single_use', 'transaction_rollback'] }));
  } finally {
    connection.release();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'staging_database_verification', status: 'failed', code: error.code || error.name, message: error.code ? undefined : error.message }));
  process.exitCode = 1;
}).finally(() => database.end());
