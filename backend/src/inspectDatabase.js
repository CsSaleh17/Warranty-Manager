const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const database = require('./config/database');
const { readDeploymentContext } = require('./deploymentSafety');
const { inspectDatabase } = require('./databaseDeployment');

async function main() {
  const context = readDeploymentContext();
  const connection = await database.getConnection();
  try {
    const result = await inspectDatabase(connection);
    console.log(JSON.stringify({ type: 'database_inspection', environment: context.environment, host: context.databaseHost, database: context.databaseName, ...result }));
    if (result.status !== 'ok') process.exitCode = 1;
  } finally {
    connection.release();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'database_inspection', status: 'failed', code: error.code || error.name }));
  process.exitCode = 1;
}).finally(() => database.end());
