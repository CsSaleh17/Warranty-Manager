function requireAuthentication(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }
  return next();
}

module.exports = requireAuthentication;
