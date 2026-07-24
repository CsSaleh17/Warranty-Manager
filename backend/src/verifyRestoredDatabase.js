const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { loadEnvironment } = require('./config/environment');
const { readDeploymentContext, assertIsolatedRestoreTarget } = require('./deploymentSafety');
const { inspectDatabase } = require('./databaseDeployment');
const { cliOption } = require('./cliOptions');

async function counts(connection) {
  const [rows] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM sessions) AS sessions,
    (SELECT COUNT(*) FROM password_reset_tokens) AS reset_tokens,
    (SELECT COUNT(*) FROM schema_migrations) AS migrations`);
  return rows[0];
}

async function main() {
  const context = readDeploymentContext();
  const restoreName = assertIsolatedRestoreTarget(context, { ...process.env, RESTORE_DB_NAME: cliOption('restore-db') || process.env.RESTORE_DB_NAME, RESTORE_DATABASE_CONFIRMED: process.argv.includes('--confirm-restore') ? 'true' : process.env.RESTORE_DATABASE_CONFIRMED });
  const config = loadEnvironment();
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  if (!rootPassword) throw new Error('MYSQL_ROOT_PASSWORD is required for isolated restore verification.');
  const connectionOptions = { host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, charset: 'utf8mb4', connectTimeout: config.db.connectTimeout };
  const source = await mysql.createConnection({ ...connectionOptions, database: config.db.name });
  const restored = await mysql.createConnection({ ...connectionOptions, user: 'root', password: rootPassword, database: restoreName });
  try {
    const inspection = await inspectDatabase(restored);
    if (inspection.status !== 'ok') throw new Error('Restored database schema inspection failed.');
    const sourceCounts = await counts(source);
    const restoredCounts = await counts(restored);
    if (JSON.stringify(sourceCounts) !== JSON.stringify(restoredCounts)) throw new Error('Restored database row counts do not match the source backup.');
    console.log(JSON.stringify({ type: 'database_restore_verification', status: 'ok', source: context.databaseName, restored: restoreName, schema: inspection.counts, rows: restoredCounts }));
  } finally {
    await Promise.all([source.end(), restored.end()]);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'database_restore_verification', status: 'failed', code: error.code || error.name, message: error.code ? undefined : error.message }));
  process.exitCode = 1;
});
