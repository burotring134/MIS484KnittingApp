// Colour utilities — k-means++ quantisation and nearest-colour lookup,
// all operating in CIELAB so distances match human perception. RGB→Lab is
// done once per pixel up front, then everything stays in Lab until we
// convert centroids back at the end.

// ── colour-space conversions ────────────────────────────────────────────────
// sRGB (0–255) ↔ CIELAB (D65)

function srgbToLinear(v) {
  v /= 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

function linearToSrgb(v) {
  const out = v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
  return Math.max(0, Math.min(255, Math.round(out * 255)));
}

function rgbToLab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);

  // linear sRGB → XYZ (D65)
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

  // XYZ → Lab
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb([L, a, b]) {
  // Lab → XYZ
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const fInv = (t) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  const x = Xn * fInv(fx);
  const y = Yn * fInv(fy);
  const z = Zn * fInv(fz);

  // XYZ → linear sRGB
  const lr =  3.2404542 * x + -1.5371385 * y + -0.4985314 * z;
  const lg = -0.9692660 * x +  1.8760108 * y +  0.0415560 * z;
  const lb =  0.0556434 * x + -0.2040259 * y +  1.0572252 * z;

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

// DeltaE 76 — euclidean in Lab. Cheap and already a big perceptual
// improvement over RGB euclidean.
function distLab([L1, a1, b1], [L2, a2, b2]) {
  const dL = L1 - L2, da = a1 - a2, db = b1 - b2;
  return dL * dL + da * da + db * db;
}

// ── K-means++ quantisation in Lab ────────────────────────────────────────────
function quantizeColors(pixels, k) {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => [...p]);

  // Convert all pixels to Lab once
  const lab = pixels.map(rgbToLab);

  // Sample for init speed (cap at 3 000)
  const sampleSize = Math.min(lab.length, 3000);
  const step = Math.max(1, Math.floor(lab.length / sampleSize));
  const sample = [];
  for (let i = 0; i < lab.length && sample.length < sampleSize; i += step) {
    sample.push(lab[i]);
  }

  // K-means++ init in Lab
  const centroids = [sample[Math.floor(Math.random() * sample.length)].slice()];
  while (centroids.length < k) {
    const dists = sample.map((p) => {
      let minD = Infinity;
      for (const c of centroids) {
        const d = distLab(p, c);
        if (d < minD) minD = d;
      }
      return minD;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    if (total === 0) {
      centroids.push(sample[centroids.length % sample.length].slice());
      continue;
    }
    let r = Math.random() * total;
    let chosen = sample.length - 1;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroids.push(sample[chosen].slice());
  }

  // Lloyd iterations in Lab — average Lab triplets each round
  const MAX_ITER = 25;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const sums   = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (const px of lab) {
      let minD = Infinity, nearest = 0;
      for (let j = 0; j < k; j++) {
        const d = distLab(px, centroids[j]);
        if (d < minD) { minD = d; nearest = j; }
      }
      sums[nearest][0] += px[0];
      sums[nearest][1] += px[1];
      sums[nearest][2] += px[2];
      counts[nearest]++;
    }

    let changed = false;
    for (let j = 0; j < k; j++) {
      if (counts[j] === 0) {
        // Reseed empty cluster from a random pixel (in Lab)
        const rand = lab[Math.floor(Math.random() * lab.length)];
        centroids[j] = rand.slice();
        changed = true;
        continue;
      }
      const nc = [
        sums[j][0] / counts[j],
        sums[j][1] / counts[j],
        sums[j][2] / counts[j],
      ];
      if (nc[0] !== centroids[j][0] || nc[1] !== centroids[j][1] || nc[2] !== centroids[j][2]) {
        changed = true;
        centroids[j] = nc;
      }
    }
    if (!changed) break;
  }

  // Convert centroids back to RGB for downstream colour reporting
  return centroids.map(labToRgb);
}

// Pre-compute Lab for a palette so per-pixel lookup is one Lab convert + N
// cheap distLabs instead of repeated heavy conversions.
function precomputeLabPalette(palette) {
  return palette.map(rgbToLab);
}

// Find nearest palette index for an RGB pixel using Lab distance.
// `paletteLab` must be the pre-computed Lab list — the caller is expected
// to memoise it to avoid converting the same palette every call.
function findNearestColor(pixelRgb, paletteLab) {
  const lab = rgbToLab(pixelRgb);
  let minD = Infinity, nearest = 0;
  for (let j = 0; j < paletteLab.length; j++) {
    const d = distLab(lab, paletteLab[j]);
    if (d < minD) { minD = d; nearest = j; }
  }
  return nearest;
}

module.exports = {
  quantizeColors,
  findNearestColor,
  precomputeLabPalette,
  rgbToLab,
  labToRgb,
  distLab,
};
