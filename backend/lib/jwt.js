const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.warn('');
  console.warn('═══════════════════════════════════════════════════════════════');
  console.warn('⚠️  JWT_SECRET missing — auth endpoints will refuse to sign');
  console.warn('   Add JWT_SECRET=<random 48+ bytes> to .env at project root');
  console.warn('═══════════════════════════════════════════════════════════════');
  console.warn('');
}

const ALGORITHM = 'HS256';
const EXPIRES_IN = '180d';

function signUserToken(userId) {
  if (!SECRET) throw new Error('JWT_SECRET not configured on the server.');
  return jwt.sign({ sub: userId }, SECRET, { algorithm: ALGORITHM, expiresIn: EXPIRES_IN });
}

function verifyUserToken(token) {
  if (!SECRET) throw new Error('JWT_SECRET not configured on the server.');
  return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] });
}

module.exports = { signUserToken, verifyUserToken };
