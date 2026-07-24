const { millisecondsUntilNextSaudiRun } = require('../src/services/reminderScheduler');

describe('reminder scheduler timing', () => {
  it('schedules the next run for 2:00 PM Saudi Arabia time', () => {
    expect(millisecondsUntilNextSaudiRun(new Date('2026-07-16T10:59:00.000Z'))).toBe(60_000);
    expect(millisecondsUntilNextSaudiRun(new Date('2026-07-16T11:00:00.000Z'))).toBe(24 * 60 * 60 * 1000);
  });
});
