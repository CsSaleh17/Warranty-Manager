const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const database = require('./config/database');
const { runMigrations } = require('./migrations');
const { migrations } = require('./migrationDefinitions');
const { readDeploymentContext, assertDatabaseMutationAllowed } = require('./deploymentSafety');

async function main() {
  const context = readDeploymentContext();
  assertDatabaseMutationAllowed(context, 'migrate');
  const result = await runMigrations({ database, migrations });
  console.log(JSON.stringify({ type: 'migration', status: 'complete', environment: context.environment, database: context.databaseName, ...result }));
}

main()
  .catch((error) => { console.error(JSON.stringify({ type: 'migration', status: 'failed', code: error.code || error.name, message: error.code ? undefined : error.message })); process.exitCode = 1; })
  .finally(() => database.end());
