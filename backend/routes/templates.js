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

// GET /api/templates → list with preview-grade pattern data
// Includes the full grid + palette so the mobile collection can render a
// real SVG preview thumbnail without firing N detail requests. Payload is
// still tiny (9 templates × ~150 cells × 1 int ≈ a few KB on the wire);
// keeping `colors: number` and `swatches` for backwards compatibility so
// any caller still reading those flags doesn't break.
router.get('/templates', (_req, res) => {
  res.json(
    TEMPLATES.map((t) => ({
      id:         t.id,
      name:       t.name,
      difficulty: t.difficulty,
      width:      t.width,
      height:     t.height,
      colors:     t.colors.length,
      // first 6 colour swatches for legacy thumbnail strip
      swatches:   t.colors.slice(0, 6).map((c) => c.dmcHex),
      // Preview-grade pattern data — grid is a 2D int array of palette
      // indices, palette is the trimmed colour list (no `count` to keep
      // the payload light; the renderer only needs dmcHex per index).
      grid:       t.grid,
      palette:    t.colors.map((c) => ({ id: c.id, dmcHex: c.dmcHex })),
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
