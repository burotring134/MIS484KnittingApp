const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');
const { fal } = require('@fal-ai/client');

const {
  quantizeColors, findNearestColor,
  precomputeLabPalette, rgbToLab, distLab,
} = require('../utils/colorUtils');
const DMC_COLORS = require('../data/dmcColors');

// Pre-compute Lab values for the entire DMC catalogue once at module load
// so DMC matching is just one Lab convert per query + N cheap distLabs.
const DMC_LAB = DMC_COLORS.map((c) => {
  const r = parseInt(c.hex.slice(1, 3), 16);
  const g = parseInt(c.hex.slice(3, 5), 16);
  const b = parseInt(c.hex.slice(5, 7), 16);
  return rgbToLab([r, g, b]);
});

const router = express.Router();

// Symbols assigned to each colour — matches traditional cross-stitch chart style
// (large, distinct Unicode chars that render clearly inside small grid cells)
const SYMBOLS = [
  '■', '●', '▲', '★', '♦', '♥', '+', '▼', '◆', '○',
  '□', '△', '☆', '◇', '♡', '×', '❖', '◉', '✚', '✿',
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
];

// ── multer: store uploads in memory ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── fal.ai client ───────────────────────────────────────────────────────────
fal.config({ credentials: process.env.FALL_API_KEY });

// ── helpers ─────────────────────────────────────────────────────────────────
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Find nearest DMC thread for an RGB colour using DeltaE 76 in CIELAB —
// matches human colour perception far better than RGB euclidean distance,
// so reds stay reds and not random browns when the centroid sits near a
// hue boundary.
function findNearestDMC(rgb) {
  const lab = rgbToLab(rgb);
  let minDist = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < DMC_LAB.length; i++) {
    const d = distLab(lab, DMC_LAB[i]);
    if (d < minDist) { minDist = d; nearestIdx = i; }
  }
  return DMC_COLORS[nearestIdx];
}

// ── POST /api/pattern ────────────────────────────────────────────────────────
router.post('/pattern', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Grid is capped at 70 — anything larger isn't practically embroiderable
    // by hand (>4900 stitches per project). Colours capped at 20 since more
    // than that produces a DMC list that's hard to distinguish on real thread.
    const gridSize  = Math.max(20, Math.min(70, parseInt(req.body.gridSize)  || 40));
    const numColors = Math.max(4,  Math.min(20, parseInt(req.body.numColors) || 10));

    // Difficulty preset — all levels push toward the stitch-chart look (bold
    // solid colour blocks, no gradients). Higher strength = more stylisation
    // applied by the model. Earlier "hard" used strength 0.45 which kept the
    // photo nearly intact, so after quantisation the grid looked like dithered
    // photo noise instead of an embroiderable chart.
    const DIFFICULTY = {
      easy: {
        strength: 0.82, steps: 26, guidance: 4.2,
        prompt:
          'cross-stitch chart, bold solid colour blocks, very limited palette, ' +
          'clean posterised sprite-art look, chunky simple shapes, ' +
          'no gradients, no shading, no fine texture, no noise, ' +
          'original subject must stay clearly recognisable',
      },
      medium: {
        strength: 0.72, steps: 30, guidance: 4.0,
        prompt:
          'cross-stitch chart, solid flat colour blocks, clean posterisation, ' +
          'limited palette, preserve the main subject and composition, ' +
          'no gradients, no fine texture, no photographic noise, chart-style flattening',
      },
      hard: {
        strength: 0.62, steps: 34, guidance: 3.8,
        prompt:
          'detailed cross-stitch chart, solid flat colour blocks with clean posterisation, ' +
          'preserve key details and edges of the original subject, ' +
          'no gradients or smooth shading, no photographic texture, ' +
          'chart-style flattening, bold defined colour regions',
      },
    };
    const difficulty = DIFFICULTY[req.body.difficulty] ? req.body.difficulty : 'medium';
    const { strength, steps, guidance, prompt } = DIFFICULTY[difficulty];

    const originalBuffer = req.file.buffer;
    let   workBuffer     = originalBuffer;

    // ── 1. Pre-process upload: shrink to a sane size, send as data URI ──────
    // We used to call fal.storage.upload(blob) on the raw camera JPEG, which
    // intermittently failed with HTTP 500 — the fal storage endpoint doesn't
    // like multi-megabyte JPEGs. Resizing first and inlining as a data URI
    // bypasses fal.storage entirely (the model endpoint accepts data URIs)
    // and is more reliable + faster end-to-end since there's one fewer HTTP
    // round trip.
    console.log(`📦  Original upload: ${(originalBuffer.length / 1024).toFixed(0)} KB (${req.file.mimetype})`);
    let prepBuffer;
    try {
      prepBuffer = await sharp(originalBuffer)
        .rotate()                                  // honour EXIF orientation
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (err) {
      console.error('❌  sharp pre-resize failed:', err);
      return res.status(400).json({ error: `Görsel okunamadı: ${err.message}` });
    }
    console.log(`📦  After resize:    ${(prepBuffer.length / 1024).toFixed(0)} KB (image/jpeg, max 1024px)`);

    const dataUri = `data:image/jpeg;base64,${prepBuffer.toString('base64')}`;

    // ── 2. AI image-to-image ────────────────────────────────────────────────
    console.log(`🤖  Running fal.ai image-to-image (difficulty: ${difficulty})…`);
    let aiUrl;
    try {
      const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
        input: {
          image_url:           dataUri,
          prompt,
          strength,
          num_inference_steps: steps,
          guidance_scale:      guidance,
          num_images:          1,
          seed:                42,
        },
        logs: false,
      });
      aiUrl = result?.data?.images?.[0]?.url;
    } catch (err) {
      console.error('❌  fal.ai model error:', err);
      return res.status(502).json({
        error: `fal.ai model failed: ${err.message}. ` +
               `Check FALL_API_KEY validity and account credits at fal.ai/dashboard.`,
      });
    }
    if (!aiUrl) {
      return res.status(502).json({ error: 'fal.ai returned no image.' });
    }

    // ── 3. Download AI image ────────────────────────────────────────────────
    console.log('⬇  Downloading AI image…');
    const resp = await fetch(aiUrl);
    if (!resp.ok) {
      return res.status(502).json({ error: `Could not download AI image (HTTP ${resp.status}).` });
    }
    workBuffer = Buffer.from(await resp.arrayBuffer());
    console.log('✅  AI image ready');

    // ── 4. Read aspect ratio ────────────────────────────────────────────────
    const meta = await sharp(workBuffer).metadata();
    const aspectRatio  = meta.height / meta.width;
    const gridWidth    = gridSize;
    const gridHeight   = Math.max(1, Math.round(gridSize * aspectRatio));

    // ── 5. Resize → raw pixel buffer ────────────────────────────────────────
    console.log(`📐  Resizing to ${gridWidth}×${gridHeight}…`);
    const { data: rawData, info } = await sharp(workBuffer)
      .resize(gridWidth, gridHeight, { fit: 'fill' })
      .flatten({ background: '#ffffff' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // ── 6. Extract pixel array [[r,g,b], …] ─────────────────────────────────
    const pixels = [];
    for (let i = 0; i < rawData.length; i += channels) {
      pixels.push([rawData[i], rawData[i + 1], rawData[i + 2]]);
    }

    // ── 7. K-means colour quantisation (in Lab space) ───────────────────────
    console.log(`🎨  Quantising to ${numColors} colours…`);
    const palette = quantizeColors(pixels, numColors);

    // ── 8. Build 2-D grid + assign colour indices (Lab nearest) ─────────────
    const paletteLab = precomputeLabPalette(palette);
    const grid2D = [];
    for (let row = 0; row < height; row++) {
      const rowArr = [];
      for (let col = 0; col < width; col++) {
        const px = pixels[row * width + col];
        rowArr.push(findNearestColor(px, paletteLab));
      }
      grid2D.push(rowArr);
    }

    // ── 9. Map palette → DMC threads ────────────────────────────────────────
    const colors = palette.map((rgb, id) => ({
      id,
      hex:     rgbToHex(rgb),
      dmcCode: findNearestDMC(rgb).code,
      dmcName: findNearestDMC(rgb).name,
      dmcHex:  findNearestDMC(rgb).hex,
      count:   0,
    }));

    // Count stitches per colour
    for (const row of grid2D)
      for (const cid of row)
        colors[cid].count++;

    // Sort most-used first & re-index so the grid still points to the right colour
    const sorted = [...colors].sort((a, b) => b.count - a.count);
    const idMap  = {};
    sorted.forEach((c, newId) => { idMap[c.id] = newId; });

    const finalGrid   = grid2D.map((row) => row.map((id) => idMap[id]));
    const finalColors = sorted.map((c, i) => ({ ...c, id: i, symbol: SYMBOLS[i % SYMBOLS.length] }));

    console.log('✅  Pattern ready!');
    res.json({
      grid:    finalGrid,
      colors:  finalColors,
      width,
      height,
      difficulty,
    });

  } catch (err) {
    console.error('❌  Pattern generation error:', err);
    res.status(500).json({ error: err.message || 'Pattern generation failed.' });
  }
});

// ── GET /api/verify-fal ──────────────────────────────────────────────────────
// Uploads a 1×1 test pixel to fal.ai storage to confirm the API key works.
router.get('/verify-fal', async (_req, res) => {
  const key = process.env.FALL_API_KEY;
  if (!key) {
    return res.json({ ok: false, message: 'FALL_API_KEY not set in .env' });
  }

  try {
    // Smallest valid PNG (1×1 transparent pixel)
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    const blob = new Blob([tinyPng], { type: 'image/png' });
    const uploadedUrl = await fal.storage.upload(blob);
    res.json({ ok: true, message: 'fal.ai API key is valid ✅', uploadedUrl });
  } catch (err) {
    res.json({ ok: false, message: `fal.ai error: ${err.message}` });
  }
});

module.exports = router;
