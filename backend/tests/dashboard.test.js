jest.mock('../src/config/database', () => ({ execute: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));

const request = require('supertest');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
const app = require('../src/app');

async function authenticatedAgent() {
  const agent = request.agent(app);
  database.execute.mockResolvedValueOnce([[{ id: 7, full_name: 'Ava', email: 'ava@example.com', password_hash: 'hash' }]]);
  bcrypt.compare.mockResolvedValueOnce(true);
  await agent.post('/api/login').set('Origin', 'http://localhost:5173').send({ email: 'ava@example.com', password: 'SecurePass1!' });
  return agent;
}

describe('dashboard data', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches all owned product names, stores, and serial numbers without mutating them', async () => {
    const agent = await authenticatedAgent();
    database.execute.mockClear();
    database.execute.mockResolvedValueOnce([[{
      id: 12, name: 'Apple iPhone 15 Pro 256GB', category: 'Smartphone', store_name: 'Name: Tech World Electronics', serial_number: 'SN-A1B2C3D4E5', purchase_date: '2026-01-01', expiration_date: '2027-01-01',
    }]]);

    const response = await agent.get('/api/dashboard?search=%20sn-a1b2c3d4e5%20');

    expect(response.status).toBe(200);
    expect(response.body.searchResults).toEqual([expect.objectContaining({ id: 12, storeName: 'Tech World Electronics', category: 'Smartphones' })]);
    expect(database.execute.mock.calls.every(([sql]) => /^\s*SELECT/i.test(sql))).toBe(true);
  });
});
