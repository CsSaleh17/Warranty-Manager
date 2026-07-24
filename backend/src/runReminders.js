require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), quiet: true });
const database = require('./config/database');
require('./services/reminders').runDueReminders()
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => { process.exitCode = 1; })
  .finally(() => database.end());
