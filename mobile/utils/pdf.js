// PDF builder shared between ProjectDetailScreen (full export flow with
// 3-stage progress modal + cancel + retry) and WorkshopScreen
// (one-tap "PDF olarak indir" CTA inside the completion celebration).
// The HTML is rendered to a file via expo-print and then handed to the
// system print sheet — both callers wrap their own UX around the same
// data, this util owns the data only.

export function buildPdfHtml(p, completedMap) {
  const cs = 16;
  const w = p.width * cs;
  const h = p.height * cs;
  let cells = '';
  for (let r = 0; r < p.height; r++) {
    for (let c = 0; c < p.width; c++) {
      const cid = p.grid[r][c];
      const color = p.colors[cid];
      const x = c * cs;
      const y = r * cs;
      const done = completedMap[`${r},${c}`];
      cells += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${color.dmcHex}" ${done ? 'opacity="0.5"' : ''}/>`;
      if (color.symbol) {
        cells += `<text x="${x + cs/2}" y="${y + cs/2 + cs*0.32}" font-size="${cs*0.6}" font-family="Helvetica" font-weight="700" fill="rgba(0,0,0,0.55)" text-anchor="middle">${escapeHtml(color.symbol)}</text>`;
      }
    }
  }
  let lines = '';
  for (let i = 1; i < p.height; i++) {
    const major = i % 10 === 0;
    lines += `<line x1="0" y1="${i*cs}" x2="${w}" y2="${i*cs}" stroke="${major ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}" stroke-width="${major ? 0.8 : 0.4}"/>`;
  }
  for (let i = 1; i < p.width; i++) {
    const major = i % 10 === 0;
    lines += `<line x1="${i*cs}" y1="0" x2="${i*cs}" y2="${h}" stroke="${major ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}" stroke-width="${major ? 0.8 : 0.4}"/>`;
  }
  const legendRows = p.colors.map((c) => `
    <tr>
      <td><div style="width:14px;height:14px;background:${c.dmcHex};border:1px solid #ddd;display:inline-block;vertical-align:middle"></div></td>
      <td style="font-family:monospace;font-weight:700;padding-left:6px">${escapeHtml(c.symbol || '')}</td>
      <td style="font-family:Helvetica,sans-serif;font-weight:700;padding-left:8px">DMC ${escapeHtml(c.dmcCode)}</td>
      <td style="font-family:Helvetica,sans-serif;color:#555;padding-left:8px">${escapeHtml(c.dmcName)}</td>
      <td style="font-family:Helvetica,sans-serif;text-align:right;font-variant-numeric:tabular-nums;padding-left:14px">${c.count.toLocaleString()}</td>
    </tr>
  `).join('');
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(p.name)} — Kanaviçe Pattern</title>
<style>@page { size: A4; margin: 18mm; } body { font-family: Helvetica, sans-serif; color: #2a2522; }
h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
.meta { color: #6B5D56; font-size: 11px; margin-bottom: 18px; }
.pattern { border: 1px solid #ddd; padding: 6px; display: inline-block; }
table { border-collapse: collapse; margin-top: 18px; font-size: 11px; }
td { padding: 4px 0; border-bottom: 1px solid #f0ebe1; }
.footer { margin-top: 28px; font-size: 10px; color: #9A8B84; }</style></head>
<body><h1>${escapeHtml(p.name)}</h1>
<div class="meta">${p.width} × ${p.height} cells · ${p.colors.length} renk · ${(p.width*p.height).toLocaleString()} stitch · zorluk: ${escapeHtml(p.difficulty)}</div>
<div class="pattern"><svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${cells}${lines}</svg></div>
<table><thead><tr><td colspan="5" style="font-weight:700;padding-bottom:8px">DMC İplik Listesi</td></tr></thead><tbody>${legendRows}</tbody></table>
<div class="footer">Threadia · AI cross-stitch studio · ${new Date().toLocaleDateString('tr-TR')}</div>
</body></html>`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}
