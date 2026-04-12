/**
 * K-means++ colour quantisation
 * @param {number[][]} pixels  – array of [r, g, b]
 * @param {number}     k       – desired palette size
 * @returns {number[][]} centroid colours as [r, g, b]
 */
function quantizeColors(pixels, k) {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => [...p]);

  // -- build a sample for faster init (cap at 3 000 pixels) --
  const sampleSize = Math.min(pixels.length, 3000);
  const step = Math.floor(pixels.length / sampleSize);
  const sample = [];
  for (let i = 0; i < pixels.length && sample.length < sampleSize; i += step) {
    sample.push(pixels[i]);
  }

  // -- K-means++ initialisation --
  const centroids = [sample[Math.floor(Math.random() * sample.length)].slice()];

  while (centroids.length < k) {
    const dists = sample.map((p) => {
      let minD = Infinity;
      for (const c of centroids) {
        const d = distSq(p, c);
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

  // -- iterate on the full pixel set --
  const MAX_ITER = 25;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (const px of pixels) {
      let minD = Infinity, nearest = 0;
      for (let j = 0; j < k; j++) {
        const d = distSq(px, centroids[j]);
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
        // Reinitialise empty cluster
        const rand = pixels[Math.floor(Math.random() * pixels.length)];
        centroids[j] = rand.slice();
        changed = true;
        continue;
      }
      const nc = [
        Math.round(sums[j][0] / counts[j]),
        Math.round(sums[j][1] / counts[j]),
        Math.round(sums[j][2] / counts[j]),
      ];
      if (nc[0] !== centroids[j][0] || nc[1] !== centroids[j][1] || nc[2] !== centroids[j][2]) {
        changed = true;
        centroids[j] = nc;
      }
    }

    if (!changed) break;
  }

  return centroids;
}

/**
 * Return index of the nearest centroid for a pixel.
 */
function findNearestColor(pixel, palette) {
  let minD = Infinity, nearest = 0;
  for (let j = 0; j < palette.length; j++) {
    const d = distSq(pixel, palette[j]);
    if (d < minD) { minD = d; nearest = j; }
  }
  return nearest;
}

function distSq([r1, g1, b1], [r2, g2, b2]) {
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

module.exports = { quantizeColors, findNearestColor };
