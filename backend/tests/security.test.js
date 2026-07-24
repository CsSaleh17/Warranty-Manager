const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');

describe('CSRF protection', () => {
  it('rejects state-changing requests from an untrusted origin', async () => {
    const response = await request(app)
      .post('/api/register')
      .set('Origin', 'https://attacker.example')
      .send({ fullName: 'Ava Smith', email: 'ava@example.com', password: 'SecurePass1!' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Request origin is not allowed.' });
  });

  it('rejects a state-changing request with no Origin header', async () => {
    const response = await request(app).post('/api/register').send({ fullName: 'Ava Smith', email: 'ava@example.com', password: 'SecurePass1!' });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Request origin is not allowed.' });
  });

  it('allows the loopback Vite origin during local development', async () => {
    const response = await request(app).post('/api/register').set('Origin', 'http://127.0.0.1:5173').send({});
    expect(response.status).not.toBe(403);
  });

  it.each(['/api/register', '/api/login'])('allows both intended local origins for %s', async (route) => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const response = await request(app).post(route).set('Origin', origin).send({});
      expect(response.status).not.toBe(403);
    }
  });

  it.each(['/api/register', '/api/login'])('rejects an untrusted origin for %s', async (route) => {
    const response = await request(app).post(route).set('Origin', 'https://attacker.example').send({});
    expect(response.status).toBe(403);
  });

  it('echoes the requesting approved loopback origin on preflight', async () => {
    const response = await request(app).options('/api/login').set('Origin', 'http://127.0.0.1:5173').set('Access-Control-Request-Method', 'POST');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('generic errors and security headers', () => {
  it('returns generic JSON for malformed request bodies without parser details', async () => {
    const response = await request(app)
      .post('/api/login')
      .set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ error: 'Invalid request body.' });
    expect(response.text).not.toMatch(/SyntaxError|node_modules|[A-Z]:\\/);
  });

  it('uses a restrictive CSP and does not send HSTS during local HTTP development', async () => {
    const response = await request(app).get('/api/health');
    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(response.headers['content-security-policy']).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['permissions-policy']).toContain('camera=()');
  });

  it('keeps the checked-in database schema executable from its first statement', () => {
    const schema = fs.readFileSync(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
    expect(schema).not.toMatch(/\b(?:CREATE DATABASE|USE)\b/i);
    expect(schema.trimStart()).toMatch(/^CREATE TABLE IF NOT EXISTS users\b/i);
    expect(schema).not.toContain('usersCREATE');
  });

  it('returns controlled JSON for unknown API routes', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ error: 'API endpoint not found.' });
  });
});
