const sharp = require('sharp');

// Three render styles, one per difficulty level. The mobile app shows the
// same image everywhere (approval, workshop list, project detail), so the
// chart style scales with how the user wants to work the pattern:
//
//   easy   → bare pixelated colour blocks (beginner-friendly)
//   medium → pixelated colour + grid lines (chart-like for counting)
//   hard   → tinted cells + distinct geometric symbol per colour + grid
//            (full printable cross-stitch chart for advanced stitchers)

// (size, fill) → svg fragment positioned in [0..size] of a unit cell. We
// translate the cell into place at render time via <g transform>.
const SYMBOL_SHAPES = [
  // 0 ■ filled square
  (s, f) => `<rect x="${s*0.22}" y="${s*0.22}" width="${s*0.56}" height="${s*0.56}" fill="${f}"/>`,
  // 1 ● filled circle
  (s, f) => `<circle cx="${s*0.5}" cy="${s*0.5}" r="${s*0.30}" fill="${f}"/>`,
  // 2 ▲ triangle up
  (s, f) => `<polygon points="${s*0.5},${s*0.18} ${s*0.82},${s*0.78} ${s*0.18},${s*0.78}" fill="${f}"/>`,
  // 3 ★ five-point star
  (s, f) => `<polygon points="${s*0.5},${s*0.16} ${s*0.59},${s*0.40} ${s*0.84},${s*0.40} ${s*0.64},${s*0.55} ${s*0.72},${s*0.80} ${s*0.5},${s*0.64} ${s*0.28},${s*0.80} ${s*0.36},${s*0.55} ${s*0.16},${s*0.40} ${s*0.41},${s*0.40}" fill="${f}"/>`,
  // 4 ♦ filled diamond
  (s, f) => `<polygon points="${s*0.5},${s*0.18} ${s*0.82},${s*0.5} ${s*0.5},${s*0.82} ${s*0.18},${s*0.5}" fill="${f}"/>`,
  // 5 ♥ heart
  (s, f) => `<path d="M${s*0.5} ${s*0.78} C${s*0.18} ${s*0.58},${s*0.14} ${s*0.32},${s*0.32} ${s*0.26} C${s*0.42} ${s*0.22},${s*0.5} ${s*0.32},${s*0.5} ${s*0.40} C${s*0.5} ${s*0.32},${s*0.58} ${s*0.22},${s*0.68} ${s*0.26} C${s*0.86} ${s*0.32},${s*0.82} ${s*0.58},${s*0.5} ${s*0.78} Z" fill="${f}"/>`,
  // 6 + plus
  (s, f) => `<path d="M${s*0.42} ${s*0.18} L${s*0.58} ${s*0.18} L${s*0.58} ${s*0.42} L${s*0.82} ${s*0.42} L${s*0.82} ${s*0.58} L${s*0.58} ${s*0.58} L${s*0.58} ${s*0.82} L${s*0.42} ${s*0.82} L${s*0.42} ${s*0.58} L${s*0.18} ${s*0.58} L${s*0.18} ${s*0.42} L${s*0.42} ${s*0.42} Z" fill="${f}"/>`,
  // 7 ▼ triangle down
  (s, f) => `<polygon points="${s*0.18},${s*0.22} ${s*0.82},${s*0.22} ${s*0.5},${s*0.82}" fill="${f}"/>`,
  // 8 hexagon
  (s, f) => `<polygon points="${s*0.5},${s*0.18} ${s*0.78},${s*0.34} ${s*0.78},${s*0.66} ${s*0.5},${s*0.82} ${s*0.22},${s*0.66} ${s*0.22},${s*0.34}" fill="${f}"/>`,
  // 9 ○ ring (open circle)
  (s, f) => `<circle cx="${s*0.5}" cy="${s*0.5}" r="${s*0.28}" fill="none" stroke="${f}" stroke-width="${s*0.10}"/>`,
  // 10 □ open square
  (s, f) => `<rect x="${s*0.24}" y="${s*0.24}" width="${s*0.52}" height="${s*0.52}" fill="none" stroke="${f}" stroke-width="${s*0.10}"/>`,
  // 11 △ open triangle
  (s, f) => `<polygon points="${s*0.5},${s*0.20} ${s*0.80},${s*0.78} ${s*0.20},${s*0.78}" fill="none" stroke="${f}" stroke-width="${s*0.10}" stroke-linejoin="round"/>`,
  // 12 ☆ open star
  (s, f) => `<polygon points="${s*0.5},${s*0.16} ${s*0.59},${s*0.40} ${s*0.84},${s*0.40} ${s*0.64},${s*0.55} ${s*0.72},${s*0.80} ${s*0.5},${s*0.64} ${s*0.28},${s*0.80} ${s*0.36},${s*0.55} ${s*0.16},${s*0.40} ${s*0.41},${s*0.40}" fill="none" stroke="${f}" stroke-width="${s*0.08}" stroke-linejoin="round"/>`,
  // 13 ◇ open diamond
  (s, f) => `<polygon points="${s*0.5},${s*0.18} ${s*0.82},${s*0.5} ${s*0.5},${s*0.82} ${s*0.18},${s*0.5}" fill="none" stroke="${f}" stroke-width="${s*0.10}" stroke-linejoin="round"/>`,
  // 14 ♡ open heart
  (s, f) => `<path d="M${s*0.5} ${s*0.78} C${s*0.18} ${s*0.58},${s*0.14} ${s*0.32},${s*0.32} ${s*0.26} C${s*0.42} ${s*0.22},${s*0.5} ${s*0.32},${s*0.5} ${s*0.40} C${s*0.5} ${s*0.32},${s*0.58} ${s*0.22},${s*0.68} ${s*0.26} C${s*0.86} ${s*0.32},${s*0.82} ${s*0.58},${s*0.5} ${s*0.78} Z" fill="none" stroke="${f}" stroke-width="${s*0.08}" stroke-linejoin="round"/>`,
  // 15 × cross
  (s, f) => `<path d="M${s*0.22} ${s*0.22} L${s*0.78} ${s*0.78} M${s*0.78} ${s*0.22} L${s*0.22} ${s*0.78}" stroke="${f}" stroke-width="${s*0.13}" stroke-linecap="round"/>`,
  // 16 horizontal bar
  (s, f) => `<rect x="${s*0.18}" y="${s*0.46}" width="${s*0.64}" height="${s*0.08}" fill="${f}"/>`,
  // 17 vertical bar
  (s, f) => `<rect x="${s*0.46}" y="${s*0.18}" width="${s*0.08}" height="${s*0.64}" fill="${f}"/>`,
  // 18 dot
  (s, f) => `<circle cx="${s*0.5}" cy="${s*0.5}" r="${s*0.13}" fill="${f}"/>`,
  // 19 chevron
  (s, f) => `<path d="M${s*0.22} ${s*0.34} L${s*0.5} ${s*0.62} L${s*0.78} ${s*0.34}" fill="none" stroke="${f}" stroke-width="${s*0.13}" stroke-linecap="round" stroke-linejoin="round"/>`,
];

function lightenHex(hex, amount) {
  // amount=0 → original, amount=1 → white. Linear blend in sRGB.
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function pickContrast(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#2a2522' : '#ffffff';
}

// Pixelated colour buffer — one solid block of the cell's DMC colour per
// cell, scaled up via nearest-neighbour for crisp edges.
async function buildColorBuffer(grid, colors, base) {
  const H = grid.length;
  const W = H > 0 ? grid[0].length : 0;
  if (!W || !H) return null;
  const raw = Buffer.alloc(W * H * 3);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cid = grid[r][c];
      const hex = colors[cid]?.dmcHex || '#ffffff';
      const off = (r * W + c) * 3;
      raw[off]     = parseInt(hex.slice(1, 3), 16);
      raw[off + 1] = parseInt(hex.slice(3, 5), 16);
      raw[off + 2] = parseInt(hex.slice(5, 7), 16);
    }
  }
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } })
    .resize(W * base, H * base, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
}

// Single grid-line SVG composited over a pixelated base for medium / hard.
function buildGridSvg(W, H, base) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * base}" height="${H * base}">`;
  for (let i = 1; i < W; i++) {
    const major = i % 10 === 0;
    const w = major ? base * 0.06 : base * 0.025;
    const stroke = major ? 'rgba(40,30,25,0.55)' : 'rgba(40,30,25,0.18)';
    svg += `<line x1="${i * base}" y1="0" x2="${i * base}" y2="${H * base}" stroke="${stroke}" stroke-width="${w}"/>`;
  }
  for (let i = 1; i < H; i++) {
    const major = i % 10 === 0;
    const w = major ? base * 0.06 : base * 0.025;
    const stroke = major ? 'rgba(40,30,25,0.55)' : 'rgba(40,30,25,0.18)';
    svg += `<line x1="0" y1="${i * base}" x2="${W * base}" y2="${i * base}" stroke="${stroke}" stroke-width="${w}"/>`;
  }
  svg += `</svg>`;
  return svg;
}

// ── Easy: bare pixelated colour blocks ───────────────────────────────────
async function renderEasyPng(grid, colors, { base = 24 } = {}) {
  const buf = await buildColorBuffer(grid, colors, base);
  if (!buf) return null;
  const png = await sharp(buf).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// ── Medium: pixelated colour + grid lines ────────────────────────────────
async function renderMediumPng(grid, colors, { base = 36 } = {}) {
  const H = grid.length;
  const W = H > 0 ? grid[0].length : 0;
  if (!W || !H) return null;
  const colorBuf = await buildColorBuffer(grid, colors, base);
  const gridSvg  = buildGridSvg(W, H, base);
  const png = await sharp(colorBuf)
    .composite([{ input: Buffer.from(gridSvg) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// ── Hard: full-colour cells + geometric symbols + grid lines ────────────
// Full DMC colour at every cell (no tint) so the chart looks like a
// vibrant pixel-art photo, not a washed-out colouring book. Symbols are
// drawn in the contrast-picked colour against each cell's actual fill,
// so they stay readable on both light and dark thread colours.
async function renderHardPng(grid, colors, { base = 48 } = {}) {
  const H = grid.length;
  const W = H > 0 ? grid[0].length : 0;
  if (!W || !H) return null;

  const w = W * base;
  const h = H * base;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

  // Full-colour cell backgrounds — one batched <path> per colour.
  const fillByColor = new Map();
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cid = grid[r][c];
      let parts = fillByColor.get(cid);
      if (!parts) { parts = []; fillByColor.set(cid, parts); }
      parts.push(`M${c * base} ${r * base}h${base}v${base}h-${base}Z`);
    }
  }
  for (const [cid, parts] of fillByColor) {
    const hex = colors[cid]?.dmcHex || '#fff';
    svg += `<path d="${parts.join(' ')}" fill="${hex}"/>`;
  }

  // One geometric symbol per cell, contrast-coloured against the full
  // cell fill (dark cells get light symbols, light cells get dark).
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const cid = grid[r][c];
      const color = colors[cid];
      if (!color) continue;
      const shapeFn = SYMBOL_SHAPES[cid % SYMBOL_SHAPES.length];
      if (!shapeFn) continue;
      const fill = pickContrast(color.dmcHex || '#fff');
      svg += `<g transform="translate(${c * base} ${r * base})">${shapeFn(base, fill)}</g>`;
    }
  }

  // Grid lines (cross-stitch chart convention)
  for (let i = 1; i < W; i++) {
    const major = i % 10 === 0;
    svg += `<line x1="${i * base}" y1="0" x2="${i * base}" y2="${h}" stroke="${major ? 'rgba(60,40,30,0.55)' : 'rgba(60,40,30,0.18)'}" stroke-width="${major ? base * 0.06 : base * 0.025}"/>`;
  }
  for (let i = 1; i < H; i++) {
    const major = i % 10 === 0;
    svg += `<line x1="0" y1="${i * base}" x2="${w}" y2="${i * base}" stroke="${major ? 'rgba(60,40,30,0.55)' : 'rgba(60,40,30,0.18)'}" stroke-width="${major ? base * 0.06 : base * 0.025}"/>`;
  }

  svg += `</svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function renderForDifficulty(grid, colors, difficulty) {
  switch (difficulty) {
    case 'easy':   return renderEasyPng(grid, colors);
    case 'medium': return renderMediumPng(grid, colors);
    case 'hard':   return renderHardPng(grid, colors);
    default:       return renderMediumPng(grid, colors);
  }
}

module.exports = {
  renderForDifficulty,
  renderEasyPng,
  renderMediumPng,
  renderHardPng,
};
