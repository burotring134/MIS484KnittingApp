const express = require('express');
const mongo   = require('../lib/mongo');
const { verifyAppleIdentityToken } = require('../lib/appleAuth');
const { signUserToken } = require('../lib/jwt');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const USERS_COL = 'users';
const PROJECTS_COL = 'projects';

async function usersCol() {
  const db = await mongo.getDb();
  return db.collection(USERS_COL);
}

async function projectsCol() {
  const db = await mongo.getDb();
  return db.collection(PROJECTS_COL);
}

// Strip Mongo's _id before returning to the client.
function publicUser(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

// POST /api/auth/apple
// Body: { identityToken, fullName?, claimProjectIds? }
//
// - identityToken    : the JWT iOS returns from AppleAuthentication.signInAsync
// - fullName         : { givenName, familyName } — Apple only sends this on
//                      the *very first* authorisation, so the client posts
//                      whatever it has and we store the first non-empty value.
// - claimProjectIds  : array of device-generated project ids that the user
//                      wants to import into their freshly-linked account.
//                      Auto-claim policy: any matching project that has no
//                      userId yet is reassigned. Already-owned projects are
//                      left untouched (defence against malicious clients
//                      submitting other users' ids).
router.post('/auth/apple', async (req, res) => {
  try {
    const { identityToken, fullName, claimProjectIds } = req.body || {};
    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required.' });
    }

    let payload;
    try {
      payload = await verifyAppleIdentityToken(identityToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Apple identity token.' });
    }

    const appleSub = payload.sub;
    if (!appleSub) {
      return res.status(401).json({ error: 'Apple token missing sub claim.' });
    }

    const col = await usersCol();
    const now = Date.now();

    // Build the $set/$setOnInsert split so the email lands on first
    // insert (Apple only sends it once) and the displayName captures
    // fullName from the very first authorisation. lastLoginAt and
    // updatedAt advance on every call.
    const onInsert = {
      id: `u_${now}_${Math.random().toString(36).slice(2, 8)}`,
      appleSub,
      createdAt: now,
    };
    if (payload.email) onInsert.email = payload.email;
    if (fullName?.givenName || fullName?.familyName) {
      onInsert.displayName = [fullName.givenName, fullName.familyName]
        .filter(Boolean).join(' ').trim() || undefined;
    }

    await col.updateOne(
      { appleSub },
      { $setOnInsert: onInsert, $set: { lastLoginAt: now, updatedAt: now } },
      { upsert: true },
    );

    const user = await col.findOne({ appleSub }, { projection: { _id: 0 } });

    // Auto-claim: reassign anonymous (userId-less) projects to this
    // account. Bounded to ids the client actually has, so an attacker
    // can't enumerate the namespace.
    let claimedCount = 0;
    if (Array.isArray(claimProjectIds) && claimProjectIds.length > 0) {
      const ids = claimProjectIds
        .filter((x) => typeof x === 'string' && x.length > 0)
        .slice(0, 500);
      if (ids.length > 0) {
        const projCol = await projectsCol();
        const result = await projCol.updateMany(
          { id: { $in: ids }, $or: [{ userId: { $exists: false } }, { userId: null }] },
          { $set: { userId: user.id, updatedAt: now } },
        );
        claimedCount = result.modifiedCount || 0;
      }
    }

    const token = signUserToken(user.id);
    res.json({ token, user: publicUser(user), claimedCount });
  } catch (err) {
    console.error('POST /auth/apple failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/account
// Apple App Review Guideline 5.1.1(v) requires apps with account
// creation to also offer account deletion from inside the app. This
// is the one-step backend half of that flow:
//
//   1. authenticated request → req.user.id is the caller
//   2. delete every project owned by that user
//   3. delete the user document itself
//
// We don't soft-delete — a single round trip wipes the row. The
// client signs out locally after this returns so the next launch
// lands on LoginScreen with no cached token.
//
// Apple's own data lives at the Apple ID level; our delete only
// severs the link between that Apple user and our account record.
// If the same Apple ID signs in again later it will be treated as a
// brand-new user (fresh upsert path in /auth/apple above).
router.delete('/auth/account', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await usersCol();
    const projects = await projectsCol();

    const projResult = await projects.deleteMany({ userId });
    const userResult = await users.deleteOne({ id: userId });

    if (userResult.deletedCount === 0) {
      // Already gone — idempotent: still report success so the
      // client's sign-out path doesn't get stuck on a 404.
      return res.json({ ok: true, deletedProjects: projResult.deletedCount, deletedUser: 0 });
    }
    res.json({
      ok: true,
      deletedProjects: projResult.deletedCount,
      deletedUser: userResult.deletedCount,
    });
  } catch (err) {
    console.error('DELETE /auth/account failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
