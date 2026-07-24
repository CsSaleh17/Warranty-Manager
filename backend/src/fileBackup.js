const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function collectFiles(root, directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported in private-file backups: ${entry.name}`);
    if (entry.isDirectory()) return collectFiles(root, fullPath);
    return entry.isFile() ? [path.relative(root, fullPath)] : [];
  });
}

function assertSeparatePaths(source, destination) {
  const sourcePath = path.resolve(source);
  const destinationPath = path.resolve(destination);
  const separator = path.sep;
  if (sourcePath === destinationPath || destinationPath.startsWith(`${sourcePath}${separator}`) || sourcePath.startsWith(`${destinationPath}${separator}`)) {
    throw new Error('Backup source and destination must be separate directories.');
  }
  return { sourcePath, destinationPath };
}

function createFileBackup({ source, destination }) {
  const { sourcePath, destinationPath } = assertSeparatePaths(source, destination);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) throw new Error('Private upload source directory does not exist.');
  if (fs.existsSync(destinationPath)) throw new Error('Backup destination already exists; refusing to overwrite it.');
  const relativeFiles = collectFiles(sourcePath);
  fs.mkdirSync(path.join(destinationPath, 'files'), { recursive: true });
  const entries = relativeFiles.map((relativePath) => {
    const sourceFile = path.join(sourcePath, relativePath);
    const destinationFile = path.join(destinationPath, 'files', relativePath);
    fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
    fs.copyFileSync(sourceFile, destinationFile, fs.constants.COPYFILE_EXCL);
    return { path: relativePath.replaceAll(path.sep, '/'), bytes: fs.statSync(sourceFile).size, sha256: hashFile(sourceFile) };
  });
  const manifest = { format: 1, createdAt: new Date().toISOString(), files: entries };
  fs.writeFileSync(path.join(destinationPath, 'backup-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { files: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) };
}

function verifyFileBackup(destination) {
  const destinationPath = path.resolve(destination);
  const manifestPath = path.join(destinationPath, 'backup-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Backup manifest is missing.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 1 || !Array.isArray(manifest.files)) throw new Error('Backup manifest format is invalid.');
  let bytes = 0;
  for (const entry of manifest.files) {
    const normalized = path.normalize(entry.path);
    if (path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`) || normalized === '..') throw new Error('Backup manifest contains an unsafe path.');
    const filePath = path.join(destinationPath, 'files', normalized);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size !== entry.bytes) throw new Error(`Backup file size verification failed: ${entry.path}`);
    if (hashFile(filePath) !== entry.sha256) throw new Error(`Backup file hash verification failed: ${entry.path}`);
    bytes += entry.bytes;
  }
  return { status: 'ok', files: manifest.files.length, bytes };
}

function restoreFileBackup({ backup, destination }) {
  const backupPath = path.resolve(backup);
  const destinationPath = path.resolve(destination);
  assertSeparatePaths(backupPath, destinationPath);
  if (fs.existsSync(destinationPath)) throw new Error('Restore destination already exists; refusing to overwrite it.');
  const verification = verifyFileBackup(backupPath);
  const manifest = JSON.parse(fs.readFileSync(path.join(backupPath, 'backup-manifest.json'), 'utf8'));
  fs.mkdirSync(destinationPath, { recursive: true });
  try {
    for (const entry of manifest.files) {
      const relativePath = path.normalize(entry.path);
      const sourceFile = path.join(backupPath, 'files', relativePath);
      const destinationFile = path.join(destinationPath, relativePath);
      fs.mkdirSync(path.dirname(destinationFile), { recursive: true });
      fs.copyFileSync(sourceFile, destinationFile, fs.constants.COPYFILE_EXCL);
    }
  } catch (error) {
    fs.rmSync(destinationPath, { recursive: true, force: true });
    throw error;
  }
  return { files: verification.files, bytes: verification.bytes };
}

module.exports = { createFileBackup, verifyFileBackup, restoreFileBackup };
