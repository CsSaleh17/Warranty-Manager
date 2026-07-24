const mysql = require('mysql2/promise');
const fs = require('fs');
const { loadEnvironment } = require('./environment');

const config = loadEnvironment();
const ssl = config.db.sslMode === 'disabled' ? undefined : {
  rejectUnauthorized: true,
  ...(config.db.sslCaFile ? { ca: fs.readFileSync(config.db.sslCaFile, 'utf8') } : {}),
};

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  charset: 'utf8mb4',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  connectTimeout: config.db.connectTimeout,
  queueLimit: 0,
  enableKeepAlive: true,
  ssl,
});

module.exports = pool;
