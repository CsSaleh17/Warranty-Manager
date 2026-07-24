const session = require('express-session');

class MysqlSessionStore extends session.Store {
  constructor(database, options = {}) {
    super();
    this.database = database;
    this.defaultTtlMs = options.defaultTtlMs || 7 * 24 * 60 * 60 * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60 * 60 * 1000;
    this.lastCleanup = 0;
  }

  expiration(sessionData) {
    const configured = new Date(sessionData?.cookie?.expires || 0);
    return Number.isNaN(configured.getTime()) || configured.getTime() <= Date.now()
      ? new Date(Date.now() + this.defaultTtlMs)
      : configured;
  }

  async get(sid, callback) {
    try {
      const [rows] = await this.database.execute('SELECT data FROM sessions WHERE sid = ? AND expires_at > NOW() LIMIT 1', [sid]);
      if (!rows[0]) return callback(null, null);
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      return callback(null, data);
    } catch (error) {
      return callback(error);
    }
  }

  async set(sid, sessionData, callback = () => {}) {
    try {
      if (Date.now() - this.lastCleanup >= this.cleanupIntervalMs) {
        await this.database.execute('DELETE FROM sessions WHERE expires_at <= NOW()');
        this.lastCleanup = Date.now();
      }
      await this.database.execute(
        'INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)',
        [sid, JSON.stringify(sessionData), this.expiration(sessionData)],
      );
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async touch(sid, sessionData, callback = () => {}) {
    try {
      await this.database.execute('UPDATE sessions SET expires_at = ? WHERE sid = ?', [this.expiration(sessionData), sid]);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async destroy(sid, callback = () => {}) {
    try {
      await this.database.execute('DELETE FROM sessions WHERE sid = ?', [sid]);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }
}

module.exports = MysqlSessionStore;
