import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Alert, ActivityIndicator, PanResponder, Animated, Easing,
} from 'react-native';
import { Image } from 'react-native';
import Svg, { Rect, Line, Circle, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { T } from '../utils/theme';
import { updateProject } from '../utils/storage';

const ZOOM_LEVELS = [10, 14, 20, 28, 40];
const SYMBOL_MIN_CELL = 20;
const GRID_MIN_CELL = 10;
const MIN_CELL = 6;
const MAX_CELL = 60;

// Internal SVG render unit. All geometry — rect coords, fontSize, stroke
// widths — is expressed in BASE_CELL units. The outer <Svg> sets viewBox
// at this scale and width/height at the user's chosen pixel size; native
// then rasterizes the scale at the GPU layer. JS never rebuilds the
// 5,000+ element tree on pinch.
const BASE_CELL = 32;

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectDetailScreen({ project, onBack, onChange }) {
  const insets = useSafeAreaInsets();
  const [completed, setCompleted] = useState(project.completed || {});
  const [trackingMode, setTrackingMode] = useState(false);
  const [cellSize, setCellSize] = useState(20);
  const [highlightedColor, setHighlightedColor] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Continuous cellSize is driven by pinch; the +/- buttons jump to the
  // nearest preset level. zoomIdx is derived for the dot indicator only.
  const zoomIdx = useMemo(() => {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      const d = Math.abs(ZOOM_LEVELS[i] - cellSize);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [cellSize]);

  // Pinch reads cellSize via a ref so a continuous gesture isn't broken by
  // PanResponder being rebuilt every render when cellSize updates.
  const cellSizeRef = useRef(cellSize);
  useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);
  const totalCells = project.width * project.height;
  const doneCount = Object.keys(completed).length;
  const pct = totalCells > 0 ? Math.round((doneCount / totalCells) * 100) : 0;

  useEffect(() => {
    const t = setTimeout(async () => {
      await updateProject(project.id, { completed });
      onChange?.();
    }, 400);
    return () => clearTimeout(t);
  }, [completed]);

  const colorProgress = useMemo(() => {
    const map = {};
    for (const c of project.colors) map[c.id] = { done: 0, total: c.count };
    for (const key of Object.keys(completed)) {
      const [r, c] = key.split(',').map(Number);
      const cid = project.grid[r]?.[c];
      if (cid != null && map[cid]) map[cid].done += 1;
    }
    return map;
  }, [completed, project]);

  const paintCell = useCallback((r, c) => {
    setCompleted((prev) => {
      const key = `${r},${c}`;
      if (prev[key]) return prev;
      return { ...prev, [key]: true };
    });
  }, []);

  const toggleCell = useCallback((r, c) => {
    setCompleted((prev) => {
      const key = `${r},${c}`;
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  const markColorDone = (colorId) => {
    Alert.alert(
      'Tümünü işle',
      `Bu rengin (${project.colors[colorId].dmcCode}) bütün hücrelerini işaretlemek istediğinden emin misin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İşaretle',
          onPress: () => {
            setCompleted((prev) => {
              const next = { ...prev };
              for (let r = 0; r < project.height; r++) {
                for (let c = 0; c < project.width; c++) {
                  if (project.grid[r][c] === colorId) next[`${r},${c}`] = true;
                }
              }
              return next;
            });
          },
        },
      ]
    );
  };

  const unmarkColorDone = (colorId) => {
    Alert.alert(
      'İşaretleri kaldır',
      `Bu rengin (${project.colors[colorId].dmcCode}) işaretlerini geri al?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Geri al',
          style: 'destructive',
          onPress: () => {
            setCompleted((prev) => {
              const next = { ...prev };
              for (let r = 0; r < project.height; r++) {
                for (let c = 0; c < project.width; c++) {
                  if (project.grid[r][c] === colorId) delete next[`${r},${c}`];
                }
              }
              return next;
            });
          },
        },
      ]
    );
  };

  // ── SVG layers — rendered at BASE_CELL units, never rebuilt on pinch ────
  // Splitting into base/symbols and done/doneCheck lets us mount the symbol
  // layers via JSX-level gating against cellSize (cheap re-render switch),
  // while the heavy geometry arrays themselves only depend on project state.

  // One Path per colour (not per cell) — drops the native node count from
  // W*H (5,000+ for a 70x70) to ~colors.length (≤20). This is what makes
  // pinch/pan smooth: the native rasteriser draws 10-20 fills instead of
  // 5,000, and the work per zoom redraw becomes negligible.
  const baseSvg = useMemo(() => {
    const byColor = new Map();
    for (let r = 0; r < project.height; r++) {
      const row = project.grid[r];
      for (let c = 0; c < project.width; c++) {
        const cid = row[c];
        let parts = byColor.get(cid);
        if (!parts) { parts = []; byColor.set(cid, parts); }
        parts.push(`M${c * BASE_CELL} ${r * BASE_CELL}h${BASE_CELL}v${BASE_CELL}h-${BASE_CELL}z`);
      }
    }
    const items = [];
    for (const [cid, parts] of byColor) {
      const color = project.colors[cid];
      items.push(
        <Path key={`bp-${cid}`} d={parts.join('')} fill={color?.dmcHex || '#fff'}/>
      );
    }
    return items;
  }, [project]);

  const symbolsSvg = useMemo(() => {
    const items = [];
    const fs = Math.floor(BASE_CELL * 0.55);
    for (let r = 0; r < project.height; r++) {
      for (let c = 0; c < project.width; c++) {
        const color = project.colors[project.grid[r][c]];
        if (!color?.symbol) continue;
        items.push(
          <SvgText key={`s-${r}-${c}`}
            x={c * BASE_CELL + BASE_CELL / 2}
            y={r * BASE_CELL + BASE_CELL / 2 + BASE_CELL * 0.28}
            fontSize={fs} fontWeight="700"
            fill="rgba(61,52,48,0.55)" textAnchor="middle"
          >{color.symbol}</SvgText>
        );
      }
    }
    return items;
  }, [project]);

  // Same trick: all done-overlay rects collapse into a single grey Path.
  const doneSvg = useMemo(() => {
    const keys = Object.keys(completed);
    if (keys.length === 0) return null;
    const parts = [];
    for (const key of keys) {
      const [r, c] = key.split(',').map(Number);
      parts.push(`M${c * BASE_CELL} ${r * BASE_CELL}h${BASE_CELL}v${BASE_CELL}h-${BASE_CELL}z`);
    }
    return <Path key="done-fill" d={parts.join('')} fill="#E8E5DD"/>;
  }, [completed]);

  const doneSymbolsSvg = useMemo(() => {
    const items = [];
    const fs = Math.floor(BASE_CELL * 0.6);
    for (const key of Object.keys(completed)) {
      const [r, c] = key.split(',').map(Number);
      items.push(
        <SvgText key={`dc-${r}-${c}`}
          x={c * BASE_CELL + BASE_CELL / 2}
          y={r * BASE_CELL + BASE_CELL / 2 + BASE_CELL * 0.28}
          fontSize={fs} fontWeight="900"
          fill={T.successTx} textAnchor="middle"
        >✓</SvgText>
      );
    }
    return items;
  }, [completed]);

  const highlightSvg = useMemo(() => {
    if (highlightedColor === null) return null;
    const items = [];
    const W = project.width * BASE_CELL;
    const H = project.height * BASE_CELL;
    items.push(<Rect key="dim" x={0} y={0} width={W} height={H} fill="rgba(248,242,232,0.78)"/>);
    const color = project.colors[highlightedColor];
    const fs = Math.floor(BASE_CELL * 0.6);
    for (let r = 0; r < project.height; r++) {
      for (let c = 0; c < project.width; c++) {
        if (project.grid[r][c] !== highlightedColor) continue;
        const done = completed[`${r},${c}`];
        const x = c * BASE_CELL;
        const y = r * BASE_CELL;
        items.push(
          <Rect key={`h-${r}-${c}`} x={x} y={y} width={BASE_CELL} height={BASE_CELL}
            fill={done ? '#E8E5DD' : (color?.dmcHex || '#fff')}
            stroke={T.mauveDeep} strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"/>
        );
        if (done) {
          items.push(
            <SvgText key={`hc-${r}-${c}`}
              x={x + BASE_CELL / 2} y={y + BASE_CELL / 2 + BASE_CELL * 0.28}
              fontSize={fs} fontWeight="900"
              fill={T.successTx} textAnchor="middle"
            >✓</SvgText>
          );
        }
      }
    }
    return items;
  }, [highlightedColor, project, completed]);

  const gridSvg = useMemo(() => {
    if (!showGrid) return [];
    const lines = [];
    const W = project.width * BASE_CELL;
    const H = project.height * BASE_CELL;
    for (let i = 1; i < project.height; i++) {
      const major = i % 10 === 0;
      lines.push(
        <Line key={`h${i}`} x1={0} y1={i * BASE_CELL} x2={W} y2={i * BASE_CELL}
          stroke={major ? 'rgba(61,52,48,0.35)' : 'rgba(61,52,48,0.10)'}
          strokeWidth={major ? 0.8 : 0.4}
          vectorEffect="non-scaling-stroke"/>
      );
    }
    for (let i = 1; i < project.width; i++) {
      const major = i % 10 === 0;
      lines.push(
        <Line key={`v${i}`} x1={i * BASE_CELL} y1={0} x2={i * BASE_CELL} y2={H}
          stroke={major ? 'rgba(61,52,48,0.35)' : 'rgba(61,52,48,0.10)'}
          strokeWidth={major ? 0.8 : 0.4}
          vectorEffect="non-scaling-stroke"/>
      );
    }
    return lines;
  }, [showGrid, project.width, project.height]);

  // ── Touch: tap = toggle, drag = paint, two-finger pinch = zoom ──────────
  const dragStarted = useRef(false);
  const lastCell = useRef({ r: -1, c: -1 });
  const pinchBase = useRef(null); // { dist, cellSize } — set on 2-finger grant

  const touchDistance = (touches) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleAt = (locationX, locationY, mode) => {
    const cs = cellSizeRef.current;
    const c = Math.floor(locationX / cs);
    const r = Math.floor(locationY / cs);
    if (r < 0 || r >= project.height || c < 0 || c >= project.width) return;
    if (lastCell.current.r === r && lastCell.current.c === c) return;
    lastCell.current = { r, c };
    if (mode === 'paint') paintCell(r, c);
    else toggleCell(r, c);
  };

  // Build PanResponder once per (trackingMode, dims). cellSize is read via
  // ref so pinching doesn't re-create handlers mid-gesture.
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (evt) =>
      evt.nativeEvent.touches.length >= 2 || trackingMode,
    onStartShouldSetPanResponderCapture: (evt) =>
      evt.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (evt, g) => {
      if (evt.nativeEvent.touches.length >= 2) return true;
      return trackingMode && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
    },
    onMoveShouldSetPanResponderCapture: (evt) =>
      evt.nativeEvent.touches.length >= 2,
    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length >= 2) {
        pinchBase.current = { dist: touchDistance(touches), cellSize: cellSizeRef.current };
      } else {
        dragStarted.current = false;
        lastCell.current = { r: -1, c: -1 };
      }
    },
    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;
      // Second finger landed mid-drag → switch into pinch mode.
      if (touches.length >= 2) {
        if (!pinchBase.current || pinchBase.current.dist === 0) {
          pinchBase.current = { dist: touchDistance(touches), cellSize: cellSizeRef.current };
          return;
        }
        const newDist = touchDistance(touches);
        if (newDist === 0) return;
        const scale = newDist / pinchBase.current.dist;
        const next = Math.max(MIN_CELL, Math.min(MAX_CELL, pinchBase.current.cellSize * scale));
        setCellSize(next);
        return;
      }
      // Single finger — only paint when tracking is on.
      if (pinchBase.current) return; // still finishing a pinch
      if (trackingMode) {
        dragStarted.current = true;
        handleAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY, 'paint');
      }
    },
    onPanResponderRelease: (evt) => {
      // Pinch ends when fingers lift; don't treat the lift as a tap.
      if (pinchBase.current) {
        pinchBase.current = null;
        dragStarted.current = false;
        lastCell.current = { r: -1, c: -1 };
        return;
      }
      if (!dragStarted.current && trackingMode) {
        handleAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY, 'toggle');
      }
      dragStarted.current = false;
      lastCell.current = { r: -1, c: -1 };
    },
    onPanResponderTerminate: () => {
      pinchBase.current = null;
      dragStarted.current = false;
      lastCell.current = { r: -1, c: -1 };
    },
  }), [trackingMode, project.height, project.width, paintCell, toggleCell]);

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

  const selectedColor = highlightedColor !== null ? project.colors[highlightedColor] : null;
  const selectedProgress = highlightedColor !== null ? colorProgress[highlightedColor] : null;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      {/* ─── Top bar — minimal: back, title, PDF ──────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeftIcon/>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.topTitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleExportPdf} disabled={exporting} activeOpacity={0.7}>
          {exporting ? <ActivityIndicator size="small" color={T.mauveDeep}/> : <DownloadIcon/>}
        </TouchableOpacity>
      </View>

      {/* ─── Inline progress strip — single line, no card chrome ────── */}
      <View style={styles.ribbon}>
        <View style={styles.ribbonBarTrack}>
          <View style={[styles.ribbonBarFill, { width: `${pct}%` }]}/>
        </View>
        <Text style={styles.ribbonStats}>
          <Text style={styles.ribbonStrong}>{pct}%</Text>
          <Text style={styles.ribbonDim}>  ·  {doneCount.toLocaleString('tr-TR')}/{totalCells.toLocaleString('tr-TR')} stitch  ·  {project.width}×{project.height}</Text>
        </Text>
      </View>

      {/* ─── Canvas — takes most of the screen ──────────────────────── */}
      <View style={styles.canvasWrap}>
        <ScrollView style={styles.canvasV} contentContainerStyle={{ padding: 14 }}
          scrollEnabled={!trackingMode}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!trackingMode}>
            <View {...panResponder.panHandlers} style={{ width: project.width * cellSize, height: project.height * cellSize }}>
              {/* Base layer: pre-rendered chart PNG when available
                  (single textured Image quad — pinch/pan are GPU-only
                  with zero React rebuild). Fallback path-batched SVG
                  for legacy projects that lack the PNG. */}
              {project.imageDataUri ? (
                <Image
                  source={{ uri: project.imageDataUri }}
                  style={{ position: 'absolute', left: 0, top: 0, width: project.width * cellSize, height: project.height * cellSize }}
                  resizeMode="stretch"
                  fadeDuration={0}
                />
              ) : (
                <Svg
                  style={{ position: 'absolute', left: 0, top: 0 }}
                  width={project.width * cellSize}
                  height={project.height * cellSize}
                  viewBox={`0 0 ${project.width * BASE_CELL} ${project.height * BASE_CELL}`}
                >
                  {baseSvg}
                  {cellSize >= SYMBOL_MIN_CELL && symbolsSvg}
                  {cellSize >= GRID_MIN_CELL && gridSvg}
                </Svg>
              )}

              {/* Dynamic overlays — done state, highlight. SVG path-
                  batched so even fully-completed hard projects stay
                  cheap. Grid is baked into the PNG so we don't redraw
                  it here. */}
              <Svg
                style={{ position: 'absolute', left: 0, top: 0 }}
                width={project.width * cellSize}
                height={project.height * cellSize}
                viewBox={`0 0 ${project.width * BASE_CELL} ${project.height * BASE_CELL}`}
              >
                {doneSvg}
                {cellSize >= SYMBOL_MIN_CELL && doneSymbolsSvg}
                {highlightSvg}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>

        {/* Floating drag-mode chip — subtle, only in tracking */}
        {trackingMode && (
          <View style={styles.modeChip}>
            <View style={styles.modeChipDot}/>
            <Text style={styles.modeChipTxt}>Takip — sürükleyerek işle</Text>
          </View>
        )}
      </View>

      {/* ─── Toolbar — round icon buttons in a single row ────────────── */}
      <View style={styles.toolBar}>
        <View style={styles.zoomGroup}>
          <RoundIconBtn
            onPress={() => {
              const prev = [...ZOOM_LEVELS].reverse().find((l) => l < cellSize - 0.01);
              setCellSize(prev ?? ZOOM_LEVELS[0]);
            }}
            disabled={cellSize <= MIN_CELL + 0.01}
          >
            <MinusIcon/>
          </RoundIconBtn>
          <View style={styles.zoomDots}>
            {ZOOM_LEVELS.map((_, i) => (
              <View key={i} style={[styles.zoomDot, i === zoomIdx && styles.zoomDotOn]}/>
            ))}
          </View>
          <RoundIconBtn
            onPress={() => {
              const next = ZOOM_LEVELS.find((l) => l > cellSize + 0.01);
              setCellSize(next ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
            }}
            disabled={cellSize >= MAX_CELL - 0.01}
          >
            <PlusIcon/>
          </RoundIconBtn>
        </View>

        <View style={{ flex: 1 }}/>

        <RoundIconBtn onPress={() => setShowGrid((s) => !s)} active={showGrid}>
          <GridIcon active={showGrid}/>
        </RoundIconBtn>
        <TrackingPill active={trackingMode} onPress={() => setTrackingMode((t) => !t)}/>
      </View>

      {/* ─── Spotlight — appears when a colour is picked ─────────────── */}
      {selectedColor && selectedProgress && (
        <ColorSpotlight
          color={selectedColor}
          progress={selectedProgress}
          onMarkDone={() => markColorDone(selectedColor.id)}
          onUnmark={() => unmarkColorDone(selectedColor.id)}
          onClear={() => setHighlightedColor(null)}
        />
      )}

      {/* ─── Color circles strip — paint-by-numbers style ───────────── */}
      <View style={[styles.colorsBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorsStrip}
        >
          {project.colors.map((c) => {
            const prog = colorProgress[c.id] || { done: 0, total: c.count };
            const on = highlightedColor === c.id;
            return (
              <ColorChip
                key={c.id}
                color={c}
                progress={prog}
                selected={on}
                onPress={() => setHighlightedColor(on ? null : c.id)}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — icons, buttons, chips
// ─────────────────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function DownloadIcon() {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke={T.mauveDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function MinusIcon() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round"/>
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round"/>
    </Svg>
  );
}

function GridIcon({ active }) {
  const c = active ? T.mauveDeep : T.inkSoft;
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path d="M3 9h18M3 15h18M9 3v18M15 3v18M3 3h18v18H3z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function PencilIcon({ color = '#fff' }) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function RoundIconBtn({ children, onPress, disabled, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}
      style={[
        styles.roundBtn,
        disabled && styles.roundBtnOff,
        active   && styles.roundBtnActive,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

function TrackingPill({ active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}
      style={[styles.trackPill, active && styles.trackPillOn]}
    >
      <PencilIcon color={active ? '#fff' : T.mauveDeep}/>
      <Text style={[styles.trackPillTxt, active && styles.trackPillTxtOn]}>Takip</Text>
    </TouchableOpacity>
  );
}

// ─── Color chip — circular swatch with progress ring (PBN style) ─────────────
const CHIP_SIZE   = 56;
const CHIP_STROKE = 4;
const CHIP_RADIUS = (CHIP_SIZE - CHIP_STROKE) / 2;
const CHIP_CIRC   = 2 * Math.PI * CHIP_RADIUS;
const CHIP_INNER  = CHIP_RADIUS - CHIP_STROKE * 0.4;

function ColorChip({ color, progress, selected, onPress }) {
  const ratio = progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;
  const allDone = ratio >= 1 && progress.total > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.chipWrap}>
      <View style={[styles.chipRing, selected && styles.chipRingOn]}>
        <Svg width={CHIP_SIZE} height={CHIP_SIZE}>
          {/* Track */}
          <Circle cx={CHIP_SIZE / 2} cy={CHIP_SIZE / 2} r={CHIP_RADIUS}
            stroke={T.lineSoft} strokeWidth={CHIP_STROKE} fill="none"/>
          {/* Progress arc */}
          {ratio > 0 && (
            <Circle
              cx={CHIP_SIZE / 2} cy={CHIP_SIZE / 2} r={CHIP_RADIUS}
              stroke={allDone ? T.successTx : T.mauve}
              strokeWidth={CHIP_STROKE} fill="none"
              strokeDasharray={`${CHIP_CIRC} ${CHIP_CIRC}`}
              strokeDashoffset={CHIP_CIRC * (1 - ratio)}
              strokeLinecap="round"
              transform={`rotate(-90 ${CHIP_SIZE / 2} ${CHIP_SIZE / 2})`}
            />
          )}
          {/* Color fill */}
          <Circle cx={CHIP_SIZE / 2} cy={CHIP_SIZE / 2} r={CHIP_INNER}
            fill={color.dmcHex} stroke={T.line} strokeWidth={0.5}/>
        </Svg>

        {/* Symbol overlay (centered) — uses its own absolute View so Svg
            composition is simpler and the symbol scales with system font */}
        <View style={styles.chipSymbolWrap} pointerEvents="none">
          {allDone ? (
            <View style={styles.chipDoneCheck}>
              <Text style={styles.chipDoneCheckTxt}>✓</Text>
            </View>
          ) : color.symbol ? (
            <Text style={[styles.chipSymbol, { color: pickContrast(color.dmcHex) }]}>
              {color.symbol}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.chipCode, selected && styles.chipCodeOn]} numberOfLines={1}>
        {color.dmcCode}
      </Text>
    </TouchableOpacity>
  );
}

// Pick a readable contrast colour — black ink for light swatches, white for dark
function pickContrast(hex) {
  if (!hex || hex.length < 7) return 'rgba(61,52,48,0.7)';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // perceived luminance (sRGB rough approx is fine here)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? 'rgba(61,52,48,0.7)' : 'rgba(255,255,255,0.95)';
}

// ─── Spotlight panel ─────────────────────────────────────────────────────────
function ColorSpotlight({ color, progress, onMarkDone, onUnmark, onClear }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1, duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  const translate = slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const allDone = progress.done >= progress.total && progress.total > 0;
  const remaining = progress.total - progress.done;

  return (
    <Animated.View style={[styles.spotlight, { opacity: slide, transform: [{ translateY: translate }] }]}>
      <View style={styles.spotInner}>
        <View style={[styles.spotSwatch, { backgroundColor: color.dmcHex, borderColor: T.line }]}>
          {color.symbol && (
            <Text style={[styles.spotSwatchSym, { color: pickContrast(color.dmcHex) }]}>{color.symbol}</Text>
          )}
        </View>

        <View style={styles.spotInfo}>
          <View style={styles.spotInfoTop}>
            <Text style={styles.spotCode}>DMC {color.dmcCode}</Text>
            <Text style={styles.spotPct}>{pct}%</Text>
          </View>
          <Text style={styles.spotName} numberOfLines={1}>{color.dmcName}</Text>
          <View style={styles.spotBarTrack}>
            <View style={[
              styles.spotBarFill,
              { width: `${pct}%` },
              allDone && { backgroundColor: T.successTx },
            ]}/>
          </View>
          <Text style={styles.spotMeta}>
            {progress.done}/{progress.total} stitch · {allDone ? 'tamamlandı' : `${remaining} kalan`}
          </Text>
        </View>

        <TouchableOpacity onPress={onClear} style={styles.spotClose} activeOpacity={0.7}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M6 18L18 6" stroke={T.inkMute} strokeWidth="2.2" strokeLinecap="round"/>
          </Svg>
        </TouchableOpacity>
      </View>

      {allDone ? (
        <TouchableOpacity onPress={onUnmark} activeOpacity={0.85} style={styles.spotActionGhost}>
          <Text style={styles.spotActionGhostTxt}>İşaretleri kaldır</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onMarkDone} activeOpacity={0.85} style={styles.spotActionPrimary}>
          <Text style={styles.spotActionPrimaryTxt}>Tümünü işaretle</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generation (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function buildPdfHtml(p, completedMap) {
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.cream,
    // paddingTop comes from useSafeAreaInsets() at runtime — see render
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8,
    gap: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.paper,
    borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },

  // ── Progress ribbon — single inline line, no card ──
  ribbon: {
    paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10,
    gap: 6,
  },
  ribbonBarTrack: {
    height: 5, backgroundColor: T.lineSoft, borderRadius: 5, overflow: 'hidden',
  },
  ribbonBarFill: { height: '100%', backgroundColor: T.mauve, borderRadius: 5 },
  ribbonStats: { fontSize: 11, fontWeight: '600' },
  ribbonStrong: { color: T.ink, fontWeight: '900', letterSpacing: -0.1 },
  ribbonDim: { color: T.inkMute },

  // ── Canvas ──
  canvasWrap: { flex: 1, marginHorizontal: 14, position: 'relative' },
  canvasV: {
    flex: 1, backgroundColor: T.paper, borderRadius: 18,
    borderWidth: 1, borderColor: T.line,
  },
  modeChip: {
    position: 'absolute', top: 10, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(61,52,48,0.85)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 9999,
  },
  modeChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.mauve },
  modeChipTxt: { fontSize: 11, color: '#fff', fontWeight: '700', letterSpacing: 0.3 },

  // ── Toolbar ──
  toolBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  zoomGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: T.paper,
    borderRadius: 9999, padding: 4,
    borderWidth: 1, borderColor: T.line,
  },
  zoomDots: {
    flexDirection: 'row', paddingHorizontal: 8, gap: 3, alignItems: 'center',
  },
  zoomDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: T.lineSoft },
  zoomDotOn:{ backgroundColor: T.mauve, width: 6, height: 6, borderRadius: 3 },

  roundBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.paper,
    borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnOff: { opacity: 0.35 },
  roundBtnActive: { backgroundColor: T.rose, borderColor: T.mauve },

  trackPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999,
    backgroundColor: T.paper,
    borderWidth: 1, borderColor: T.line,
  },
  trackPillOn: {
    backgroundColor: T.mauve, borderColor: T.mauve,
    shadowColor: T.mauveDeep, shadowOpacity: 0.25,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  trackPillTxt:  { fontSize: 13, fontWeight: '800', color: T.mauveDeep, letterSpacing: 0.2 },
  trackPillTxtOn:{ color: '#fff' },

  // ── Spotlight ──
  spotlight: {
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: T.paper, borderRadius: 18,
    borderWidth: 1, borderColor: T.line,
    shadowColor: T.ink, shadowOpacity: 0.06,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
    overflow: 'hidden',
  },
  spotInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
  },
  spotSwatch: {
    width: 52, height: 52, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  spotSwatchSym: { fontSize: 22, fontWeight: '900' },
  spotInfo: { flex: 1, gap: 4 },
  spotInfoTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  spotCode: { fontSize: 15, fontWeight: '900', color: T.ink, letterSpacing: -0.2 },
  spotPct:  { fontSize: 14, fontWeight: '900', color: T.mauveDeep },
  spotName: { fontSize: 11, color: T.inkSoft, fontWeight: '600' },
  spotBarTrack: {
    height: 4, backgroundColor: T.lineSoft, borderRadius: 4, overflow: 'hidden', marginTop: 2,
  },
  spotBarFill: { height: '100%', backgroundColor: T.mauve, borderRadius: 4 },
  spotMeta: { fontSize: 10, color: T.inkMute, fontWeight: '600', marginTop: 2 },
  spotClose: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: T.creamDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  spotActionPrimary: {
    backgroundColor: T.mauve,
    paddingVertical: 12, alignItems: 'center',
  },
  spotActionPrimaryTxt: { fontSize: 13, color: '#fff', fontWeight: '900', letterSpacing: 0.4 },
  spotActionGhost: {
    backgroundColor: T.creamDeep,
    paddingVertical: 12, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: T.line,
  },
  spotActionGhostTxt: { fontSize: 13, color: T.inkSoft, fontWeight: '700' },

  // ── Color circles strip ──
  colorsBar: {
    backgroundColor: T.paper,
    borderTopWidth: 1, borderTopColor: T.line,
    // paddingBottom comes from useSafeAreaInsets() at runtime — keeps the
    // strip above the home indicator / gesture bar on iOS X+ and Android
  },
  colorsStrip: {
    paddingHorizontal: 14, paddingVertical: 12, gap: 14,
  },
  chipWrap: { alignItems: 'center', gap: 5, width: CHIP_SIZE + 8 },
  chipRing: {
    width: CHIP_SIZE, height: CHIP_SIZE, borderRadius: CHIP_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  chipRingOn: {
    shadowColor: T.mauveDeep, shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  chipSymbolWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  chipSymbol: { fontSize: 20, fontWeight: '900' },
  chipDoneCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  chipDoneCheckTxt: { fontSize: 13, fontWeight: '900', color: T.successTx, lineHeight: 14 },
  chipCode: { fontSize: 10, fontWeight: '800', color: T.inkSoft, letterSpacing: 0.3 },
  chipCodeOn: { color: T.mauveDeep },
});
