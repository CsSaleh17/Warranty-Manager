const request = require('supertest');
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
});
