jest.mock('../src/config/database', () => ({ execute: jest.fn() }));
const request = require('supertest');
const database = require('../src/config/database');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('reports that the API is running', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/ready', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports ready only when required dependencies are available', async () => {
    database.execute.mockResolvedValueOnce([[{ ok: 1 }]]);
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(database.execute).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns minimal unavailable status when a dependency fails', async () => {
    database.execute.mockRejectedValueOnce(new Error('internal database detail'));
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
    expect(response.text).not.toMatch(/database detail|SELECT|stack/i);
  });
});
