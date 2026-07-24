const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileBackup, verifyFileBackup, restoreFileBackup } = require('../src/fileBackup');

describe('private-file backup', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'warranty-backup-test-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('copies private files and verifies their hashes', () => {
    const source = path.join(root, 'uploads');
    const destination = path.join(root, 'backup');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'invoice.pdf'), 'safe-test-content');
    expect(createFileBackup({ source, destination }).files).toBe(1);
    expect(verifyFileBackup(destination)).toEqual(expect.objectContaining({ status: 'ok', files: 1 }));
  });

  it('refuses to overwrite a backup and detects changed content', () => {
    const source = path.join(root, 'uploads');
    const destination = path.join(root, 'backup');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'invoice.pdf'), 'original');
    createFileBackup({ source, destination });
    expect(() => createFileBackup({ source, destination })).toThrow('already exists');
    fs.writeFileSync(path.join(destination, 'files', 'invoice.pdf'), 'altered!');
    expect(() => verifyFileBackup(destination)).toThrow('hash');
  });

  it('restores a verified backup only into a new isolated directory', () => {
    const source = path.join(root, 'uploads');
    const backup = path.join(root, 'backup');
    const restore = path.join(root, 'restore');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'invoice.pdf'), 'restorable');
    createFileBackup({ source, destination: backup });
    expect(restoreFileBackup({ backup, destination: restore })).toEqual({ files: 1, bytes: 10 });
    expect(fs.readFileSync(path.join(restore, 'invoice.pdf'), 'utf8')).toBe('restorable');
    expect(() => restoreFileBackup({ backup, destination: restore })).toThrow('already exists');
  });
});
