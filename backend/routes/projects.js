const express = require('express');
const mongo   = require('../lib/mongo');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Single collection for cross-stitch projects synced from the mobile app.
// Mongo's _id stays internal — clients identify projects by their own `id`
// (a UUID-ish string generated on the device) so offline-created projects
// can be uploaded later without an extra round trip.
const COLLECTION = 'projects';

async function projectsCol() {
  const db = await mongo.getDb();
  return db.collection(COLLECTION);
}

// Strip Mongo's _id before returning to the client; we only contracted on
// the device-generated `id` field.
function clean(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

// All project routes require a verified bearer token. req.user.id is the
// canonical owner — clients can never override it via the body.
router.use('/projects', requireAuth);

// GET /api/projects → projects owned by the authenticated user, newest first
router.get('/projects', async (req, res) => {
  try {
    const col = await projectsCol();
    const docs = await col.find({ userId: req.user.id }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    res.json(docs);
  } catch (err) {
    console.error('GET /projects failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id → single project (only if the caller owns it)
router.get('/projects/:id', async (req, res) => {
  try {
    const col = await projectsCol();
    const doc = await col.findOne(
      { id: req.params.id, userId: req.user.id },
      { projection: { _id: 0 } },
    );
    if (!doc) return res.status(404).json({ error: 'Project not found.' });
    res.json(doc);
  } catch (err) {
    console.error('GET /projects/:id failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects → upsert by (userId, id). The mobile app calls this on
// save AND on progress changes; upsert lets either case work without the
// client needing to track whether the server already has the record.
router.post('/projects', async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.id || !Array.isArray(p.grid) || !Array.isArray(p.colors)) {
      return res.status(400).json({ error: 'id, grid, colors required.' });
    }
    const doc = {
      id:         p.id,
      userId:     req.user.id,
      name:       p.name       || 'Untitled',
      source:     p.source     || 'photo',
      difficulty: p.difficulty || 'medium',
      width:      p.width,
      height:     p.height,
      grid:       p.grid,
      colors:     p.colors,
      completed:  p.completed  || {},
      createdAt:  p.createdAt  || Date.now(),
      updatedAt:  Date.now(),
    };
    const col = await projectsCol();
    await col.updateOne(
      { id: doc.id, userId: req.user.id },
      { $set: doc },
      { upsert: true },
    );
    res.json(clean(doc));
  } catch (err) {
    console.error('POST /projects failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — only deletes if the caller owns it
router.delete('/projects/:id', async (req, res) => {
  try {
    const col = await projectsCol();
    const r = await col.deleteOne({ id: req.params.id, userId: req.user.id });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (err) {
    console.error('DELETE /projects/:id failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
