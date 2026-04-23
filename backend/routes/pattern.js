const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');
const { fal } = require('@fal-ai/client');

const {
  quantizeColors, findNearestColor,
  precomputeLabPalette, rgbToLab, distLab,
} = require('../utils/colorUtils');
const DMC_COLORS = require('../utils/dmcColors');

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

    const gridSize  = Math.max(20, Math.min(150, parseInt(req.body.gridSize)  || 50));
    const numColors = Math.max(5,  Math.min(30,  parseInt(req.body.numColors) || 15));

    // Difficulty preset — each level has its own strength/steps and a tuned
    // prompt. Lower strength = closer to the photo. Earlier prompt was the
    // same blocky-pixel-art text for every level, which destroyed photo
    // detail even at "hard" and made the result look like the same generic
    // sprite regardless of subject. The new prompts shift along the
    // posterise ↔ photographic axis.
    const DIFFICULTY = {
      easy: {
        strength: 0.78, steps: 24, guidance: 4.0,
        prompt:
          'cross-stitch chart preview, bold solid colour blocks, very limited palette, ' +
          'clean posterised look, no gradients, no shading, no fine texture, ' +
          'simple recognisable shapes, the original subject must remain clearly identifiable',
      },
      medium: {
        strength: 0.62, steps: 32, guidance: 3.8,
        prompt:
          'soft cross-stitch chart style, gentle posterisation, smooth colour blocks, ' +
          'preserve the main subject and composition of the original photo, ' +
          'reduced colour count but retain hue relationships, mild flattening of textures',
      },
      hard: {
        strength: 0.45, steps: 40, guidance: 3.4,
        prompt:
          'detailed cross-stitch reference chart, light colour simplification only, ' +
          'preserve facial features, edges and key details of the original photo, ' +
          'keep highlights and shadows recognisable, maintain colour relationships',
      },
    };
    const difficulty = DIFFICULTY[req.body.difficulty] ? req.body.difficulty : 'medium';
    const { strength, steps, guidance, prompt } = DIFFICULTY[difficulty];

    const originalBuffer = req.file.buffer;
    let   workBuffer     = originalBuffer;
    let   falImageUrl    = null;

    // ── 1. Upload to fal.ai Storage (required) ──────────────────────────────
    console.log('⬆  Uploading to fal.ai storage…');
    const blob = new Blob([originalBuffer], { type: req.file.mimetype });
    try {
      falImageUrl = await fal.storage.upload(blob);
    } catch (err) {
      return res.status(502).json({
        error: `fal.ai upload failed: ${err.message}. Check FALL_API_KEY in .env.`,
      });
    }
    console.log('✅  Uploaded:', falImageUrl);

    // ── 2. AI image-to-image (required) ─────────────────────────────────────
    console.log(`🤖  Running fal.ai image-to-image (difficulty: ${difficulty})…`);
    let aiUrl;
    try {
      const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
        input: {
          image_url:           falImageUrl,
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
      return res.status(502).json({ error: `fal.ai model failed: ${err.message}` });
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
      grid:             finalGrid,
      colors:           finalColors,
      width,
      height,
      difficulty,
      originalImageUrl: falImageUrl,
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
