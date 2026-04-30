const express = require('express');
const mongo   = require('../lib/mongo');

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

// GET /api/projects → all synced projects, newest first
router.get('/projects', async (_req, res) => {
  try {
    const col = await projectsCol();
    const docs = await col.find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    res.json(docs);
  } catch (err) {
    console.error('GET /projects failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id → single project
router.get('/projects/:id', async (req, res) => {
  try {
    const col = await projectsCol();
    const doc = await col.findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ error: 'Project not found.' });
    res.json(doc);
  } catch (err) {
    console.error('GET /projects/:id failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects → upsert by `id`. The mobile app calls this on save
// AND on progress changes; upsert lets either case work without the client
// needing to track whether the server already has the record.
router.post('/projects', async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.id || !Array.isArray(p.grid) || !Array.isArray(p.colors)) {
      return res.status(400).json({ error: 'id, grid, colors required.' });
    }
    const doc = {
      id:         p.id,
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
    await col.updateOne({ id: doc.id }, { $set: doc }, { upsert: true });
    res.json(clean(doc));
  } catch (err) {
    console.error('POST /projects failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/projects/:id', async (req, res) => {
  try {
    const col = await projectsCol();
    const r = await col.deleteOne({ id: req.params.id });
    res.json({ ok: true, deleted: r.deletedCount });
  } catch (err) {
    console.error('DELETE /projects/:id failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
