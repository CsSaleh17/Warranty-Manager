function mysqlClientInvocation({ program, db, database, container = '', interactive = false, options = [] }) {
  if (!['mysql', 'mysqldump'].includes(program)) throw new Error('Unsupported MySQL client program.');
  if (container && !/^[a-zA-Z0-9_.-]+$/.test(container)) throw new Error('MYSQL client container contains unsupported characters.');
  const host = container ? '127.0.0.1' : db.host;
  const port = container ? 3306 : db.port;
  const clientArgs = ['--host', host, '--port', String(port), '--user', db.user, ...options, database];
  if (!container) return { command: process.platform === 'win32' ? `${program}.exe` : program, args: clientArgs };
  return { command: 'docker', args: ['exec', ...(interactive ? ['--interactive'] : []), '--env', 'MYSQL_PWD', container, program, ...clientArgs] };
}

module.exports = { mysqlClientInvocation };
