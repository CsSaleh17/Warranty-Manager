const { mysqlClientInvocation } = require('../src/mysqlCommand');

describe('MySQL client command construction', () => {
  const db = { host: '127.0.0.1', port: 3307, user: 'staging_user' };

  it('uses the configured host and port for a local client', () => {
    expect(mysqlClientInvocation({ program: 'mysqldump', db, database: 'staging' })).toEqual({
      command: expect.stringMatching(/mysqldump(?:\.exe)?$/),
      args: ['--host', '127.0.0.1', '--port', '3307', '--user', 'staging_user', 'staging']
    });
  });

  it('uses loopback port 3306 and docker exec for a selected container', () => {
    expect(mysqlClientInvocation({ program: 'mysql', db, database: 'restore', container: 'warranty-manager-staging-db', interactive: true })).toEqual({
      command: 'docker',
      args: ['exec', '--interactive', '--env', 'MYSQL_PWD', 'warranty-manager-staging-db', 'mysql', '--host', '127.0.0.1', '--port', '3306', '--user', 'staging_user', 'restore']
    });
  });
});
