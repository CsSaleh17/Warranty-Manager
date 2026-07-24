const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { loadEnvironment } = require('./config/environment');
const { readDeploymentContext, assertDatabaseMutationAllowed } = require('./deploymentSafety');
const { createFileBackup } = require('./fileBackup');
const { cliOption } = require('./cliOptions');

try {
  const context = readDeploymentContext();
  assertDatabaseMutationAllowed(context, 'file-backup');
  const destination = cliOption('file-backup-directory') || process.env.FILE_BACKUP_DIRECTORY?.trim();
  if (!destination || !path.isAbsolute(destination)) throw new Error('FILE_BACKUP_DIRECTORY must be a new absolute directory path.');
  const result = createFileBackup({ source: loadEnvironment().uploadDirectory, destination });
  console.log(JSON.stringify({ type: 'file_backup', status: 'complete', environment: context.environment, ...result }));
} catch (error) {
  console.error(JSON.stringify({ type: 'file_backup', status: 'failed', code: error.code || error.name, message: error.message }));
  process.exitCode = 1;
}
