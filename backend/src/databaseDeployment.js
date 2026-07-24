const REQUIRED = {
  tables: ['users', 'products', 'password_reset_tokens', 'sessions', 'schema_migrations'],
  columns: [
    'users.id', 'users.full_name', 'users.email', 'users.password_hash',
    'products.id', 'products.user_id', 'products.expiration_date', 'products.reminder_enabled',
    'products.reminder_claim_token', 'password_reset_tokens.token_hash',
    'password_reset_tokens.used_at', 'sessions.sid', 'sessions.data', 'sessions.expires_at'
  ],
  indexes: [
    'users.PRIMARY', 'users.users_email_unique', 'products.PRIMARY',
    'products.products_user_expiration_index', 'products.products_reminder_due_index',
    'password_reset_tokens.password_reset_token_hash_unique', 'sessions.sessions_expires_at_index'
  ],
  foreignKeys: ['products.products_user_id_foreign', 'password_reset_tokens.password_reset_tokens_user_id_foreign']
};

async function previewMigrations(connection, migrations) {
  const [presenceRows] = await connection.execute("SELECT COUNT(*) AS present FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'");
  const applied = presenceRows[0]?.present ? (await connection.execute('SELECT name FROM schema_migrations ORDER BY name'))[0].map((row) => row.name) : [];
  const appliedSet = new Set(applied);
  return { applied, pending: migrations.map((migration) => migration.name).filter((name) => !appliedSet.has(name)) };
}

function missing(required, found) {
  const foundSet = new Set(found);
  return required.filter((name) => !foundSet.has(name));
}

function metadataField(row, name) {
  return row[name] ?? row[name.toUpperCase()];
}

async function inspectDatabase(connection) {
  const [tableRows] = await connection.execute('SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()');
  const [columnRows] = await connection.execute('SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE()');
  const [indexRows] = await connection.execute('SELECT DISTINCT table_name, index_name FROM information_schema.statistics WHERE table_schema = DATABASE()');
  const [foreignKeyRows] = await connection.execute("SELECT table_name, constraint_name FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'");
  const result = {
    tables: tableRows.map((row) => metadataField(row, 'table_name')),
    columns: columnRows.map((row) => `${metadataField(row, 'table_name')}.${metadataField(row, 'column_name')}`),
    indexes: indexRows.map((row) => `${metadataField(row, 'table_name')}.${metadataField(row, 'index_name')}`),
    foreignKeys: foreignKeyRows.map((row) => `${metadataField(row, 'table_name')}.${metadataField(row, 'constraint_name')}`)
  };
  const gaps = Object.fromEntries(Object.entries(REQUIRED).map(([kind, names]) => [kind, missing(names, result[kind])]));
  return { status: Object.values(gaps).every((entries) => entries.length === 0) ? 'ok' : 'incomplete', missing: gaps, counts: Object.fromEntries(Object.entries(result).map(([kind, entries]) => [kind, entries.length])) };
}

module.exports = { REQUIRED, previewMigrations, inspectDatabase };
