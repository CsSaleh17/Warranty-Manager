const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const app = require('./app');
const database = require('./config/database');
const { loadEnvironment } = require('./config/environment');
const { startReminderScheduler, stopReminderScheduler } = require('./services/reminderScheduler');
const { createShutdownHandler } = require('./runtime');
const config = loadEnvironment();

const server = app.listen(config.port, () => {
  console.log(`Warranty Manager API listening on port ${config.port}`);
});
startReminderScheduler();
const shutdown = createShutdownHandler({ server, database, stopScheduler: stopReminderScheduler, timeoutMs: config.shutdownTimeoutMs });
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => shutdown(signal).catch(() => { process.exitCode = 1; }));
process.once('unhandledRejection', (error) => { console.error(JSON.stringify({ type: 'lifecycle', event: 'unhandled_rejection', code: error?.code || error?.name || 'Error' })); shutdown('unhandledRejection').catch(() => { process.exitCode = 1; }); });
process.once('uncaughtException', (error) => { console.error(JSON.stringify({ type: 'lifecycle', event: 'uncaught_exception', code: error?.code || error?.name || 'Error' })); shutdown('uncaughtException').catch(() => { process.exitCode = 1; }); });
