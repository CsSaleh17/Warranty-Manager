const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { loadEnvironment } = require('./config/environment');
const { readDeploymentContext, assertIsolatedRestoreTarget } = require('./deploymentSafety');
const { cliOption } = require('./cliOptions');

async function main() {
  const context = readDeploymentContext();
  const restoreName = assertIsolatedRestoreTarget(context, { ...process.env, RESTORE_DB_NAME: cliOption('restore-db') || process.env.RESTORE_DB_NAME, RESTORE_DATABASE_CONFIRMED: process.argv.includes('--confirm-restore') ? 'true' : process.env.RESTORE_DATABASE_CONFIRMED });
  if (!/^[A-Za-z0-9_]+$/.test(restoreName)) throw new Error('RESTORE_DB_NAME may contain only letters, numbers, and underscores.');
  const config = loadEnvironment();
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  if (!rootPassword) throw new Error('MYSQL_ROOT_PASSWORD is required to create an isolated local restore database.');
  const connection = await mysql.createConnection({ host: config.db.host, port: config.db.port, user: 'root', password: rootPassword, connectTimeout: config.db.connectTimeout });
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) AS present FROM information_schema.schemata WHERE schema_name = ?', [restoreName]);
    if (Number(rows[0]?.present) !== 0) throw new Error('The isolated restore database already exists; refusing to reuse it.');
    await connection.query(`CREATE DATABASE \`${restoreName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(JSON.stringify({ type: 'restore_database_creation', status: 'complete', database: restoreName }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'restore_database_creation', status: 'failed', code: error.code || error.name, message: error.code ? undefined : error.message }));
  process.exitCode = 1;
});
