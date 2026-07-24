async function runMigrations({ database, migrations }) {
  const connection = await database.getConnection();
  try {
    await connection.execute('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const [rows] = await connection.execute('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));
    const appliedNow = [];
    const skipped = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) { skipped.push(migration.name); continue; }
      await connection.beginTransaction();
      try {
        await migration.up(connection);
        await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
        await connection.commit();
        appliedNow.push(migration.name);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    return { applied: appliedNow, skipped };
  } finally { connection.release(); }
}

module.exports = { runMigrations };
