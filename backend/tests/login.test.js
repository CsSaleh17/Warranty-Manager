jest.mock('../src/config/database', () => ({
  execute: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const request = require('supertest');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
const app = require('../src/app');
const frontendOrigin = 'http://localhost:5173';

describe('login and authenticated user endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates login email and password', async () => {
    const response = await request(app).post('/api/login').set('Origin', frontendOrigin).send({
      email: 'not-an-email',
      password: '',
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual({
      email: 'Enter a valid email address.',
      password: 'Password is required.',
    });
  });

  it('rejects invalid credentials without revealing which field is incorrect', async () => {
    database.execute.mockResolvedValue([[]]);

    const response = await request(app).post('/api/login').set('Origin', frontendOrigin).send({
      email: 'ava@example.com',
      password: 'SecurePass1!',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Email or password is incorrect.' });
  });

  it('creates a regenerated session and returns the authenticated user', async () => {
    const agent = request.agent(app);
    database.execute.mockResolvedValue([[
      { id: 7, full_name: 'Ava Smith', email: 'ava@example.com', password_hash: 'hashed-password' },
    ]]);
    bcrypt.compare.mockResolvedValue(true);

    const loginResponse = await agent.post('/api/login').set('Origin', frontendOrigin).send({
      email: 'AVA@EXAMPLE.COM',
      password: 'SecurePass1!',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toEqual({
      message: 'Login successful.',
      user: { id: 7, fullName: 'Ava Smith', email: 'ava@example.com' },
    });
    expect(loginResponse.headers['set-cookie']).toEqual(expect.arrayContaining([
      expect.stringContaining('warranty.sid='),
    ]));
    expect(bcrypt.compare).toHaveBeenCalledWith('SecurePass1!', 'hashed-password');

    const meResponse = await agent.get('/api/me');
    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toEqual({ user: { id: 7, fullName: 'Ava Smith', email: 'ava@example.com' } });
  });

  it('requires an authenticated session for the current-user endpoint', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication is required.' });
  });
});
