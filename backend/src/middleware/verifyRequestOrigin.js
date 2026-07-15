const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
]);

function verifyRequestOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const origin = req.get('Origin');
  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  return next();
}

module.exports = verifyRequestOrigin;
