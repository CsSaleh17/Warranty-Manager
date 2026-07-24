const { previewMigrations, inspectDatabase } = require('../src/databaseDeployment');

describe('database deployment inspection', () => {
  it('previews every migration when the ledger does not exist', async () => {
    const connection = { execute: jest.fn().mockResolvedValueOnce([[{ present: 0 }]]) };
    await expect(previewMigrations(connection, [{ name: 'one' }, { name: 'two' }])).resolves.toEqual({ applied: [], pending: ['one', 'two'] });
  });

  it('returns only unapplied migrations when the ledger exists', async () => {
    const connection = { execute: jest.fn().mockResolvedValueOnce([[{ present: 1 }]]).mockResolvedValueOnce([[{ name: 'one' }]]) };
    await expect(previewMigrations(connection, [{ name: 'one' }, { name: 'two' }])).resolves.toEqual({ applied: ['one'], pending: ['two'] });
  });

  it('reports missing tables, columns, indexes, and foreign keys without changing the database', async () => {
    const connection = {
      execute: jest.fn()
        .mockResolvedValueOnce([[{ TABLE_NAME: 'users' }, { TABLE_NAME: 'products' }]])
        .mockResolvedValueOnce([[{ TABLE_NAME: 'users', COLUMN_NAME: 'id' }]])
        .mockResolvedValueOnce([[{ TABLE_NAME: 'users', INDEX_NAME: 'PRIMARY' }]])
        .mockResolvedValueOnce([[]])
    };
    const result = await inspectDatabase(connection);
    expect(result.status).toBe('incomplete');
    expect(result.missing.tables).not.toContain('users');
    expect(result.missing.columns).not.toContain('users.id');
    expect(result.missing.indexes).not.toContain('users.PRIMARY');
    expect(result.missing.tables).toContain('sessions');
    expect(result.missing.columns).toContain('products.user_id');
    expect(result.missing.indexes).toContain('users.users_email_unique');
    expect(result.missing.foreignKeys).toContain('products.products_user_id_foreign');
    expect(connection.execute).toHaveBeenCalledTimes(4);
  });
});
