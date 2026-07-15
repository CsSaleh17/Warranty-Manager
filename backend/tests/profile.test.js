jest.mock('../src/config/database', () => ({ execute: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcrypt');
const database = require('../src/config/database');
const app = require('../src/app');
const frontendOrigin = 'http://localhost:5173';

async function authenticatedAgent() {
  const agent = request.agent(app);
  database.execute.mockResolvedValueOnce([[{ id: 7, full_name: 'Ava Smith', email: 'ava@example.com', password_hash: 'stored' }]]);
  bcrypt.compare.mockResolvedValueOnce(true);
  await agent.post('/api/login').set('Origin', frontendOrigin).send({ email: 'ava@example.com', password: 'SecurePass1!' });
  return agent;
}

describe('profile endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires authentication and returns safe profile information', async () => {
    expect((await request(app).get('/api/profile')).status).toBe(401);
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([[{ full_name: 'Ava Smith', email: 'ava@example.com', created_at: '2026-01-01T00:00:00.000Z' }]]);
    const response = await agent.get('/api/profile');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ success: true, data: { fullName: 'Ava Smith', email: 'ava@example.com', createdAt: '2026-01-01T00:00:00.000Z' } });
  });

  it('updates a name and changes a verified password without exposing hashes', async () => {
    const agent = await authenticatedAgent();
    database.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const nameResponse = await agent.put('/api/profile').set('Origin', frontendOrigin).send({ fullName: 'Ava Jones' });
    expect(nameResponse.body.user.fullName).toBe('Ava Jones');
    database.execute.mockResolvedValueOnce([[{ password_hash: 'stored' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    bcrypt.compare.mockResolvedValueOnce(true); bcrypt.hash.mockResolvedValueOnce('new-hash');
    const passwordResponse = await agent.put('/api/profile/password').set('Origin', frontendOrigin).send({ currentPassword: 'SecurePass1!', newPassword: 'NewSecure1!', confirmPassword: 'NewSecure1!' });
    expect(passwordResponse.status).toBe(200);
    expect(passwordResponse.body).toEqual({ message: 'Password updated successfully.' });
    expect(bcrypt.hash).toHaveBeenCalledWith('NewSecure1!', 12);
  });
});
