async function databaseName(connection) {
  const [rows] = await connection.execute('SELECT DATABASE() AS name');
  if (!rows[0]?.name) throw new Error('A database must be selected before running migrations.');
  return rows[0].name;
}

async function hasColumn(connection, schema, table, column) {
  const [rows] = await connection.execute('SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1', [schema, table, column]);
  return Boolean(rows[0]);
}

async function addColumn(connection, schema, table, column, definition) {
  if (!(await hasColumn(connection, schema, table, column))) await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function hasIndex(connection, schema, table, index) {
  const [rows] = await connection.execute('SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1', [schema, table, index]);
  return Boolean(rows[0]);
}

async function addIndex(connection, schema, table, index, columns) {
  if (!(await hasIndex(connection, schema, table, index))) await connection.execute(`CREATE INDEX \`${index}\` ON \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')})`);
}

const productionReadinessMigration = {
  name: '20260718_production_readiness',
  async up(connection) {
    const schema = await databaseName(connection);
    await addColumn(connection, schema, 'products', 'reminder_enabled', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await addColumn(connection, schema, 'products', 'reminder_days_before', 'INT UNSIGNED NULL');
    await addColumn(connection, schema, 'products', 'is_reminded', 'BOOLEAN NOT NULL DEFAULT FALSE');
    await addColumn(connection, schema, 'products', 'reminder_sent_at', 'DATETIME NULL');
    await addColumn(connection, schema, 'products', 'reminder_claim_token', 'CHAR(36) NULL');
    await addColumn(connection, schema, 'products', 'reminder_claimed_at', 'DATETIME NULL');
    await connection.execute(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT, user_id INT UNSIGNED NOT NULL, token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL, used_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY password_reset_token_hash_unique (token_hash),
      CONSTRAINT password_reset_tokens_user_id_foreign FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await connection.execute(`CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR(128) NOT NULL, data JSON NOT NULL, expires_at DATETIME(3) NOT NULL,
      PRIMARY KEY (sid), KEY sessions_expires_at_index (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await addIndex(connection, schema, 'products', 'products_user_expiration_index', ['user_id', 'expiration_date']);
    await addIndex(connection, schema, 'products', 'products_reminder_due_index', ['reminder_enabled', 'is_reminded', 'expiration_date']);
  },
};

module.exports = { migrations: [productionReadinessMigration] };
