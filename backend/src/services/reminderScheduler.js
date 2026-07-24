const { runDueReminders } = require('./reminders');
const { loadEnvironment } = require('../config/environment');
let timer = null;

function millisecondsUntilNextSaudiRun(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  let next = Date.UTC(value('year'), value('month') - 1, value('day'), 11, 0, 0, 0); // 14:00 Asia/Riyadh (UTC+3)
  if (next <= now.getTime()) next += 24 * 60 * 60 * 1000;
  return next - now.getTime();
}

function startReminderScheduler() {
  if (timer || !loadEnvironment().reminderSchedulerEnabled) return;
  const schedule = () => { timer = setTimeout(async () => { try { await runDueReminders(); } finally { timer = null; schedule(); } }, millisecondsUntilNextSaudiRun()); };
  schedule();
}
function stopReminderScheduler() { if (timer) clearTimeout(timer); timer = null; }
module.exports = { startReminderScheduler, stopReminderScheduler, millisecondsUntilNextSaudiRun };
