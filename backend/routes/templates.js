const express = require('express');
const { TEMPLATES } = require('../templates/templates');

const router = express.Router();

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

// GET /api/templates/:id → full pattern (grid + colors)
router.get('/templates/:id', (req, res) => {
  const t = TEMPLATES.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found.' });
  res.json(t);
});

module.exports = router;
