describe('origin configuration', () => {
  const originalEnvironment = process.env;
  afterEach(() => { process.env = originalEnvironment; jest.resetModules(); });

  it('accepts configured origins and development loopback aliases without a wildcard', () => {
    process.env = { ...originalEnvironment, NODE_ENV: 'development', FRONTEND_ORIGINS: 'http://localhost:5173, http://127.0.0.1:5173' };
    const { getAllowedOrigins } = require('../src/config/origins');
    expect([...getAllowedOrigins()]).toEqual(expect.arrayContaining(['http://localhost:5173', 'http://127.0.0.1:5173']));
    expect(getAllowedOrigins().has('*')).toBe(false);
  });

  it('does not infer loopback aliases in production', () => {
    process.env = { ...originalEnvironment, NODE_ENV: 'production', FRONTEND_ORIGINS: 'https://warranty.example' };
    const { getAllowedOrigins } = require('../src/config/origins');
    expect([...getAllowedOrigins()]).toEqual(['https://warranty.example']);
  });

  it('fails closed when production has no explicitly configured frontend origin', () => {
    process.env = { ...originalEnvironment, NODE_ENV: 'production' };
    delete process.env.FRONTEND_ORIGINS;
    delete process.env.FRONTEND_ORIGIN;
    const { getAllowedOrigins } = require('../src/config/origins');
    expect(() => getAllowedOrigins()).toThrow('FRONTEND_ORIGINS');
  });
});
