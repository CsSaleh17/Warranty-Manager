const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { loadEnvironment } = require('./config/environment');
const { readDeploymentContext, assertIsolatedRestoreTarget } = require('./deploymentSafety');
const { mysqlClientInvocation } = require('./mysqlCommand');
const { cliOption } = require('./cliOptions');

function main() {
  const config = loadEnvironment();
  const context = readDeploymentContext();
  const restoreDatabase = assertIsolatedRestoreTarget(context, { ...process.env, RESTORE_DB_NAME: cliOption('restore-db') || process.env.RESTORE_DB_NAME, RESTORE_DATABASE_CONFIRMED: process.argv.includes('--confirm-restore') ? 'true' : process.env.RESTORE_DATABASE_CONFIRMED });
  const backupFile = cliOption('backup-file') || process.env.BACKUP_FILE?.trim();
  if (!backupFile || !path.isAbsolute(backupFile) || !fs.statSync(backupFile).isFile()) throw new Error('BACKUP_FILE must identify an existing absolute SQL backup.');
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD;
  if (!rootPassword) throw new Error('MYSQL_ROOT_PASSWORD is required for isolated restore verification.');
  const descriptor = fs.openSync(backupFile, 'r');
  const container = cliOption('mysql-client-container') || process.env.MYSQL_CLIENT_CONTAINER?.trim();
  const invocation = mysqlClientInvocation({ program: 'mysql', db: { ...config.db, user: 'root' }, database: restoreDatabase, container, interactive: true, options: ['--default-character-set=utf8mb4'] });
  const result = spawnSync(invocation.command, invocation.args, {
    env: { ...process.env, MYSQL_PWD: rootPassword }, stdio: [descriptor, 'pipe', 'pipe'], encoding: 'utf8'
  });
  fs.closeSync(descriptor);
  if (result.error || result.status !== 0) throw result.error || new Error(`mysql restore exited with code ${result.status}.`);
  console.log(JSON.stringify({ type: 'database_restore', status: 'complete', environment: context.environment, database: restoreDatabase }));
}

try { main(); } catch (error) {
  console.error(JSON.stringify({ type: 'database_restore', status: 'failed', code: error.code || error.name, message: error.message }));
  process.exitCode = 1;
}
