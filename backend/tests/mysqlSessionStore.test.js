jest.mock('../src/config/database', () => ({ execute: jest.fn() }));

const database = require('../src/config/database');
const MysqlSessionStore = require('../src/services/mysqlSessionStore');

describe('MySQL session store', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores, reads, touches, and destroys sessions with parameterized queries', async () => {
    const store = new MysqlSessionStore(database);
    const session = { cookie: { expires: new Date(Date.now() + 60000) }, user: { id: 7 } };
    database.execute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ data: JSON.stringify(session) }]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);

    await new Promise((resolve, reject) => store.set('sid-value', session, (error) => error ? reject(error) : resolve()));
    const loaded = await new Promise((resolve, reject) => store.get('sid-value', (error, value) => error ? reject(error) : resolve(value)));
    await new Promise((resolve, reject) => store.touch('sid-value', session, (error) => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => store.destroy('sid-value', (error) => error ? reject(error) : resolve()));

    expect(loaded.user.id).toBe(7);
    for (const call of database.execute.mock.calls.slice(1)) expect(call[0]).toContain('?');
    expect(database.execute.mock.calls[0]).toEqual(['DELETE FROM sessions WHERE expires_at <= NOW()']);
    expect(database.execute.mock.calls[1][1][0]).toBe('sid-value');
    expect(database.execute.mock.calls[4]).toEqual(['DELETE FROM sessions WHERE sid = ?', ['sid-value']]);
  });

  it('returns no session for expired or absent records', async () => {
    database.execute.mockResolvedValueOnce([[]]);
    const store = new MysqlSessionStore(database);
    const loaded = await new Promise((resolve, reject) => store.get('missing', (error, value) => error ? reject(error) : resolve(value)));
    expect(loaded).toBeNull();
  });
});
