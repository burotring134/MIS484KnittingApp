import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import * as Print from 'expo-print';
import { T } from '../utils/theme';
import { updateProject } from '../utils/storage';

const ZOOM_LEVELS = [10, 14, 20, 28, 40];

export default function ProjectDetailScreen({ project, onBack, onChange }) {
  const [completed, setCompleted] = useState(project.completed || {});
  const [trackingMode, setTrackingMode] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(2);
  const [highlightedColor, setHighlightedColor] = useState(null);
  const [exporting, setExporting] = useState(false);

  const cellSize = ZOOM_LEVELS[zoomIdx];
  const totalCells = project.width * project.height;
  const doneCount = Object.keys(completed).length;
  const pct = totalCells > 0 ? Math.round((doneCount / totalCells) * 100) : 0;

  // Persist completed state when it changes (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      await updateProject(project.id, { completed });
      onChange?.();
    }, 400);
    return () => clearTimeout(t);
  }, [completed]);

  const toggleCell = (r, c) => {
    const key = `${r},${c}`;
    setCompleted((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const cellsSvg = useMemo(() => {
    const items = [];
    for (let r = 0; r < project.height; r++) {
      for (let c = 0; c < project.width; c++) {
        const cid = project.grid[r][c];
        const color = project.colors[cid];
        const x = c * cellSize;
        const y = r * cellSize;
        const isDone = completed[`${r},${c}`];
        const isHighlighted = highlightedColor !== null && cid === highlightedColor;
        const isDimmed = highlightedColor !== null && cid !== highlightedColor;

        let fill = color?.dmcHex || '#fff';
        if (isDone) fill = '#E8E5DD';
        else if (isDimmed) fill = '#ECE6DC';

        items.push(
          <Rect key={`r-${r}-${c}`}
            x={x} y={y} width={cellSize} height={cellSize}
            fill={fill}
            stroke={isHighlighted ? T.mauveDeep : 'none'}
            strokeWidth={isHighlighted ? 1.2 : 0}
            onPress={trackingMode ? () => toggleCell(r, c) : undefined}
          />
        );

        if (cellSize >= 14 && color?.symbol && !isDone && !isDimmed) {
          items.push(
            <SvgText
              key={`s-${r}-${c}`}
              x={x + cellSize / 2}
              y={y + cellSize / 2 + cellSize * 0.28}
              fontSize={Math.floor(cellSize * 0.55)}
              fontWeight="700"
              fill="rgba(61,52,48,0.55)"
              textAnchor="middle"
            >{color.symbol}</SvgText>
          );
        }

        if (isDone && cellSize >= 14) {
          items.push(
            <SvgText
              key={`d-${r}-${c}`}
              x={x + cellSize / 2}
              y={y + cellSize / 2 + cellSize * 0.28}
              fontSize={Math.floor(cellSize * 0.6)}
              fontWeight="900"
              fill={T.successTx}
              textAnchor="middle"
            >✓</SvgText>
          );
        }
      }
    }
    return items;
  }, [project, completed, cellSize, highlightedColor, trackingMode]);

  const gridLines = useMemo(() => {
    if (cellSize < 8) return [];
    const lines = [];
    for (let i = 1; i < project.height; i++) {
      const major = i % 10 === 0;
      lines.push(
        <Line key={`h${i}`} x1={0} y1={i*cellSize} x2={project.width*cellSize} y2={i*cellSize}
          stroke={major ? 'rgba(61,52,48,0.35)' : 'rgba(61,52,48,0.10)'}
          strokeWidth={major ? 0.8 : 0.4}
        />
      );
    }
    for (let i = 1; i < project.width; i++) {
      const major = i % 10 === 0;
      lines.push(
        <Line key={`v${i}`} x1={i*cellSize} y1={0} x2={i*cellSize} y2={project.height*cellSize}
          stroke={major ? 'rgba(61,52,48,0.35)' : 'rgba(61,52,48,0.10)'}
          strokeWidth={major ? 0.8 : 0.4}
        />
      );
    }
    return lines;
  }, [cellSize, project]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const html = buildPdfHtml(project, completed);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Print.printAsync({ uri });
    } catch (err) {
      Alert.alert('PDF Export', `Hata: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{project.name}</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPdf} disabled={exporting} activeOpacity={0.7}>
          {exporting
            ? <ActivityIndicator size="small" color={T.mauveDeep}/>
            : <Text style={styles.exportTxt}>PDF</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaV}>{pct}%</Text>
          <Text style={styles.metaK}>Tamam</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaV}>{doneCount.toLocaleString()}</Text>
          <Text style={styles.metaK}>İşlenen</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaV}>{(totalCells - doneCount).toLocaleString()}</Text>
          <Text style={styles.metaK}>Kalan</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaV}>{project.colors.length}</Text>
          <Text style={styles.metaK}>Renk</Text>
        </View>
      </View>

      <View style={styles.toolRow}>
        <View style={styles.zoom}>
          <TouchableOpacity onPress={() => setZoomIdx(i => Math.max(0, i-1))} disabled={zoomIdx === 0}
            style={[styles.zBtn, zoomIdx === 0 && styles.zBtnOff]}>
            <Text style={styles.zBtnTxt}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zLabel}>{cellSize}px</Text>
          <TouchableOpacity onPress={() => setZoomIdx(i => Math.min(ZOOM_LEVELS.length - 1, i+1))} disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            style={[styles.zBtn, zoomIdx === ZOOM_LEVELS.length - 1 && styles.zBtnOff]}>
            <Text style={styles.zBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.trackBtn, trackingMode && styles.trackBtnOn]}
          onPress={() => setTrackingMode(t => !t)}
          activeOpacity={0.85}
        >
          <Text style={[styles.trackTxt, trackingMode && styles.trackTxtOn]}>
            {trackingMode ? '✓ Takip modu' : 'Takip modu'}
          </Text>
        </TouchableOpacity>
      </View>

      {trackingMode && (
        <View style={styles.trackHint}>
          <Text style={styles.trackHintTxt}>
            Hücreye dokunarak işle. Tekrar dokunarak işareti kaldır.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.canvasV}
        contentContainerStyle={{ padding: 12 }}
        scrollEnabled={!trackingMode}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!trackingMode}
        >
          <Svg
            width={project.width * cellSize}
            height={project.height * cellSize}
            viewBox={`0 0 ${project.width * cellSize} ${project.height * cellSize}`}
          >
            {cellsSvg}
            {gridLines}
          </Svg>
        </ScrollView>
      </ScrollView>

      {/* Color legend strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendStrip}>
        {project.colors.map((c) => {
          const on = highlightedColor === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.legendItem, on && styles.legendItemOn]}
              onPress={() => setHighlightedColor(on ? null : c.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.legendSwatch, { backgroundColor: c.dmcHex }]}/>
              <View>
                <Text style={styles.legendCode}>{c.dmcCode}</Text>
                <Text style={styles.legendCount}>{c.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── PDF generation ─────────────────────────────────────────────────────────
function buildPdfHtml(p, completedMap) {
  const cs = 16; // cell size in PDF
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
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(p.name)} — Kanaviçe Pattern</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Helvetica, sans-serif; color: #2a2522; }
    h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
    .meta { color: #6B5D56; font-size: 11px; margin-bottom: 18px; }
    .pattern { border: 1px solid #ddd; padding: 6px; display: inline-block; }
    table { border-collapse: collapse; margin-top: 18px; font-size: 11px; }
    td { padding: 4px 0; border-bottom: 1px solid #f0ebe1; }
    .footer { margin-top: 28px; font-size: 10px; color: #9A8B84; }
  </style>
</head>
<body>
  <h1>${escapeHtml(p.name)}</h1>
  <div class="meta">
    ${p.width} × ${p.height} cells · ${p.colors.length} renk · ${(p.width*p.height).toLocaleString()} stitch · zorluk: ${escapeHtml(p.difficulty)}
  </div>
  <div class="pattern">
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      ${cells}
      ${lines}
    </svg>
  </div>
  <table>
    <thead>
      <tr>
        <td colspan="5" style="font-weight:700;padding-bottom:8px">DMC İplik Listesi</td>
      </tr>
    </thead>
    <tbody>${legendRows}</tbody>
  </table>
  <div class="footer">
    Threadia · AI cross-stitch studio · ${new Date().toLocaleDateString('tr-TR')}
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backTxt: { fontSize: 16, color: T.mauveDeep, fontWeight: '600' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  exportBtn: {
    minWidth: 60, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: T.rose, borderRadius: 9999, alignItems: 'center',
  },
  exportTxt: { fontSize: 12, fontWeight: '800', color: T.mauveDeep, letterSpacing: 0.4 },

  metaRow: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: T.paper,
    marginHorizontal: 16, borderRadius: 18,
    borderWidth: 1, borderColor: T.line,
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaV: { fontSize: 18, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  metaK: { fontSize: 10, fontWeight: '600', color: T.inkMute, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },

  toolRow: {
    flexDirection: 'row',
    alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 12,
  },
  zoom: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.paper,
    borderRadius: 9999, padding: 4,
    borderWidth: 1, borderColor: T.line,
  },
  zBtn: {
    width: 32, height: 32, borderRadius: 9999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.rose,
  },
  zBtnOff: { opacity: 0.4, backgroundColor: T.creamDeep },
  zBtnTxt: { fontSize: 18, color: T.mauveDeep, fontWeight: '800' },
  zLabel: { paddingHorizontal: 10, fontSize: 12, fontWeight: '700', color: T.ink },

  trackBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 9999,
    backgroundColor: T.paper,
    borderWidth: 1, borderColor: T.line,
  },
  trackBtnOn: { backgroundColor: T.mauve, borderColor: T.mauve },
  trackTxt:   { fontSize: 13, fontWeight: '700', color: T.inkSoft },
  trackTxtOn: { color: '#fff' },

  trackHint: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: T.butter,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
  },
  trackHintTxt: { fontSize: 12, color: T.ink, fontWeight: '600' },

  canvasV: { flex: 1, marginTop: 12, backgroundColor: T.paper, marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: T.line },

  legendStrip: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  legendItem: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: T.paper,
    borderRadius: 12, borderWidth: 1, borderColor: T.line,
  },
  legendItemOn: { borderColor: T.mauve, backgroundColor: T.rose },
  legendSwatch: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: T.line },
  legendCode: { fontSize: 12, fontWeight: '800', color: T.ink },
  legendCount: { fontSize: 10, color: T.inkMute, fontWeight: '600' },
});
