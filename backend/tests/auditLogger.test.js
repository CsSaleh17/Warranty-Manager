const auditLogger = require('../src/services/auditLogger');

describe('security audit logger', () => {
  it('logs only normalized security metadata and excludes supplied secrets', () => {
    const write = jest.spyOn(console, 'info').mockImplementation(() => {});
    auditLogger.securityEvent('login_failure\nforged', { userId: 7, outcome: 'denied\r\nforged', password: 'Secret1!', token: 'raw-token', email: 'private@example.com' });
    expect(write).toHaveBeenCalledTimes(1);
    const output = write.mock.calls[0][0];
    expect(output).not.toMatch(/Secret1|raw-token|private@example|\r|\n/);
    expect(JSON.parse(output)).toEqual(expect.objectContaining({ type: 'security_audit', userId: 7 }));
    write.mockRestore();
  });
});
