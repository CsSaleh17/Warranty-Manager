const request = require('supertest');
const crypto = require('crypto');
jest.mock('../src/config/database', () => ({ execute: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
const database = require('../src/config/database');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const app = require('../src/app');

describe('password reset endpoints', () => {
  beforeEach(() => { jest.clearAllMocks(); delete process.env.SMTP_HOST; process.env.FRONTEND_URL = 'http://localhost:5173'; });

  it('sends each reset email to the submitted account, never to the SMTP sender', async () => {
    const sendMail = jest.fn().mockResolvedValue({ accepted: ['recipient'] });
    nodemailer.createTransport.mockReturnValue({ sendMail });
    process.env.SMTP_HOST = 'smtp.example.test'; process.env.SMTP_USER = 'sender@example.com'; process.env.SMTP_PASSWORD = 'test-password'; process.env.SMTP_FROM = 'Warranty <sender@example.com>';
    database.execute.mockResolvedValueOnce([[{ id: 1, email: 'user-one@example.com' }]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ id: 2, email: 'user-two@example.com' }]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);
    await request(app).post('/api/forgot-password').set('Origin', 'http://localhost:5173').send({ email: ' User-One@Example.com ' });
    await request(app).post('/api/forgot-password').set('Origin', 'http://localhost:5173').send({ email: 'user-two@example.com' });
    expect(sendMail.mock.calls[0][0].to).toBe('user-one@example.com');
    expect(sendMail.mock.calls[1][0].to).toBe('user-two@example.com');
    expect(sendMail.mock.calls[0][0].from).toBe('Warranty <sender@example.com>');
    expect(sendMail.mock.calls[0][0].to).not.toBe(process.env.SMTP_USER);
  });

  it('returns the same generic response for existing and unknown email addresses', async () => {
    database.execute.mockResolvedValueOnce([[{ id: 7, email: 'ava@example.com' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([[]]);
    const existing = await request(app).post('/api/forgot-password').set('Origin', 'http://localhost:5173').send({ email: 'ava@example.com' });
    const unknown = await request(app).post('/api/forgot-password').set('Origin', 'http://localhost:5173').send({ email: 'unknown@example.com' });
    expect(existing.body.message).toBe('If an account exists for this email, a password reset link has been sent.');
    expect(unknown.body).toEqual(existing.body);
    const insert = database.execute.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO password_reset_tokens'));
    expect(insert[1][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(insert[1][1]).not.toBe('ava@example.com');
  });

  it('accepts a valid token once and rejects invalid, expired, and reused tokens', async () => {
    database.execute.mockResolvedValueOnce([{ affectedRows: 2 }]);
    bcrypt.hash.mockResolvedValue('new-hash');
    const valid = await request(app).post('/api/reset-password').set('Origin', 'http://localhost:5173').send({ token: 'raw-token', newPassword: 'NewSecure1!', confirmPassword: 'NewSecure1!' });
    expect(valid.status).toBe(200); expect(bcrypt.hash).toHaveBeenCalledWith('NewSecure1!', 12);
    expect(database.execute.mock.calls[0][0]).toMatch(/^UPDATE users u JOIN password_reset_tokens t/);
    expect(database.execute.mock.calls[0][1]).toEqual(['new-hash', crypto.createHash('sha256').update('raw-token').digest('hex')]);
    database.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const reused = await request(app).post('/api/reset-password').set('Origin', 'http://localhost:5173').send({ token: 'raw-token', newPassword: 'NewSecure1!', confirmPassword: 'NewSecure1!' });
    expect(reused.status).toBe(400);
    const mismatch = await request(app).post('/api/reset-password').set('Origin', 'http://localhost:5173').send({ token: 'x', newPassword: 'NewSecure1!', confirmPassword: 'different' });
    expect(mismatch.status).toBe(400);
  });

  it('consumes a reset token in the same atomic statement that changes the password', async () => {
    bcrypt.hash.mockResolvedValue('new-hash');
    database.execute.mockResolvedValueOnce([{ affectedRows: 2 }]);
    const response = await request(app).post('/api/reset-password').set('Origin', 'http://localhost:5173').send({ token: 'one-time-token', newPassword: 'NewSecure1!', confirmPassword: 'NewSecure1!' });
    expect(response.status).toBe(200);
    expect(database.execute.mock.calls[0][0]).toContain('t.used_at = NOW()');
    expect(database.execute.mock.calls[0][0]).toContain('t.used_at IS NULL');
    expect(database.execute.mock.calls[0][0]).toContain('t.expires_at > NOW()');
    expect(database.execute.mock.calls[0][0]).toContain('LEFT JOIN sessions active_sessions');
    expect(database.execute.mock.calls[0][0]).toContain('active_sessions.expires_at = NOW()');
  });
});
