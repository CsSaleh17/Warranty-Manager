jest.mock('../src/config/database', () => ({
  execute: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

const request = require('supertest');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
const app = require('../src/app');
const frontendOrigin = 'http://localhost:5173';

describe('POST /api/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates the full name, email, and password', async () => {
    const response = await request(app).post('/api/register').set('Origin', frontendOrigin).send({
      fullName: '',
      email: 'not-an-email',
      password: 'short',
    });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual({
      fullName: 'Full name must be at least 2 characters.',
      email: 'Enter a valid email address.',
      password: 'Password must be at least 8 characters.',
    });
  });

  it('hashes the password and stores a new user', async () => {
    bcrypt.hash.mockResolvedValue('hashed-password');
    database.execute.mockResolvedValue([{ insertId: 7 }]);

    const response = await request(app).post('/api/register').set('Origin', frontendOrigin).send({
      fullName: 'Ava Smith',
      email: 'AVA@EXAMPLE.COM',
      password: 'SecurePass1!',
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ message: 'If this email can be registered, the account is ready to use.' });
    expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass1!', 12);
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['Ava Smith', 'ava@example.com', 'hashed-password'],
    );
  });

  it.each(['http://localhost:5173', 'http://127.0.0.1:5173'])('registers successfully from approved origin %s', async (origin) => {
    bcrypt.hash.mockResolvedValue('hashed-password');
    database.execute.mockResolvedValue([{ insertId: 8 }]);
    const response = await request(app).post('/api/register').set('Origin', origin).send({ fullName: 'Loopback User', email: 'loopback@example.com', password: 'SecurePass1!' });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ message: 'If this email can be registered, the account is ready to use.' });
  });

  it('does not reveal whether an email address is already registered', async () => {
    const duplicateError = new Error('Duplicate entry');
    duplicateError.code = 'ER_DUP_ENTRY';
    bcrypt.hash.mockResolvedValue('hashed-password');
    database.execute.mockRejectedValue(duplicateError);

    const response = await request(app).post('/api/register').set('Origin', frontendOrigin).send({
      fullName: 'Ava Smith',
      email: 'ava@example.com',
      password: 'SecurePass1!',
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ message: 'If this email can be registered, the account is ready to use.' });
  });
});
