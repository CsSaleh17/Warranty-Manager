const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { loadEnvironment } = require('./config/environment');
const { readDeploymentContext, assertDatabaseMutationAllowed } = require('./deploymentSafety');

async function main() {
  const context = readDeploymentContext();
  if (context.environment !== 'staging') throw new Error('Baseline schema initialization is restricted to staging.');
  assertDatabaseMutationAllowed(context, 'initialize');
  const config = loadEnvironment();
  const ssl = config.db.sslMode === 'disabled' ? undefined : {
    rejectUnauthorized: true,
    ...(config.db.sslCaFile ? { ca: fs.readFileSync(config.db.sslCaFile, 'utf8') } : {}),
  };
  const connection = await mysql.createConnection({
    host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password,
    database: config.db.name, charset: 'utf8mb4', connectTimeout: config.db.connectTimeout,
    multipleStatements: true,
    ssl,
  });
  try {
    const [rows] = await connection.execute("SELECT COUNT(*) AS application_tables FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users', 'products', 'password_reset_tokens', 'sessions', 'schema_migrations')");
    if (Number(rows[0]?.application_tables) !== 0) throw new Error('Staging initialization requires an empty target database.');
    const schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
    if (/\b(?:CREATE DATABASE|USE)\b/i.test(schema)) throw new Error('Baseline schema must not select or create a database.');
    await connection.query(schema);
    console.log(JSON.stringify({ type: 'staging_database_initialization', status: 'complete', database: context.databaseName }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'staging_database_initialization', status: 'failed', code: error.code || error.name, message: error.code ? undefined : error.message }));
  process.exitCode = 1;
});
