const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const { readDeploymentContext, assertDatabaseMutationAllowed } = require('./deploymentSafety');
const { restoreFileBackup } = require('./fileBackup');
const { cliOption } = require('./cliOptions');

try {
  const context = readDeploymentContext();
  assertDatabaseMutationAllowed(context, 'file-restore');
  const backup = cliOption('file-backup-directory') || process.env.FILE_BACKUP_DIRECTORY?.trim();
  const destination = cliOption('file-restore-directory') || process.env.FILE_RESTORE_DIRECTORY?.trim();
  if (!backup || !path.isAbsolute(backup) || !destination || !path.isAbsolute(destination)) throw new Error('FILE_BACKUP_DIRECTORY and FILE_RESTORE_DIRECTORY must be absolute paths.');
  const result = restoreFileBackup({ backup, destination });
  console.log(JSON.stringify({ type: 'file_restore', status: 'complete', environment: context.environment, ...result }));
} catch (error) {
  console.error(JSON.stringify({ type: 'file_restore', status: 'failed', code: error.code || error.name, message: error.message }));
  process.exitCode = 1;
}
