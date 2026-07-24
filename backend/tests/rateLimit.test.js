const request = require('supertest');
const app = require('../src/app');

describe('authentication abuse prevention', () => {
  it('rate limits repeated login attempts', async () => {
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await request(app).post('/api/login').set('Origin', 'http://localhost:5173').send({ email: 'invalid', password: '' });
    }
    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: 'Too many login attempts. Please try again later.' });
  });

  it('does not let spoofed forwarding headers rotate the limiter key when proxies are untrusted', async () => {
    const write = jest.spyOn(console, 'error').mockImplementation(() => {});
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      response = await request(app).post('/api/register').set('Origin', 'http://localhost:5173').set('X-Forwarded-For', `203.0.113.${attempt + 1}`).send({});
    }
    expect(response.status).toBe(429);
    write.mockRestore();
  });
});
