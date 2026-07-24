const { createShutdownHandler } = require('../src/runtime');

describe('graceful shutdown', () => {
  it('stops the scheduler, closes HTTP, and ends the database pool once', async () => {
    const server = { close: jest.fn((callback) => callback()) };
    const database = { end: jest.fn().mockResolvedValue() };
    const stopScheduler = jest.fn();
    const logger = { info: jest.fn(), error: jest.fn() };
    const shutdown = createShutdownHandler({ server, database, stopScheduler, logger, timeoutMs: 1000 });
    await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);
    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(database.end).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('shutdown_complete'));
  });
});
