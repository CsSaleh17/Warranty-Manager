const { runMigrations } = require('../src/migrations');

describe('database migrations', () => {
  it('records an unapplied additive migration and commits it', async () => {
    const connection = { execute: jest.fn().mockResolvedValueOnce([{}]).mockResolvedValueOnce([[]]).mockResolvedValue([{}]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
    const database = { getConnection: jest.fn().mockResolvedValue(connection) };
    const migration = { name: 'test_additive', up: jest.fn().mockResolvedValue() };
    await expect(runMigrations({ database, migrations: [migration] })).resolves.toEqual({ applied: ['test_additive'], skipped: [] });
    expect(migration.up).toHaveBeenCalledWith(connection);
    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  it('rolls back and releases the connection after a migration failure', async () => {
    const connection = { execute: jest.fn().mockResolvedValueOnce([{}]).mockResolvedValueOnce([[]]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
    const database = { getConnection: jest.fn().mockResolvedValue(connection) };
    await expect(runMigrations({ database, migrations: [{ name: 'broken', up: jest.fn().mockRejectedValue(new Error('migration failed')) }] })).rejects.toThrow('migration failed');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});
