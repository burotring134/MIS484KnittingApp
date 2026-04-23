import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

const C = {
  primary:       '#006c52',
  primaryContainer: '#8ff6cf',
  surface:       '#fbf9f5',
  surfaceLowest: '#ffffff',
  surfaceLow:    '#f5f4ef',
  surfaceMid:    '#efeee9',
  surfaceHigh:   '#e9e8e3',
  onSurface:     '#31332f',
  onSurfaceVar:  '#5e605b',
  outlineVar:    '#b2b2ad',
};

function hexLuminance(hex) {
  if (!hex || hex.length < 7) return 200;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const CELL_SIZES = [4, 6, 8, 10, 14];
const ZOOM_LABELS = ['–', '–', '100%', '+', '+'];

export default function PatternGrid({ grid, colors, width, height, highlighted }) {
  const [zoomIdx,     setZoomIdx]     = useState(3);
  const [showGrid,    setShowGrid]    = useState(true);
  const [showSymbols, setShowSymbols] = useState(true);

  const cellSize = CELL_SIZES[zoomIdx];
  const svgW     = width  * cellSize;
  const svgH     = height * cellSize;

  const rects = useMemo(() => {
    const result = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const cid    = grid[r][c];
        const color  = colors[cid];
        const dimmed = highlighted !== null && highlighted !== undefined && cid !== highlighted;
        const hex    = color?.dmcHex || '#ffffff';
        const lum    = hexLuminance(hex);
        result.push({
          key:       `${r}-${c}`,
          x:         c * cellSize,
          y:         r * cellSize,
          fill:      dimmed ? C.surfaceHigh : hex,
          symbol:    dimmed ? null : (color?.symbol ?? null),
          textColor: lum > 145 ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)',
        });
      }
    }
    return result;
  }, [grid, colors, cellSize, highlighted, width, height]);

  const gridLines = useMemo(() => {
    if (!showGrid || cellSize < 5) return null;
    const lines = [];
    for (let r = 0; r <= height; r++) {
      lines.push(
        <Line key={`h${r}`} x1={0} y1={r * cellSize} x2={svgW} y2={r * cellSize}
          stroke="rgba(49,51,47,0.08)" strokeWidth={0.5} />
      );
    }
    for (let c = 0; c <= width; c++) {
      lines.push(
        <Line key={`v${c}`} x1={c * cellSize} y1={0} x2={c * cellSize} y2={svgH}
          stroke="rgba(49,51,47,0.08)" strokeWidth={0.5} />
      );
    }
    return lines;
  }, [showGrid, cellSize, width, height, svgW, svgH]);

  return (
    <View style={styles.card}>
      {/* ── Title + controls ── */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title}>Pattern Canvas</Text>
          <Text style={styles.subtitle}>{width}×{height} · {(width * height).toLocaleString()} stitches</Text>
        </View>

        {/* Zoom pill */}
        <View style={styles.zoomPill}>
          <TouchableOpacity
            style={[styles.zBtn, zoomIdx === 0 && styles.zBtnOff]}
            onPress={() => setZoomIdx((i) => Math.max(0, i - 1))}
            disabled={zoomIdx === 0}
          >
            <Text style={styles.zBtnTxt}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zLabel}>{cellSize}px</Text>
          <TouchableOpacity
            style={[styles.zBtn, zoomIdx === CELL_SIZES.length - 1 && styles.zBtnOff]}
            onPress={() => setZoomIdx((i) => Math.min(CELL_SIZES.length - 1, i + 1))}
            disabled={zoomIdx === CELL_SIZES.length - 1}
          >
            <Text style={styles.zBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Toggle row ── */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggle, showSymbols && styles.toggleOn]}
          onPress={() => setShowSymbols((s) => !s)}
          activeOpacity={0.75}
        >
          <Text style={[styles.toggleTxt, showSymbols && styles.toggleTxtOn]}>
            Symbols
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, showGrid && styles.toggleOn]}
          onPress={() => setShowGrid((g) => !g)}
          activeOpacity={0.75}
        >
          <Text style={[styles.toggleTxt, showGrid && styles.toggleTxtOn]}>
            Grid
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Canvas ── */}
      <View style={styles.canvasWrap}>
        <ScrollView
          style={styles.canvas}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Svg width={svgW} height={svgH}>
              {rects.map((r) => (
                <Rect key={r.key} x={r.x} y={r.y}
                  width={cellSize} height={cellSize} fill={r.fill} />
              ))}
              {showSymbols && cellSize >= 8 && rects.map((r) =>
                r.symbol ? (
                  <SvgText
                    key={`s-${r.key}`}
                    x={r.x + cellSize * 0.5}
                    y={r.y + cellSize * 0.5 + cellSize * 0.28}
                    fontSize={Math.max(5, Math.floor(cellSize * 0.60))}
                    fill={r.textColor}
                    textAnchor="middle"
                    fontWeight="700"
                  >
                    {r.symbol}
                  </SvgText>
                ) : null
              )}
              {gridLines}
            </Svg>
          </ScrollView>
        </ScrollView>

        {/* Canvas size badge */}
        <View style={styles.canvasBadge}>
          <Text style={styles.canvasBadgeTxt}>CANVAS: {width} × {height}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius:    32,
    padding:         24,
    gap:             16,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.04,
    shadowRadius:    32,
    shadowOffset:    { width: 0, height: 10 },
    elevation:       3,
  },

  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  title:    { fontSize: 20, fontWeight: '900', color: C.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 11, color: C.onSurfaceVar, marginTop: 2 },

  zoomPill: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.surfaceMid,
    borderRadius:    9999,
    padding:         4,
    gap:             2,
  },
  zBtn: {
    width:           32,
    height:          32,
    borderRadius:    9999,
    backgroundColor: C.surfaceLowest,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     C.onSurface,
    shadowOpacity:   0.06,
    shadowRadius:    4,
    elevation:       1,
  },
  zBtnOff:  { opacity: 0.35 },
  zBtnTxt:  { fontSize: 18, fontWeight: '700', color: C.primary, lineHeight: 22 },
  zLabel:   { fontSize: 11, fontWeight: '700', color: C.primary, minWidth: 40, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical:    8,
    borderRadius:      9999,
    backgroundColor:   C.surfaceMid,
  },
  toggleOn:    { backgroundColor: C.primaryContainer },
  toggleTxt:   { fontSize: 12, fontWeight: '700', color: C.onSurfaceVar },
  toggleTxtOn: { color: C.primary },

  canvasWrap: { position: 'relative' },
  canvas: {
    maxHeight:       420,
    borderRadius:    20,
    backgroundColor: C.surfaceLow,
    overflow:        'hidden',
  },

  canvasBadge: {
    position:        'absolute',
    bottom:          12,
    right:           12,
    backgroundColor: 'rgba(251,249,245,0.92)',
    borderRadius:    9999,
    paddingHorizontal: 10,
    paddingVertical:    4,
  },
  canvasBadgeTxt: {
    fontSize:    9,
    fontWeight:  '700',
    color:       C.primary,
    letterSpacing: 1.2,
  },
});
