const express = require('express');
const { TEMPLATES } = require('../data/templates');
const { renderForDifficulty } = require('../utils/patternImage');

const router = express.Router();

// Templates ship as static modules — no PNG ships with them. We render
// once per template on first hit and memoise. Mobile then receives the
// same { imageDataUri } shape as /api/pattern, so the fast Image-based
// path is uniform across photo and template projects.
const templateImageCache = new Map();
async function getTemplateImage(t) {
  if (templateImageCache.has(t.id)) return templateImageCache.get(t.id);
  const uri = await renderForDifficulty(t.grid, t.colors, t.difficulty);
  templateImageCache.set(t.id, uri);
  return uri;
}

// GET /api/templates → light list (no grid)
router.get('/templates', (_req, res) => {
  res.json(
    TEMPLATES.map((t) => ({
      id:         t.id,
      name:       t.name,
      difficulty: t.difficulty,
      width:      t.width,
      height:     t.height,
      colors:     t.colors.length,
      // first 6 colour swatches for thumbnail strip
      swatches:   t.colors.slice(0, 6).map((c) => c.dmcHex),
    }))
  );
});

// GET /api/templates/:id → full pattern (grid + colors + PNG)
router.get('/templates/:id', async (req, res) => {
  const t = TEMPLATES.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found.' });
  try {
    const imageDataUri = await getTemplateImage(t);
    res.json({ ...t, imageDataUri });
  } catch (err) {
    console.error('template PNG render failed:', err);
    res.json(t); // graceful fallback — mobile renders via SVG
  }
});

module.exports = router;
