const { getAllowedOrigins } = require('../config/origins');
function createVerifyRequestOrigin(allowedOrigins = getAllowedOrigins()) {
return function verifyRequestOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const origin = req.get('Origin');
  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  return next();
};
}

module.exports = createVerifyRequestOrigin();
module.exports.createVerifyRequestOrigin = createVerifyRequestOrigin;
