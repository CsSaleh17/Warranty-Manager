const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { loadEnvironment } = require('./config/environment');
const { readDeploymentContext, assertDatabaseMutationAllowed } = require('./deploymentSafety');
const { mysqlClientInvocation } = require('./mysqlCommand');
const { cliOption } = require('./cliOptions');

function main() {
  const config = loadEnvironment();
  const context = readDeploymentContext();
  assertDatabaseMutationAllowed(context, 'backup');
  const output = cliOption('backup-file') || process.env.BACKUP_FILE?.trim();
  if (!output || !path.isAbsolute(output) || path.extname(output).toLowerCase() !== '.sql') throw new Error('BACKUP_FILE must be a new absolute .sql path.');
  if (fs.existsSync(output)) throw new Error('BACKUP_FILE already exists; refusing to overwrite it.');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const descriptor = fs.openSync(output, 'wx', 0o600);
  try {
    const container = cliOption('mysql-client-container') || process.env.MYSQL_CLIENT_CONTAINER?.trim();
    const invocation = mysqlClientInvocation({ program: 'mysqldump', db: config.db, database: config.db.name, container, options: ['--single-transaction', '--triggers', '--routines', '--default-character-set=utf8mb4'] });
    const result = spawnSync(invocation.command, invocation.args, {
      env: { ...process.env, MYSQL_PWD: config.db.password },
      stdio: ['ignore', descriptor, 'pipe'],
      encoding: 'utf8'
    });
    if (result.error || result.status !== 0) throw result.error || new Error(`mysqldump exited with code ${result.status}.`);
  } catch (error) {
    fs.closeSync(descriptor);
    fs.rmSync(output, { force: true });
    throw error;
  }
  fs.closeSync(descriptor);
  const bytes = fs.statSync(output).size;
  if (!bytes) { fs.rmSync(output, { force: true }); throw new Error('Database backup was empty.'); }
  console.log(JSON.stringify({ type: 'database_backup', status: 'complete', environment: context.environment, database: context.databaseName, bytes }));
}

try { main(); } catch (error) {
  console.error(JSON.stringify({ type: 'database_backup', status: 'failed', code: error.code || error.name, message: error.message }));
  process.exitCode = 1;
}
