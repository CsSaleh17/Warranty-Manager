const fs = require('fs');
const path = require('path');
const { loadEnvironment } = require('../src/config/environment');

const production = {
  NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(64),
  DB_HOST: 'gateway01.us-west-2.prod.aws.tidbcloud.com', DB_PORT: '4000',
  DB_USER: 'staging_user', DB_PASSWORD: 'strong-db-password', DB_NAME: 'test',
  DB_SSL_MODE: 'verify_identity', DB_CONNECTION_LIMIT: '2',
  DB_ENABLE_KEEP_ALIVE: 'false', DB_POOL_MAX_IDLE: '0', DB_POOL_IDLE_TIMEOUT_MS: '60000',
  FRONTEND_ORIGINS: 'https://warranty.example', FRONTEND_URL: 'https://warranty.example',
  UPLOAD_DIRECTORY: '/var/lib/warranty-manager/uploads', TRUST_PROXY: '1',
  SMTP_HOST: 'smtp.example', SMTP_FROM: 'Warranty <no-reply@example.com>',
};

describe('TiDB Cloud Starter compatibility contract', () => {
  it('accepts a TLS-protected public TiDB endpoint with a small pool', () => {
    const config = loadEnvironment(production);
    expect(config.db).toEqual(expect.objectContaining({
      host: production.DB_HOST, port: 4000, sslMode: 'verify_identity', connectionLimit: 2,
      enableKeepAlive: false, maxIdle: 0, idleTimeout: 60000,
    }));
  });

  it('wires the TiDB-safe pool settings into mysql2', () => {
    const databaseConfig = fs.readFileSync(path.resolve(__dirname, '../src/config/database.js'), 'utf8');
    expect(databaseConfig).toContain('enableKeepAlive: config.db.enableKeepAlive');
    expect(databaseConfig).toContain('maxIdle: config.db.maxIdle');
    expect(databaseConfig).toContain('idleTimeout: config.db.idleTimeout');
  });

  it('keeps the schema within the MySQL-compatible features used by TiDB', () => {
    const schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
    expect(schema).toContain('DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    expect(schema).toContain('FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
    expect(schema).not.toMatch(/\b(TRIGGER|PROCEDURE|FUNCTION|EVENT|FULLTEXT|SPATIAL|XA)\b/i);
  });

  it('uses TiDB-supported session upsert, JSON, and date functions', () => {
    const sessionStore = fs.readFileSync(path.resolve(__dirname, '../src/services/mysqlSessionStore.js'), 'utf8');
    const passwordReset = fs.readFileSync(path.resolve(__dirname, '../src/routes/passwordReset.js'), 'utf8');
    const reminders = fs.readFileSync(path.resolve(__dirname, '../src/services/reminders.js'), 'utf8');
    expect(sessionStore).toContain('ON DUPLICATE KEY UPDATE');
    expect(passwordReset).toContain('JSON_UNQUOTE(JSON_EXTRACT(');
    expect(passwordReset).toContain('DATE_ADD(NOW(), INTERVAL 30 MINUTE)');
    expect(reminders).toContain('DATE_SUB(p.expiration_date, INTERVAL p.reminder_days_before DAY)');
  });
});
