jest.mock('../src/config/database', () => ({ execute: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
const { loadEnvironment } = require('../src/config/environment');
const { createApp } = require('../src/app');

const values = { NODE_ENV: 'production', SESSION_SECRET: 's'.repeat(64), DB_HOST: 'db', DB_USER: 'app', DB_PASSWORD: 'db-password', DB_NAME: 'warranty', FRONTEND_ORIGINS: 'https://warranty.example', FRONTEND_URL: 'https://warranty.example', UPLOAD_DIRECTORY: 'C:\\warranty-uploads', TRUST_PROXY: '1', SMTP_HOST: 'smtp.example', SMTP_FROM: 'no-reply@example.com' };

describe('production proxy, headers, sessions, and cookies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trusts only the configured proxy hop and emits production headers over forwarded HTTPS', async () => {
    const app = createApp(loadEnvironment(values), { database });
    const response = await request(app).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(response.status).toBe(200);
    expect(response.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(app.get('trust proxy')).toBe(1);
  });

  it('rejects spoofed forwarding headers when proxy trust is disabled', async () => {
    const app = createApp({ ...loadEnvironment(values), trustProxy: false }, { database });
    const response = await request(app).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(response.status).toBe(426);
  });

  it('uses the durable store and sets Secure, HttpOnly, SameSite cookies in production', async () => {
    const app = createApp(loadEnvironment(values), { database });
    database.execute.mockResolvedValueOnce([[{ id: 7, full_name: 'Ava', email: 'ava@example.com', password_hash: 'hash' }]]).mockResolvedValue([{}]);
    bcrypt.compare.mockResolvedValueOnce(true);
    const response = await request(app).post('/api/login').set('Origin', 'https://warranty.example').set('X-Forwarded-Proto', 'https').send({ email: 'ava@example.com', password: 'SecurePass1!' });
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/Secure/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
    expect(database.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO sessions'))).toBe(true);
  });

  it.each(['https://warranty.example.attacker.test', 'https://attacker-warranty.example', 'http://warranty.example', 'https://warranty.example:444', 'null'])('rejects production origin bypass %s', async (origin) => {
    const app = createApp(loadEnvironment(values), { database });
    const response = await request(app).post('/api/login').set('Origin', origin).set('X-Forwarded-Proto', 'https').send({ email: 'ava@example.com', password: 'SecurePass1!' });
    expect(response.status).toBe(403);
  });

  it('serves the production frontend without exposing uploads or masking API 404s', async () => {
    const buildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'warranty-frontend-'));
    fs.mkdirSync(path.join(buildDirectory, 'assets'));
    fs.writeFileSync(path.join(buildDirectory, 'index.html'), '<!doctype html><div id="root">Warranty Manager</div>');
    fs.writeFileSync(path.join(buildDirectory, 'assets', 'app.js'), 'console.log("app")');
    fs.writeFileSync(path.join(buildDirectory, 'private-invoice.pdf'), 'must not be served');

    try {
      const config = { ...loadEnvironment(values), frontendBuildDirectory: buildDirectory };
      const app = createApp(config, { database });
      const headers = { 'X-Forwarded-Proto': 'https' };

      const routeResponse = await request(app).get('/products/7').set(headers);
      const assetResponse = await request(app).get('/assets/app.js').set(headers);
      const apiResponse = await request(app).get('/api/does-not-exist').set(headers);
      const privateResponse = await request(app).get('/private-invoice.pdf').set(headers);

      expect(routeResponse.status).toBe(200);
      expect(routeResponse.text).toContain('Warranty Manager');
      expect(routeResponse.headers['cache-control']).toMatch(/no-store/);
      expect(assetResponse.status).toBe(200);
      expect(apiResponse.status).toBe(404);
      expect(apiResponse.body).toEqual({ error: 'API endpoint not found.' });
      expect(privateResponse.status).toBe(404);
    } finally {
      fs.rmSync(buildDirectory, { recursive: true, force: true });
    }
  });
});
