const { hasExpectedStatus } = require('../src/smokeDeployment');

describe('deployment smoke response validation', () => {
  it('accepts the JSON health and readiness response contract', () => {
    expect(hasExpectedStatus('{"status":"ok"}', 'ok')).toBe(true);
    expect(hasExpectedStatus('{"status":"ready"}', 'ready')).toBe(true);
  });

  it('rejects malformed, missing, or unexpected statuses', () => {
    expect(hasExpectedStatus('ok', 'ok')).toBe(false);
    expect(hasExpectedStatus('{"status":"unavailable"}', 'ready')).toBe(false);
    expect(hasExpectedStatus('not-json', 'ok')).toBe(false);
  });
});
