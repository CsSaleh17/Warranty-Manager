const path = require('path');
const { verifyFileBackup } = require('./fileBackup');
const { cliOption } = require('./cliOptions');

try {
  const destination = cliOption('file-backup-directory') || process.env.FILE_BACKUP_DIRECTORY?.trim();
  if (!destination || !path.isAbsolute(destination)) throw new Error('FILE_BACKUP_DIRECTORY must be an absolute directory path.');
  console.log(JSON.stringify({ type: 'file_backup_verification', ...verifyFileBackup(destination) }));
} catch (error) {
  console.error(JSON.stringify({ type: 'file_backup_verification', status: 'failed', code: error.code || error.name, message: error.message }));
  process.exitCode = 1;
}
