const express = require('express');
const multer  = require('multer');
const sharp   = require('sharp');

const {
  quantizeColors, findNearestColor,
  precomputeLabPalette, assignUniqueDmc,
  rgbToLab, distLab, deltaE2000,
} = require('../utils/colorUtils');
const { renderForDifficulty } = require('../utils/patternImage');
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

// Symbols assigned to each colour — the chart-render layer maps these to
// geometric shapes for hard mode. Mobile uses them as a stable per-colour
// identifier in the DMC legend.
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

// ── helpers ─────────────────────────────────────────────────────────────────
function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Find nearest DMC thread using DeltaE 2000 — properly handles hue
// boundaries that DE76 stumbles on (saturated reds vs pinks, blue vs
// purple). DE2000 is heavier than DE76 but this runs only K × 141
// times per pattern (≤4500 calls total), so the perf cost is invisible
// while the colour fidelity bump is visible on every output.
function findNearestDMC(rgb) {
  const lab = rgbToLab(rgb);
  let minDist = Infinity;
  let nearestIdx = 0;
  for (let i = 0; i < DMC_LAB.length; i++) {
    const d = deltaE2000(lab, DMC_LAB[i]);
    if (d < minDist) { minDist = d; nearestIdx = i; }
  }
  return DMC_COLORS[nearestIdx];
}

// ── POST /api/pattern ────────────────────────────────────────────────────────
// Pure classical pipeline: clean photo → downsample → k-means in Lab →
// nearest DMC → difficulty-styled PNG. No external AI call, no API key,
// no rate limits, no hallucinations. Output is fully faithful to the
// user's photo, ~1 second end-to-end on a laptop.
router.post('/pattern', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    // Grid is capped at 70 — anything larger isn't practically embroiderable
    // by hand. Colours capped at 20 (the high end of the DMC catalogue
    // selectability — more than that and threads become hard to distinguish
    // by eye on real fabric).
    const gridSize  = Math.max(20, Math.min(70, parseInt(req.body.gridSize)  || 50));
    // 30 colour cap — past this real DMC threads start looking near-
    // identical to the human eye on fabric, so more centroids waste
    // palette slots without adding visible nuance.
    const numColors = Math.max(4,  Math.min(30, parseInt(req.body.numColors) || 20));
    const difficulty = ['easy', 'medium', 'hard'].includes(req.body.difficulty)
      ? req.body.difficulty
      : 'medium';

    const originalBuffer = req.file.buffer;

    // ── 1. Pre-process: orientation, vibrance, contrast stretch ───────────
    // Stay at the photo's full resolution for this pass so fine features
    // (eyes, mouth, eyelashes, jewelry) carry through downstream. We
    // boost saturation + linearly stretch contrast so dark accents
    // (pupils, nostrils, deep shadows) stay distinctly dark in Lab —
    // otherwise k-means tends to merge them into the surrounding fill
    // colour and the chart loses recognisable features.
    console.log(`📦  Original upload: ${(originalBuffer.length / 1024).toFixed(0)} KB (${req.file.mimetype})`);
    let prepBuffer;
    try {
      // No normalise() — sharp's per-channel histogram stretch was
      // pushing dominant body colours toward extremes (a tan body would
      // end up clipped to near-black).
      //
      // No pre-sharpen either: a sigma=1.0 unsharp at 2400px gets
      // averaged out by the 32× downsample, so all it does is amplify
      // JPEG noise/grain that the area-mean shrink would otherwise
      // smooth away. We sharpen later, on the final-grid PNG render.
      //
      // Saturation lift is bumped from 1.10 → 1.18 because k-means
      // weighting alone wasn't enough to keep low-saturation features
      // (kitten eyes, dog snout, teddy heart) distinct from the body
      // colour. Pushing chroma earlier in the pipeline gives DE2000 a
      // bigger gap to latch onto when assigning thread palettes.
      prepBuffer = await sharp(originalBuffer)
        .rotate()                                        // honour EXIF orientation
        .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
        .modulate({ saturation: 1.18 })                  // pre-quantisation chroma lift
        .png({ compressionLevel: 1 })                    // lossless — no JPEG noise compounding downstream
        .toBuffer();
    } catch (err) {
      console.error('❌  sharp pre-process failed:', err);
      return res.status(400).json({ error: `Görsel okunamadı: ${err.message}` });
    }
    console.log(`📦  After prep:      ${(prepBuffer.length / 1024).toFixed(0)} KB (cleaned, max 2400px)`);

    // ── 2. Read aspect ratio for grid rectangle ─────────────────────────────
    const meta = await sharp(prepBuffer).metadata();
    const aspectRatio = meta.height / meta.width;
    const gridWidth   = gridSize;
    const gridHeight  = Math.max(1, Math.round(gridSize * aspectRatio));

    // ── 3. Multi-step downsample to grid → raw pixel buffer ─────────────────
    // Single-step shrink from 1600 to 50 (32×) blurs out small features
    // (eyes, lips) because lanczos averages over too many source pixels
    // at once. Going through pyramid steps preserves them better — but
    // we DON'T sharpen between steps. Multiple sharpen passes compound
    // and end up driving boundary pixels to extremes (the body would
    // turn near-black). Only one sharpen at the very end, on the final
    // grid size, where it can't compound further.
    console.log(`📐  Pyramid downsample to ${gridWidth}×${gridHeight}…`);
    let stepBuf = prepBuffer;
    const longest = Math.max(meta.width, meta.height);
    const targetLongest = Math.max(gridWidth, gridHeight);
    const sizes = [];
    let s = longest;
    while (s > targetLongest * 4) {
      s = Math.max(targetLongest * 2, Math.round(s / 3));
      sizes.push(s);
    }
    // PNG (lossless) between pyramid steps — the previous JPEG-92 chain
    // was re-compressing the same image 2-3× before we even quantised,
    // baking 8×8 DCT block artefacts and chroma fringes into the cells
    // k-means then "saw" as legitimate colours. Switching to PNG costs
    // ~5 ms per step and produces a cleaner colour distribution
    // downstream (visible on flat areas like sky and teddy bear fur).
    for (const stepSize of sizes) {
      stepBuf = await sharp(stepBuf)
        .resize(stepSize, stepSize, { fit: 'inside' })
        .png({ compressionLevel: 1 })
        .toBuffer();
    }

    // 2× super-sample the final shrink so each grid cell maps to a 2×2
    // block of source pixels we can inspect individually. Plain shrink
    // collapses each cell to a single area-mean, which on a 50×50 grid
    // means a teddy bear eye (≈1 cell) gets averaged with surrounding
    // fur — the cell ends up "dark brown" not black, so even when
    // k-means correctly reserves a centroid for it, the centroid sits
    // on the averaged colour and the nearest DMC is a brown thread.
    // Holding 2×2 source pixels lets us pick the darkest sample for
    // dark-accent cells (eyes, pupils, nostrils) and keep the mean
    // for everything else.
    const SS = 2;
    const { data: hiData, info: hiInfo } = await sharp(stepBuf)
      .resize(gridWidth * SS, gridHeight * SS, { fit: 'fill' })
      .flatten({ background: '#ffffff' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { channels } = hiInfo;
    const width = gridWidth, height = gridHeight;

    // ── 4. Pixel array [[r,g,b], …] — dark-accent-aware downsample ─────────
    // For each grid cell we have SS×SS source pixels. We compute:
    //   • mean RGB (the colour an ordinary area-mean shrink would give)
    //   • darkest source pixel (lowest luminance within the cell)
    //   • dark gap = mean luminance − darkest luminance
    //
    // Then we *smoothly blend* between mean and darkest based on the
    // gap: small gaps (normal fur texture, smooth shading) leave the
    // cell at its mean; very large gaps (a black eye in a 2×2 mostly
    // covered by light fur) pull it fully to the darkest sample. The
    // hard-switch version of this fix made the whole chart noticeably
    // darker because mid-tone texture variations also tripped it; a
    // 30→90 ramp keeps tiny gaps inert and only honours the strong
    // small-dark-on-light pattern that signals actual accents.
    const pixels = new Array(gridWidth * gridHeight);
    const hiStride = gridWidth * SS * channels;
    for (let gr = 0; gr < gridHeight; gr++) {
      for (let gc = 0; gc < gridWidth; gc++) {
        let rSum = 0, gSum = 0, bSum = 0, lSum = 0;
        let darkR = 0, darkG = 0, darkB = 0, darkLum = Infinity;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const off = (gr * SS + dy) * hiStride + (gc * SS + dx) * channels;
            const r = hiData[off], g = hiData[off + 1], b = hiData[off + 2];
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            rSum += r; gSum += g; bSum += b; lSum += l;
            if (l < darkLum) { darkLum = l; darkR = r; darkG = g; darkB = b; }
          }
        }
        const N = SS * SS;
        const meanR = rSum / N, meanG = gSum / N, meanB = bSum / N;
        const meanLum = lSum / N;
        const darkGap = meanLum - darkLum;
        // Blend factor: 0 below gap=30 (no change), 1 above gap=90
        // (full dark sample), linear in between. Tuned so a black-on-
        // light-fur eye (gap ≈ 100+) goes fully dark while ordinary
        // fur/skin texture (gap < 30) is untouched.
        const t = Math.max(0, Math.min(1, (darkGap - 30) / 60));
        const r = Math.round(meanR * (1 - t) + darkR * t);
        const g = Math.round(meanG * (1 - t) + darkG * t);
        const b = Math.round(meanB * (1 - t) + darkB * t);
        pixels[gr * gridWidth + gc] = [r, g, b];
      }
    }

    // ── 4b. Per-cell weights: edges + saturation + local-dark accents ─────
    // Three signals push k-means toward perceptually-important pixels:
    //
    //   • Sobel edge magnitude — boundaries between regions (eye/face,
    //     hair/sky, jewellery/skin) carry the colour pairs the human
    //     eye latches onto.
    //   • Saturation — vivid colours (red shirt, blue eyes) are often a
    //     small fraction of pixels but sit far from neutrals.
    //   • Local-dark accents — pixels markedly darker than their 5×5
    //     neighbourhood. This catches teddy bear eyes, nostrils, pupils,
    //     deep-shadow seams etc. that occupy 1–2 grid cells. Without
    //     this signal, pyramid downsample averages them with surrounding
    //     fur, k-means refuses to spend a centroid on so few pixels, and
    //     the resulting palette has no thread close to "black-on-fur" —
    //     so the eye literally disappears in the output chart.
    //
    // Final weight = 1 + edgeBonus[0..4] + satBonus[0..1.5] + darkBonus[0..5]
    //              → range 1..11.5 (was 1..4.5)
    const weights = new Array(pixels.length).fill(1);
    const lum = pixels.map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);

    // 5×5 local-mean luminance — used to detect dark accents that are
    // dark *relative to their surroundings*, not just globally dark.
    // A black eye on a brown bear is locally dark; a uniformly dark
    // shadow is not — and we don't want to pull a centroid into the
    // shadow at the expense of feature colours.
    const localMean = new Array(pixels.length).fill(0);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        let sum = 0, n = 0;
        const r0 = Math.max(0, r - 2), r1 = Math.min(height - 1, r + 2);
        const c0 = Math.max(0, c - 2), c1 = Math.min(width  - 1, c + 2);
        for (let rr = r0; rr <= r1; rr++) {
          for (let cc = c0; cc <= c1; cc++) {
            sum += lum[rr * width + cc];
            n++;
          }
        }
        localMean[r * width + c] = sum / n;
      }
    }

    for (let r = 1; r < height - 1; r++) {
      for (let c = 1; c < width - 1; c++) {
        const idx = r * width + c;
        const gx =
          -lum[(r-1)*width + (c-1)] - 2*lum[r*width + (c-1)] - lum[(r+1)*width + (c-1)]
          + lum[(r-1)*width + (c+1)] + 2*lum[r*width + (c+1)] + lum[(r+1)*width + (c+1)];
        const gy =
          -lum[(r-1)*width + (c-1)] - 2*lum[(r-1)*width + c] - lum[(r-1)*width + (c+1)]
          + lum[(r+1)*width + (c-1)] + 2*lum[(r+1)*width + c] + lum[(r+1)*width + (c+1)];
        const edgeMag = Math.sqrt(gx * gx + gy * gy);
        // Cap raised 2 → 4 and ramp tightened (÷100 → ÷60) — small
        // sharp features like eyelashes / pupil rims hit the cap now
        // instead of plateauing mid-ramp where they competed evenly
        // with broad smooth gradients.
        const edgeBonus = Math.min(4, edgeMag / 60);

        const [pr, pg, pb] = pixels[idx];
        const mx = Math.max(pr, pg, pb);
        const mn = Math.min(pr, pg, pb);
        const sat = mx > 0 ? (mx - mn) / mx : 0;
        const satBonus = sat * 1.5;

        // Dark accent: pixel must be ≥25 luminance units below its
        // local 5×5 mean before the bonus engages, then ramps to 5×
        // weight at a 75-unit gap. The dead-zone keeps generic shadow
        // gradients from triggering it; only pop-out dark spots qualify.
        const darkGap = localMean[idx] - lum[idx];
        const darkBonus = Math.min(5, Math.max(0, (darkGap - 25) / 10));

        weights[idx] = 1 + edgeBonus + satBonus + darkBonus;
      }
    }

    // ── 5. K-means colour quantisation in Lab (weighted, multi-restart) ────
    console.log(`🎨  Quantising to ${numColors} colours (weighted, 3 restarts)…`);
    const palette = quantizeColors(pixels, numColors, { weights, restarts: 3 });

    // ── 6. Map K centroids → K *unique* DMC threads ─────────────────────────
    // Greedy bipartite matching: without it, k-means routinely produces
    // clusters that all snap to the same DMC after nearest-thread lookup
    // (a teddy bear ends up with "Pearl Gray" 3× and "Brown Gray" 3×,
    // collapsing 20 requested palette slots into ~7 actual threads). With
    // it, we get K distinct DMC colours and the pixel-to-palette
    // assignment is then done against those DMC colours directly — so
    // the chart you see is the chart you stitch.
    const dmcIdxs = assignUniqueDmc(palette, DMC_LAB);
    const dmcPaletteRgb = dmcIdxs.map((di) => {
      const hex = DMC_COLORS[di].hex;
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    });
    const dmcPaletteLab = precomputeLabPalette(dmcPaletteRgb);

    // ── 7. Assign every pixel to its nearest DMC palette index ──────────────
    const grid2D = [];
    for (let row = 0; row < height; row++) {
      const rowArr = [];
      for (let col = 0; col < width; col++) {
        const px = pixels[row * width + col];
        rowArr.push(findNearestColor(px, dmcPaletteLab));
      }
      grid2D.push(rowArr);
    }

    const colors = dmcIdxs.map((di, id) => {
      const dmc = DMC_COLORS[di];
      return {
        id,
        hex:     dmc.hex,
        dmcCode: dmc.code,
        dmcName: dmc.name,
        dmcHex:  dmc.hex,
        count:   0,
      };
    });
    for (const row of grid2D)
      for (const cid of row)
        colors[cid].count++;

    // Drop any DMC slot that ended up with zero pixels after reassignment
    // (rare — happens when greedy DMC matching parks a centroid on a
    // thread that no real pixel prefers). Keeping them would pollute the
    // legend with phantom threads the stitcher never uses.
    const usedColors = colors.filter((c) => c.count > 0);
    const sorted = usedColors.sort((a, b) => b.count - a.count);
    const idMap  = {};
    sorted.forEach((c, newId) => { idMap[c.id] = newId; });
    const finalGrid   = grid2D.map((row) => row.map((id) => idMap[id]));
    const finalColors = sorted.map((c, i) => ({ ...c, id: i, symbol: SYMBOLS[i % SYMBOLS.length] }));

    // ── 8. Pre-render the delivery PNG (style varies by difficulty) ─────────
    // Mobile uses this as a single textured Image quad in approval, the
    // workshop list, and project detail — pinch/pan are GPU-only, no
    // SVG rebuilds. Easy = pixel blocks, medium = + grid lines,
    // hard = tinted cells + geometric symbols + grid.
    console.log(`🖼   Rendering ${difficulty} chart PNG…`);
    const imageDataUri = await renderForDifficulty(finalGrid, finalColors, difficulty);
    if (imageDataUri) {
      console.log(`   PNG: ~${Math.round(imageDataUri.length * 0.75 / 1024)} KB`);
    }

    console.log('✅  Pattern ready!');
    res.json({
      grid:    finalGrid,
      colors:  finalColors,
      width,
      height,
      difficulty,
      imageDataUri,
    });

  } catch (err) {
    console.error('❌  Pattern generation error:', err);
    res.status(500).json({ error: err.message || 'Pattern generation failed.' });
  }
});

module.exports = router;
