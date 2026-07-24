const path = require('path');

const PLACEHOLDERS = /^(changeme|change-me|password|secret|development-secret|default|short|test)$/i;

function integer(name, value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be a whole number between ${min} and ${max}.`);
  return parsed;
}

function boolean(name, value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false".`);
}

function exactOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must contain valid HTTP(S) origins.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || value.includes('*')) {
    throw new Error(`${name} must contain exact origins without paths, credentials, queries, fragments, or wildcards.`);
  }
  return url.origin;
}

function parseOrigins(source, isProduction) {
  const raw = source.FRONTEND_ORIGINS || source.FRONTEND_ORIGIN || (isProduction ? '' : 'http://localhost:5173');
  if (!raw) throw new Error('FRONTEND_ORIGINS is required in production.');
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean).map((value) => exactOrigin(value, 'FRONTEND_ORIGINS'));
  if (!values.length) throw new Error('FRONTEND_ORIGINS must include at least one origin.');
  const allowed = new Set(values);
  if (!isProduction) for (const origin of [...allowed]) { const url = new URL(origin); if (['localhost', '127.0.0.1'].includes(url.hostname)) { const port = url.port ? `:${url.port}` : ''; allowed.add(`${url.protocol}//localhost${port}`); allowed.add(`${url.protocol}//127.0.0.1${port}`); } }
  return allowed;
}

function required(source, name, isProduction) {
  const value = source[name]?.trim();
  if (isProduction && !value) throw new Error(`${name} is required in production.`);
  return value || '';
}

function loadEnvironment(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production.');
  const isProduction = nodeEnv === 'production';
  const sessionSecret = source.SESSION_SECRET || '';
  if (!sessionSecret) throw new Error('SESSION_SECRET is required.');
  if (isProduction && (Buffer.byteLength(sessionSecret, 'utf8') < 32 || PLACEHOLDERS.test(sessionSecret))) throw new Error('SESSION_SECRET must be at least 32 bytes and non-placeholder in production.');
  const trustRaw = source.TRUST_PROXY || 'false';
  const trustProxy = trustRaw === 'false' ? false : integer('TRUST_PROXY', trustRaw, 0, { min: 1, max: 5 });
  const allowedOrigins = parseOrigins(source, isProduction);
  const frontendUrlRaw = source.FRONTEND_URL || [...allowedOrigins][0];
  const frontendUrl = exactOrigin(frontendUrlRaw, 'FRONTEND_URL');
  const uploadRaw = source.UPLOAD_DIRECTORY || path.resolve(__dirname, '../../uploads/invoices');
  if (isProduction && !source.UPLOAD_DIRECTORY) throw new Error('UPLOAD_DIRECTORY is required in production.');
  if (isProduction && !path.isAbsolute(uploadRaw)) throw new Error('UPLOAD_DIRECTORY must be an absolute persistent path in production.');
  const multiInstance = boolean('MULTI_INSTANCE', source.MULTI_INSTANCE, false);
  const frontendBuildRaw = source.FRONTEND_BUILD_DIRECTORY || path.resolve(__dirname, '../../../frontend/dist');
  if (isProduction && !path.isAbsolute(frontendBuildRaw)) throw new Error('FRONTEND_BUILD_DIRECTORY must be absolute in production.');
  const rateLimitStore = source.RATE_LIMIT_STORE || 'memory';
  if (!['memory', 'shared'].includes(rateLimitStore)) throw new Error('RATE_LIMIT_STORE must be memory or shared.');
  if (rateLimitStore === 'shared' || multiInstance) throw new Error('MULTI_INSTANCE requires a shared rate-limit adapter that is not configured in this build.');
  const smtpHost = source.SMTP_HOST?.trim() || '';
  if (isProduction && !smtpHost) throw new Error('SMTP_HOST is required in production because password reset uses email delivery.');
  if (isProduction && !source.SMTP_FROM?.trim()) throw new Error('SMTP_FROM is required in production because password reset uses email delivery.');
  if (smtpHost && !source.SMTP_FROM?.trim()) throw new Error('SMTP_FROM is required when SMTP_HOST is configured.');
  if (Boolean(source.SMTP_USER) !== Boolean(source.SMTP_PASSWORD)) throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together.');
  const sslMode = source.DB_SSL_MODE || 'disabled';
  if (!['disabled', 'required', 'verify_identity'].includes(sslMode)) throw new Error('DB_SSL_MODE must be disabled, required, or verify_identity.');
  return {
    nodeEnv, isProduction, port: integer('PORT', source.PORT, 3000, { min: 1, max: 65535 }), sessionSecret,
    allowedOrigins, frontendUrl, trustProxy, secureCookies: isProduction, enforceHttps: boolean('ENFORCE_HTTPS', source.ENFORCE_HTTPS, isProduction),
    uploadDirectory: path.resolve(uploadRaw), frontendBuildDirectory: path.resolve(frontendBuildRaw), uploadMaxBytes: integer('MAX_UPLOAD_SIZE_BYTES', source.MAX_UPLOAD_SIZE_BYTES, 10 * 1024 * 1024, { min: 1024, max: 50 * 1024 * 1024 }),
    jsonBodyLimit: source.JSON_BODY_LIMIT || '100kb', shutdownTimeoutMs: integer('SHUTDOWN_TIMEOUT_MS', source.SHUTDOWN_TIMEOUT_MS, 10000, { min: 1000, max: 60000 }),
    db: { host: required(source, 'DB_HOST', isProduction), port: integer('DB_PORT', source.DB_PORT, 3306, { min: 1, max: 65535 }), user: required(source, 'DB_USER', isProduction), password: required(source, 'DB_PASSWORD', isProduction), name: required(source, 'DB_NAME', isProduction), connectionLimit: integer('DB_CONNECTION_LIMIT', source.DB_CONNECTION_LIMIT, 10, { min: 1, max: 100 }), connectTimeout: integer('DB_CONNECT_TIMEOUT_MS', source.DB_CONNECT_TIMEOUT_MS, 10000, { min: 1000, max: 60000 }), sslMode, sslCaFile: source.DB_SSL_CA_FILE || '' },
    smtp: { host: smtpHost, port: integer('SMTP_PORT', source.SMTP_PORT, 587, { min: 1, max: 65535 }), secure: boolean('SMTP_SECURE', source.SMTP_SECURE, false), requireTls: boolean('SMTP_REQUIRE_TLS', source.SMTP_REQUIRE_TLS, true), user: source.SMTP_USER || '', password: source.SMTP_PASSWORD || '', from: source.SMTP_FROM || '' },
    reminderSchedulerEnabled: boolean('REMINDER_SCHEDULER_ENABLED', source.REMINDER_SCHEDULER_ENABLED ?? (source.DISABLE_REMINDER_SCHEDULER === 'true' ? 'false' : undefined), !isProduction && nodeEnv !== 'test'),
    multiInstance, rateLimitStore,
  };
}

module.exports = { loadEnvironment, exactOrigin, parseOrigins };
