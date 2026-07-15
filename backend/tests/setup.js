const { randomBytes } = require('crypto');

process.env.SESSION_SECRET = randomBytes(32).toString('hex');
