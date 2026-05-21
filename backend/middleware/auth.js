const { verifyUserToken } = require('../lib/jwt');

// Express middleware that extracts the Bearer token, verifies it, and
// attaches the verified user id to req.user.id. Routes downstream can
// then trust that req.user.id is the authenticated owner without ever
// reading client-supplied identifiers.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }
  try {
    const payload = verifyUserToken(m[1]);
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth };
