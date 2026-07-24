const { parseOrigins } = require('./environment');

function getAllowedOrigins() {
  return parseOrigins(process.env, process.env.NODE_ENV === 'production');
}

module.exports = { getAllowedOrigins };
