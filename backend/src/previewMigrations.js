const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const database = require('./config/database');
const { readDeploymentContext } = require('./deploymentSafety');
const { previewMigrations } = require('./databaseDeployment');
const { migrations } = require('./migrationDefinitions');

async function main() {
  const context = readDeploymentContext();
  const connection = await database.getConnection();
  try {
    const result = await previewMigrations(connection, migrations);
    console.log(JSON.stringify({ type: 'migration_preview', environment: context.environment, host: context.databaseHost, database: context.databaseName, ...result }));
  } finally {
    connection.release();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'migration_preview', status: 'failed', code: error.code || error.name, message: error.message }));
  process.exitCode = 1;
}).finally(() => database.end());
