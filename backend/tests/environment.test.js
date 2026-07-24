const { loadEnvironment } = require('../src/config/environment');

const production = {
  NODE_ENV: 'production', PORT: '3000', SESSION_SECRET: 'a'.repeat(64),
  DB_HOST: 'db.internal', DB_PORT: '3306', DB_USER: 'app', DB_PASSWORD: 'strong-db-password', DB_NAME: 'warranty_managers',
  FRONTEND_ORIGINS: 'https://warranty.example', FRONTEND_URL: 'https://warranty.example',
  UPLOAD_DIRECTORY: '/var/lib/warranty-manager/uploads', TRUST_PROXY: '1',
  SMTP_HOST: 'smtp.example', SMTP_FROM: 'Warranty <no-reply@example.com>',
};

describe('environment validation', () => {
  it('parses a complete production configuration with explicit booleans and numbers', () => {
    const config = loadEnvironment(production);
    expect(config).toEqual(expect.objectContaining({ nodeEnv: 'production', port: 3000, isProduction: true, trustProxy: 1, secureCookies: true, uploadMaxBytes: 10 * 1024 * 1024 }));
    expect([...config.allowedOrigins]).toEqual(['https://warranty.example']);
  });

  it.each(['SESSION_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'FRONTEND_ORIGINS', 'UPLOAD_DIRECTORY', 'SMTP_HOST', 'SMTP_FROM'])('rejects missing production %s', (name) => {
    const values = { ...production }; delete values[name];
    expect(() => loadEnvironment(values)).toThrow(name);
  });

  it.each(['changeme', 'password', 'development-secret', 'short'])('rejects weak or placeholder production session secrets', (secret) => {
    expect(() => loadEnvironment({ ...production, SESSION_SECRET: secret })).toThrow('SESSION_SECRET');
  });

  it.each(['https://good.example/path', 'https://user@good.example', 'https://*.example', 'https://good.example?x=1'])('rejects non-origin allowlist value %s', (origin) => {
    expect(() => loadEnvironment({ ...production, FRONTEND_ORIGINS: origin })).toThrow('FRONTEND_ORIGINS');
  });

  it('keeps development convenient and parses false explicitly', () => {
    const config = loadEnvironment({ NODE_ENV: 'development', SESSION_SECRET: 'test-secret', TRUST_PROXY: 'false', REMINDER_SCHEDULER_ENABLED: 'false' });
    expect(config.trustProxy).toBe(false);
    expect(config.reminderSchedulerEnabled).toBe(false);
    expect(config.secureCookies).toBe(false);
  });

  it('fails fast when multi-instance mode would use an in-memory rate-limit store', () => {
    expect(() => loadEnvironment({ ...production, MULTI_INSTANCE: 'true', RATE_LIMIT_STORE: 'memory' })).toThrow('shared rate-limit adapter');
    expect(() => loadEnvironment({ ...production, MULTI_INSTANCE: 'true', RATE_LIMIT_STORE: 'shared' })).toThrow('shared rate-limit adapter');
  });
});
