const { createRemoteJWKSet, jwtVerify } = require('jose');

// Apple publishes the public keys it uses to sign Sign-in-with-Apple
// identity tokens at this well-known JWKS endpoint. createRemoteJWKSet
// caches keys and refreshes on rotation, so we don't refetch per request.
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const APPLE_ISSUER = 'https://appleid.apple.com';

function getAudience() {
  // Default to the iOS bundle id used in app.json. If you ever ship an
  // Apple-Sign-In capable web client, add its services-id to the audience
  // list as a second value.
  return process.env.APPLE_BUNDLE_ID || 'app.threadia.mobile';
}

// Verifies an Apple identity token. Returns the verified payload —
// `sub` is the stable per-app user id we should persist as the
// account's external identifier, `email` is present on the first
// authorisation and on subsequent ones if the user has not revoked it.
async function verifyAppleIdentityToken(identityToken) {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: APPLE_ISSUER,
    audience: getAudience(),
  });
  return payload;
}

module.exports = { verifyAppleIdentityToken };
