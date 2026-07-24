const fs = require('fs');
const path = require('path');
const { cliOption } = require('./cliOptions');

const backupFile = cliOption('backup-file') || process.env.BACKUP_FILE?.trim();
if (!backupFile || !path.isAbsolute(backupFile)) throw new Error('BACKUP_FILE must be an absolute path.');
const stats = fs.statSync(backupFile);
if (!stats.isFile() || stats.size < 100) throw new Error('Database backup is missing or unexpectedly small.');
const sql = fs.readFileSync(backupFile, 'utf8');
const missing = ['users', 'products', 'password_reset_tokens', 'sessions', 'schema_migrations'].filter((table) => !new RegExp(`(?:CREATE TABLE|INSERT INTO) [^;]*[\u0060]?${table}[\u0060]?`, 'i').test(sql));
if (missing.length) throw new Error(`Database backup is missing required tables: ${missing.join(', ')}.`);
console.log(JSON.stringify({ type: 'database_backup_verification', status: 'ok', bytes: stats.size, tables: 5 }));
