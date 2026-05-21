import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Alert, PanResponder, Animated, Pressable, Modal,
} from 'react-native';
import { Image } from 'react-native';
import Svg, { Rect, Line, Circle, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { T, F, S, R, SPRING } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import {
  updateProject,
  hasSeenMilestone, markMilestoneSeen,
  hasSeenCoach, markCoachSeen,
} from '../utils/storage';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';
import ColorLegend from '../components/ColorLegend';
import Shimmer from '../components/Shimmer';
import ErrorBanner from '../components/ErrorBanner';
import MilestoneCelebration from '../components/MilestoneCelebration';
import { buildPdfHtml } from '../utils/pdf';
import { friendlyError } from '../utils/errors';

// Percentage thresholds the celebration sheet fires on. Sorted so the
// crossing detector can walk smallest → largest and pick the highest
// freshly-crossed band when multiple are passed in one update (e.g.
// the user just bulk-marked a whole colour).
const MILESTONE_THRESHOLDS = [25, 50, 75, 100];

// Kanaviçede saf beyaz arkaplan sayılan DMC iplikleri. Bu renge düşen
// hücreler tracking mode'da otomatik tamamlanmış sayılır ve dokunma
// alınmaz — kanaviçeci o bölgeleri zaten kumaşın kendi rengine bırakır.
// Ecru (#F5EDCA) ve 762 Pearl Gray gibi açık tonlar listede değil çünkü
// onlar gerçekten işlenen ipliklerdir.
const BACKGROUND_DMC_CODES = new Set(['B5200', 'blanc', '3865']);
function isBackgroundColor(color) {
  return !!color && BACKGROUND_DMC_CODES.has(color.dmcCode);
}

// Zoom ladder — in on-screen pixels per cell. The first two entries (5 and
// 7) let the user zoom out far enough to see a whole 60–70 cell pattern in
// a single viewport on phone-sized devices. At these scales the SVG render
// still works (the chart SVG uses viewBox + BASE_CELL internal coords so
// it scales cleanly), but symbols and grid lines auto-hide via the
// SYMBOL_MIN_CELL / GRID_MIN_CELL thresholds — they'd just smear into
// noise below ~10 px per cell.
const ZOOM_LEVELS = [5, 7, 10, 14, 20, 28, 40];
const SYMBOL_MIN_CELL = 20;
const GRID_MIN_CELL = 10;
// MIN_CELL matches ZOOM_LEVELS[0] so the pinch clamp and the zoom-out
// button's `disabled` state agree on the same floor — without the match,
// pinching past the button's floor would land on a cell size no toolbar
// step can return from.
const MIN_CELL = 5;
const MAX_CELL = 60;

const BASE_CELL = 32;

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectDetailScreen({ project, onBack, onChange }) {
  const { strings, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [completed, setCompleted] = useState(project.completed || {});
  // Most recent colour the user actually painted/toggled/bulk-marked.
  // Persisted to storage on every edit (see the debounced effect below)
  // so HomeScreen's ContinuingCard can read "you were on DMC X" without
  // re-deriving from `completed` every time.
  const [lastEditedColorId, setLastEditedColorId] = useState(
    project.lastEditedColorId ?? null,
  );
  const [trackingMode, setTrackingMode] = useState(false);
  const [cellSize, setCellSize] = useState(20);
  const [highlightedColor, setHighlightedColor] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Three-stage visual state for the export progress modal. `null`
  // when idle; transitions building → opening → done while the
  // export runs.
  const [exportStage, setExportStage] = useState(null);
  const [exportError, setExportError] = useState(null);
  // Tracks whether the user dismissed the modal via the Vazgeç pill.
  // expo-print can't actually be cancelled, but we use this flag to
  // suppress UI updates (stage flips, "Hazır" reveal, error banner)
  // after the user has explicitly walked away from the export.
  const exportCancelledRef = useRef(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Focus mode — when a colour is spotlighted and the user opts in, only
  // cells of that colour respond to taps/drag. Cleared automatically when
  // the spotlight closes or the user switches colours (effect below).
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setFocusMode(false);
  }, [highlightedColor]);

  // Refs let `handleAt` (recreated each render but captured by the
  // memoised PanResponder) read the latest values without forcing the
  // PanResponder to rebuild.
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  const lockRef = useRef(null);
  useEffect(() => {
    lockRef.current = (focusMode && highlightedColor !== null) ? highlightedColor : null;
  }, [focusMode, highlightedColor]);

  // Canvas scroll refs + measured viewport. Both ScrollViews report their
  // contentOffset on scroll; the outer one also reports its layout box so
  // we know how much of the pattern is visible. The minimap reads these
  // to draw its viewport rect and to convert taps back to scroll targets.
  const vScrollRef = useRef(null);
  const hScrollRef = useRef(null);
  const [viewport, setViewport]     = useState({ w: 0, h: 0 });
  const [scrollOff, setScrollOff]   = useState({ x: 0, y: 0 });

  const zoomIdx = useMemo(() => {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      const d = Math.abs(ZOOM_LEVELS[i] - cellSize);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }, [cellSize]);

  const cellSizeRef = useRef(cellSize);
  useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);

  // Beyaz arkaplan rengine düşen hücreler. Tracking mode bu cell'leri
  // otomatik dolu sayar (gri overlay), dokunmayı kabul etmez ve yüzde
  // hesabından düşürür — yüzde sadece kullanıcının emek verdiği
  // işlenebilir cell'ler üzerinden ilerler.
  const lockedColorIds = useMemo(() => {
    const set = new Set();
    for (const c of project.colors) {
      if (isBackgroundColor(c)) set.add(c.id);
    }
    return set;
  }, [project.colors]);

  const lockedCellCount = useMemo(() => {
    if (lockedColorIds.size === 0) return 0;
    let n = 0;
    for (let r = 0; r < project.height; r++) {
      for (let c = 0; c < project.width; c++) {
        if (lockedColorIds.has(project.grid[r][c])) n++;
      }
    }
    return n;
  }, [lockedColorIds, project]);

  // paintCell/toggleCell zero-deps useCallback'leri — ref ile en güncel
  // set'e ulaşıp closure'ı rebuild etmeden lock kontrolü yapıyorlar.
  const lockedColorIdsRef = useRef(lockedColorIds);
  useEffect(() => { lockedColorIdsRef.current = lockedColorIds; }, [lockedColorIds]);

  const totalCells = project.width * project.height;
  const stitchableCells = Math.max(0, totalCells - lockedCellCount);
  // Eski projelerde kullanıcı bir zamanlar beyaz hücreyi elle
  // işaretlemiş olabilir; bu key'leri sayıma katmıyoruz ki yüzde
  // sadece gerçek kullanıcı emeğini yansıtsın.
  const doneCount = useMemo(() => {
    if (lockedColorIds.size === 0) return Object.keys(completed).length;
    let n = 0;
    for (const key of Object.keys(completed)) {
      const [r, c] = key.split(',').map(Number);
      if (!lockedColorIds.has(project.grid[r]?.[c])) n++;
    }
    return n;
  }, [completed, lockedColorIds, project]);
  const pct = stitchableCells > 0 ? Math.round((doneCount / stitchableCells) * 100) : 0;

  useEffect(() => {
    const t = setTimeout(async () => {
      await updateProject(project.id, { completed, lastEditedColorId });
      onChange?.();
    }, 400);
    return () => clearTimeout(t);
  }, [completed, lastEditedColorId]);

  // ─── Milestone celebrations ────────────────────────────────────────────
  // When the user freshly crosses 25 / 50 / 75 / 100 %, surface a glass
  // celebration sheet with a unique illustration + share button. A flag
  // per (project, threshold) is set in AsyncStorage on first cross so
  // the sheet never repeats — even if the user later uncheckes cells
  // and crosses back over.
  //
  // `milestone` is `null` (sheet hidden) or one of the threshold numbers
  // (sheet showing that band). We track `pctRef` so the effect only
  // fires on *changes* — re-mounting on a project that's already at 60%
  // shouldn't replay 25/50.
  //
  // Multi-band jumps (e.g. bulk-mark a colour pushes 20% → 80%): we
  // surface the highest freshly-crossed band as the actual celebration
  // (most satisfying), but stamp *every* crossed band as seen so the
  // lower cards don't queue up if the user later un-checks down to 24%
  // and re-checks to 26%. Crossing 75% implicitly retires 25/50.
  const [milestone, setMilestone] = useState(null);
  const pctRef = useRef(pct);
  useEffect(() => {
    const prev = pctRef.current;
    pctRef.current = pct;
    if (pct <= prev) return;
    (async () => {
      let highestNew = null;
      for (const th of MILESTONE_THRESHOLDS) {
        const crossed = prev < th && pct >= th;
        if (!crossed) continue;
        const seen = await hasSeenMilestone(project.id, th);
        if (seen) continue;
        await markMilestoneSeen(project.id, th);
        highestNew = th;
      }
      if (highestNew != null) setMilestone(highestNew);
    })();
  }, [pct, project.id]);

  // ─── First-use coach tooltips ─────────────────────────────────────────
  // Glass tooltips that fire the first time the user activates each mode
  // inside the canvas. After the AsyncStorage flag is set, subsequent
  // activations are silent — the modeChip's own label is the ongoing
  // affordance, re-explaining would just feel patronising.
  //
  // `coachTip` is the kind currently showing ('tracking' | 'focus' |
  // null). The CoachTooltip component owns its own 4s lifecycle and
  // animations; we just feed it a kind and a clear-on-dismiss callback.
  // `key={coachTip}` on the render so swapping kinds force-remounts and
  // replays the entrance animation cleanly.
  const [coachTip, setCoachTip] = useState(null);

  useEffect(() => {
    if (!trackingMode) return;
    (async () => {
      const seen = await hasSeenCoach('tracking');
      if (seen) return;
      await markCoachSeen('tracking');
      setCoachTip('tracking');
    })();
  }, [trackingMode]);

  useEffect(() => {
    if (!focusMode) return;
    (async () => {
      const seen = await hasSeenCoach('focus');
      if (seen) return;
      await markCoachSeen('focus');
      setCoachTip('focus');
    })();
  }, [focusMode]);

  const colorProgress = useMemo(() => {
    const map = {};
    for (const c of project.colors) {
      // Beyaz arkaplan renkleri kullanıcı dokunmadan tamamlanmış sayılır.
      const isLocked = lockedColorIds.has(c.id);
      map[c.id] = { done: isLocked ? c.count : 0, total: c.count };
    }
    for (const key of Object.keys(completed)) {
      const [r, c] = key.split(',').map(Number);
      const cid = project.grid[r]?.[c];
      if (cid != null && map[cid] && !lockedColorIds.has(cid)) {
        map[cid].done += 1;
      }
    }
    return map;
  }, [completed, project, lockedColorIds]);

  // `lockedToColor` (optional) — when set, only cells of that colour id
  // respond. Used by focus mode; pass null for normal behaviour. Reads
  // the latest grid via projectRef so the callback can stay stable
  // (no deps), which keeps the PanResponder memo intact.
  const paintCell = useCallback((r, c, lockedToColor = null) => {
    const cid = projectRef.current.grid[r]?.[c];
    // Beyaz arkaplan hücreleri zaten "dolu" sayılıyor; dokunma yutulsun.
    if (lockedColorIdsRef.current.has(cid)) return;
    if (lockedToColor !== null && cid !== lockedToColor) return;
    setCompleted((prev) => {
      const key = `${r},${c}`;
      if (prev[key]) return prev;
      // Throttled inside utils — a drag that crosses 50 cells fires at
      // most ~12 taptics instead of 50, so the device doesn't buzz like
      // a stuck motor.
      haptics.tapThrottled();
      // Stamp the moment of completion as the value (still truthy, so
      // Object.keys length math is unchanged). HomeScreen's stitch
      // counter reads these timestamps to derive the 7-day rolling
      // delta; legacy `true` values keep working and simply don't
      // contribute to the recency band.
      return { ...prev, [key]: Date.now() };
    });
    // Stamp the last touched colour even when paint is a no-op (cell
    // was already done) — "last colour you were working on" is a more
    // useful signal than "last colour you newly completed".
    if (cid != null) setLastEditedColorId(cid);
  }, []);

  const toggleCell = useCallback((r, c, lockedToColor = null) => {
    const cid = projectRef.current.grid[r]?.[c];
    if (lockedColorIdsRef.current.has(cid)) return;
    if (lockedToColor !== null && cid !== lockedToColor) return;
    setCompleted((prev) => {
      const key = `${r},${c}`;
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = Date.now();
      return next;
    });
    if (cid != null) setLastEditedColorId(cid);
  }, []);

  const markColorDone = (colorId) => {
    Alert.alert(
      strings.pdMarkAllTitle,
      strings.pdMarkAllBody(project.colors[colorId].dmcCode),
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.pdMarkAllConfirm,
          onPress: () => {
            const now = Date.now();
            setCompleted((prev) => {
              const next = { ...prev };
              for (let r = 0; r < project.height; r++) {
                for (let c = 0; c < project.width; c++) {
                  if (project.grid[r][c] === colorId) next[`${r},${c}`] = now;
                }
              }
              return next;
            });
            setLastEditedColorId(colorId);
          },
        },
      ]
    );
  };

  const unmarkColorDone = (colorId) => {
    Alert.alert(
      strings.pdUnmarkTitle,
      strings.pdUnmarkBody(project.colors[colorId].dmcCode),
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.pdUnmarkConfirm,
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
            setLastEditedColorId(colorId);
          },
        },
      ]
    );
  };

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
            fill="rgba(74,63,63,0.55)" textAnchor="middle"
          >{color.symbol}</SvgText>
        );
      }
    }
    return items;
  }, [project]);

  const doneSvg = useMemo(() => {
    const parts = [];
    for (const key of Object.keys(completed)) {
      const [r, c] = key.split(',').map(Number);
      parts.push(`M${c * BASE_CELL} ${r * BASE_CELL}h${BASE_CELL}v${BASE_CELL}h-${BASE_CELL}z`);
    }
    // Beyaz arkaplan cell'lerine de aynı gri overlay'i bindiriyoruz —
    // kullanıcı bu hücrelerin halledilmiş sayıldığını görsel olarak
    // görsün. ✓ tick eklemiyoruz; o işaret yalnız kullanıcı emeği için.
    if (lockedColorIds.size > 0) {
      for (let r = 0; r < project.height; r++) {
        const row = project.grid[r];
        for (let c = 0; c < project.width; c++) {
          if (lockedColorIds.has(row[c])) {
            parts.push(`M${c * BASE_CELL} ${r * BASE_CELL}h${BASE_CELL}v${BASE_CELL}h-${BASE_CELL}z`);
          }
        }
      }
    }
    if (parts.length === 0) return null;
    return <Path key="done-fill" d={parts.join('')} fill="#E8E5DD"/>;
  }, [completed, lockedColorIds, project]);

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
    items.push(<Rect key="dim" x={0} y={0} width={W} height={H} fill="rgba(249,247,245,0.78)"/>);
    const color = project.colors[highlightedColor];
    // Beyaz arkaplan rengi spotlight'a alınırsa tüm cell'ler done sayılır.
    const isLockedColor = lockedColorIds.has(highlightedColor);
    const fs = Math.floor(BASE_CELL * 0.6);
    for (let r = 0; r < project.height; r++) {
      for (let c = 0; c < project.width; c++) {
        if (project.grid[r][c] !== highlightedColor) continue;
        const done = completed[`${r},${c}`] || isLockedColor;
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
          stroke={major ? 'rgba(74,63,63,0.35)' : 'rgba(74,63,63,0.10)'}
          strokeWidth={major ? 0.8 : 0.4}
          vectorEffect="non-scaling-stroke"/>
      );
    }
    for (let i = 1; i < project.width; i++) {
      const major = i % 10 === 0;
      lines.push(
        <Line key={`v${i}`} x1={i * BASE_CELL} y1={0} x2={i * BASE_CELL} y2={H}
          stroke={major ? 'rgba(74,63,63,0.35)' : 'rgba(74,63,63,0.10)'}
          strokeWidth={major ? 0.8 : 0.4}
          vectorEffect="non-scaling-stroke"/>
      );
    }
    return lines;
  }, [showGrid, project.width, project.height]);

  const dragStarted = useRef(false);
  const lastCell = useRef({ r: -1, c: -1 });
  const pinchBase = useRef(null);
  // `pinching` drives ScrollView lock + the haptic-on-band-change
  // bookkeeping. State (not ref) because the inner/outer ScrollViews
  // need to re-render with the new scrollEnabled prop.
  const [pinching, setPinching] = useState(false);
  // Tracks which ZOOM_LEVELS bucket the current cellSize falls into
  // during a pinch. Fires haptics.selection() each time the user
  // crosses a threshold so the zoom snaps feel detectable through
  // touch alone.
  const pinchLastBandRef = useRef(-1);

  // Bucket the live cellSize into the closest ZOOM_LEVELS index by
  // floor — i.e. the index of the largest preset that's ≤ size. Used
  // to detect "the user just crossed a snap threshold" during a
  // pinch, which then fires a haptic tick.
  const zoomBandIndex = (size) => {
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
      if (size >= ZOOM_LEVELS[i]) return i;
    }
    return 0;
  };

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
    // lockRef reflects focusMode + highlightedColor at the time of the
    // touch, not at the time the PanResponder was built — so toggling
    // focus mid-session works without rebuilding the responder.
    const lock = lockRef.current;
    if (mode === 'paint') paintCell(r, c, lock);
    else toggleCell(r, c, lock);
  };

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
        pinchLastBandRef.current = zoomBandIndex(cellSizeRef.current);
        setPinching(true);
      } else {
        dragStarted.current = false;
        lastCell.current = { r: -1, c: -1 };
      }
    },
    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length >= 2) {
        if (!pinchBase.current || pinchBase.current.dist === 0) {
          pinchBase.current = { dist: touchDistance(touches), cellSize: cellSizeRef.current };
          return;
        }
        const newDist = touchDistance(touches);
        if (newDist === 0) return;
        // Power-ease the pinch ratio so a 1.5× finger spread doesn't
        // catapult the canvas to 1.5× zoom. Exponent < 1 dampens both
        // directions (out and in) symmetrically — at 0.7 a raw 1.5×
        // pinch lands around 1.33×, and a raw 0.5× lands around 0.62×.
        const rawScale = newDist / pinchBase.current.dist;
        const dampedScale = Math.pow(rawScale, 0.7);
        const next = Math.max(MIN_CELL, Math.min(MAX_CELL, pinchBase.current.cellSize * dampedScale));
        setCellSize(next);

        // Haptic tick whenever the live size crosses into a new
        // ZOOM_LEVELS bucket — gives the gesture a felt cadence so
        // the user doesn't need to watch the dots to gauge their
        // zoom level.
        const band = zoomBandIndex(next);
        if (band !== pinchLastBandRef.current) {
          pinchLastBandRef.current = band;
          haptics.selection();
        }
        return;
      }
      if (pinchBase.current) return;
      if (trackingMode) {
        dragStarted.current = true;
        handleAt(evt.nativeEvent.locationX, evt.nativeEvent.locationY, 'paint');
      }
    },
    onPanResponderRelease: (evt) => {
      if (pinchBase.current) {
        pinchBase.current = null;
        setPinching(false);
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
      setPinching(false);
      dragStarted.current = false;
      lastCell.current = { r: -1, c: -1 };
    },
  }), [trackingMode, project.height, project.width, paintCell, toggleCell]);

  // PDF export with a three-stage progress modal. The 800 ms minimum
  // dwell on "building" makes the transition feel intentional even when
  // printToFileAsync resolves quickly; without it the modal would
  // flash. The "Hazır" reveal sits for 600 ms before auto-dismiss so
  // the user gets a moment of closure before returning to the canvas.
  //
  // `exportCancelledRef` guards every async resumption — if the user
  // tapped Vazgeç on the modal we skip the remaining state flips and
  // the error banner, since they explicitly walked away.
  const handleExportPdf = async () => {
    exportCancelledRef.current = false;
    setExportError(null);
    setExportStage('building');
    setExporting(true);

    try {
      const html = buildPdfHtml(project, completed);
      const [{ uri }] = await Promise.all([
        Print.printToFileAsync({ html, base64: false }),
        new Promise((r) => setTimeout(r, 800)),
      ]);
      if (exportCancelledRef.current) return;

      setExportStage('opening');
      await Print.printAsync({ uri });
      if (exportCancelledRef.current) return;

      setExportStage('done');
      setTimeout(() => {
        if (!exportCancelledRef.current) setExporting(false);
      }, 600);
    } catch (err) {
      console.log('[exportPdf] FAILED:', err.message);
      if (exportCancelledRef.current) return;
      setExporting(false);
      setExportError(friendlyError(err));
    }
  };

  // Tapping Vazgeç dismisses the modal but the underlying
  // printToFileAsync keeps running — expo-print exposes no cancel
  // hook. The ref flag stops the chained state updates so the modal
  // doesn't pop back up with "Hazır" after the user has left.
  const handleExportCancel = () => {
    exportCancelledRef.current = true;
    setExporting(false);
  };

  const selectedColor = highlightedColor !== null ? project.colors[highlightedColor] : null;
  const selectedProgress = highlightedColor !== null ? colorProgress[highlightedColor] : null;

  const toggleFocus = () => {
    setFocusMode((f) => {
      const next = !f;
      // Turning focus on without tracking is a soft trap — the lock only
      // takes effect when there's something to lock. Auto-enable
      // tracking on the way in; leave it untouched on the way out.
      if (next) setTrackingMode(true);
      return next;
    });
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      {/* ─── Top bar ──────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Glass tone="light" radius={R.medium} intensity={40} style={styles.iconBtn}>
            <ChevronLeftIcon/>
          </Glass>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.topTitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <TouchableOpacity onPress={handleExportPdf} disabled={exporting} activeOpacity={0.7}>
          <Glass tone="light" radius={R.medium} intensity={40} style={styles.iconBtn}>
            <DownloadIcon/>
          </Glass>
        </TouchableOpacity>
      </View>

      {/* Export error — shows when handleExportPdf catches. Retry
          re-fires the export from scratch. */}
      {exportError && (
        <View style={styles.exportErrorWrap}>
          <ErrorBanner
            title={exportError.title}
            message={exportError.message}
            onRetry={() => { setExportError(null); handleExportPdf(); }}
            onDismiss={() => setExportError(null)}
          />
        </View>
      )}

      {/* ─── Progress ribbon ──────────────────────────────────────────── */}
      <View style={styles.ribbon}>
        <View style={styles.ribbonBarTrack}>
          <View style={[styles.ribbonBarFill, { width: `${pct}%` }]}/>
        </View>
        <Text style={styles.ribbonStats}>
          <Text style={styles.ribbonStrong}>{pct}%</Text>
          <Text style={styles.ribbonDim}>  ·  {doneCount.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}/{totalCells.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')} {strings.pdRibbonStitchSuffix}  ·  {project.width}×{project.height}</Text>
        </Text>
      </View>

      {/* ─── Canvas ───────────────────────────────────────────────────── */}
      <View style={styles.canvasWrap}>
        <ScrollView
          ref={vScrollRef}
          style={styles.canvasV}
          contentContainerStyle={{ padding: 14 }}
          scrollEnabled={!trackingMode && !pinching}
          onLayout={(e) => {
            // Read nativeEvent synchronously — React Native pools its
            // synthetic events and nullifies nativeEvent after the
            // handler returns, so any deferred access (incl. setState
            // updater callbacks) crashes with "Cannot read property
            // 'contentOffset'/'layout' of null".
            const { width, height } = e.nativeEvent.layout;
            setViewport({ w: width, h: height });
          }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setScrollOff((o) => ({ x: o.x, y }));
          }}
          scrollEventThrottle={16}
        >
          <ScrollView
            ref={hScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!trackingMode && !pinching}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setScrollOff((o) => ({ x, y: o.y }));
            }}
            scrollEventThrottle={16}
          >
            <View {...panResponder.panHandlers} style={{ width: project.width * cellSize, height: project.height * cellSize }}>
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
                </Svg>
              )}

              {/* Overlay SVG — sits on top of either the cached PNG or
                  the SVG-rendered chart. Grid lines moved here from
                  the base SVG so the toggle is meaningful for both
                  render modes (the toolbar grid icon was dead when an
                  image was present). Order: done fills first so the
                  grid hairline still reads on top of them, then check
                  marks, then highlight overlay, then grid as the very
                  top layer for unbroken visibility. */}
              <Svg
                style={{ position: 'absolute', left: 0, top: 0 }}
                width={project.width * cellSize}
                height={project.height * cellSize}
                viewBox={`0 0 ${project.width * BASE_CELL} ${project.height * BASE_CELL}`}
              >
                {doneSvg}
                {cellSize >= SYMBOL_MIN_CELL && doneSymbolsSvg}
                {highlightSvg}
                {cellSize >= GRID_MIN_CELL && gridSvg}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>

        {trackingMode && (
          <Glass tone="mauve" radius={R.pill} intensity={50} blurTint="dark" style={styles.modeChip}>
            <View style={styles.modeChipDot}/>
            <Text style={styles.modeChipTxt}>
              {focusMode && selectedColor
                ? strings.pdModeFocusLabel(selectedColor.dmcCode)
                : strings.pdModeTrackingLabel}
            </Text>
          </Glass>
        )}

        {/* First-use coach mark — sits below the modeChip on the
            canvas, auto-dismisses after 4s. `key={coachTip}` swaps the
            component instance when the kind changes (tracking → focus)
            so the entrance animation replays cleanly. */}
        {coachTip && (
          <CoachTooltip
            key={coachTip}
            kind={coachTip}
            onAutoDismiss={() => setCoachTip(null)}
          />
        )}

        {/* Minimap hides while tracking — the canvas owns the screen
            then, and a 90px overlay in the corner only competes for
            attention while the user is trying to paint. */}
        {!trackingMode && (
          <Minimap
            project={project}
            cellSize={cellSize}
            viewport={viewport}
            scrollOff={scrollOff}
            onJump={(x, y) => {
              // animated:false on purpose — drag should be 1:1 with the
              // finger. Animated scrolls would queue and lag behind the
              // continuous onPanResponderMove stream.
              hScrollRef.current?.scrollTo({ x, animated: false });
              vScrollRef.current?.scrollTo({ y, animated: false });
            }}
          />
        )}
      </View>

      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <View style={styles.toolBar}>
        <Glass tone="light" radius={R.pill} intensity={40} style={styles.zoomGroup}>
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
        </Glass>

        <View style={{ flex: 1 }}/>

        <RoundIconBtn onPress={() => setShowGrid((s) => !s)} active={showGrid}>
          <GridIcon active={showGrid}/>
        </RoundIconBtn>
        <TrackingPill
          active={trackingMode}
          onPress={() => { haptics.selection(); setTrackingMode((t) => !t); }}
        />
      </View>

      {/* ─── Color spotlight ──────────────────────────────────────────── */}
      {selectedColor && selectedProgress && (
        <ColorSpotlight
          color={selectedColor}
          progress={selectedProgress}
          focus={focusMode}
          onMarkDone={() => markColorDone(selectedColor.id)}
          onUnmark={() => unmarkColorDone(selectedColor.id)}
          onClear={() => setHighlightedColor(null)}
          onToggleFocus={toggleFocus}
        />
      )}

      {/* ─── Color circles strip ──────────────────────────────────────── */}
      <Glass tone="tint" radius={0} intensity={50} bordered={false} style={[styles.colorsBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorsStrip}
        >
          {/* "Tümü" — pinned chip that opens the searchable ColorLegend
              modal. Visually distinct (Soft Petal fill, grid icon) so it
              doesn't read as a real colour. */}
          <TouchableOpacity
            onPress={() => setPaletteOpen(true)}
            activeOpacity={0.8}
            style={styles.chipWrap}
            accessibilityRole="button"
            accessibilityLabel={strings.pdAllColorsLabel}
          >
            <View style={[styles.chipRing, styles.allChipRing]}>
              <PaletteIcon/>
            </View>
            <Text style={[styles.chipCode, styles.allChipCode]} numberOfLines={1}>{strings.pdAllChipLabel}</Text>
          </TouchableOpacity>

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
      </Glass>

      {/* Palette modal — sibling-scrim pattern matching WorkshopScreen.
          ColorLegend already renders inside its own Glass card, so the
          scrim sits directly behind it. Tapping a colour sets the
          highlight + dismisses the modal so the user lands back on the
          canvas with that colour spotlighted. */}
      <Modal
        visible={paletteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPaletteOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.paletteBackdropWrap}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPaletteOpen(false)}/>
          <ScrollView
            style={styles.paletteScroll}
            contentContainerStyle={styles.paletteContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ColorLegend
              colors={project.colors}
              highlighted={highlightedColor}
              onHighlight={(id) => {
                setHighlightedColor(id === highlightedColor ? null : id);
                setPaletteOpen(false);
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      <ExportProgressModal
        visible={exporting}
        stage={exportStage}
        onCancel={handleExportCancel}
      />

      {/* Milestone celebration — full-screen scrim + glass card. The
          detection effect above stamps the flag and sets `milestone`;
          the card auto-dismisses after 4s (or earlier if the user taps
          the scrim) and calls onClose to clear `milestone` back to
          null, so the next crossing can show its own card. */}
      <MilestoneCelebration
        threshold={milestone}
        onClose={() => setMilestone(null)}
      />
    </View>
  );
}

// Three-stage progress modal for the PDF export. Stays open from the
// first state ("building") through "opening" and finally "done", then
// the parent auto-dismisses after a short reveal. The Shimmer + the
// stage copy do the heavy lifting — there's no spinner that could
// stall and feel like a freeze.
//
// The cancel pill is presentational: tapping it only closes the
// modal, since expo-print has no cancellation API. We surface that
// caveat in a small note so the user understands what the button
// does (and doesn't do).
function ExportProgressModal({ visible, stage, onCancel }) {
  const { strings } = useLanguage();
  const stageText =
      stage === 'opening' ? strings.pdExportOpening
    : stage === 'done'    ? strings.pdExportDone
    :                       strings.pdExportBuilding;

  const inProgress = stage !== 'done';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.exportBackdrop}>
        <Glass
          tone="light"
          radius={R.large}
          intensity={70}
          blurTint="light"
          style={styles.exportCard}
        >
          <View style={styles.exportIconWrap}>
            <ExportDocIcon/>
          </View>
          <Text style={styles.exportTitle}>{stageText}</Text>

          {inProgress && (
            <Shimmer width="100%" height={4} radius={2} style={styles.exportShimmer}/>
          )}

          {inProgress && (
            <>
              <TouchableOpacity
                onPress={onCancel}
                activeOpacity={0.7}
                style={styles.exportCancelBtn}
                accessibilityRole="button"
                accessibilityLabel={strings.cancel}
              >
                <Text style={styles.exportCancelTxt}>{strings.cancel}</Text>
              </TouchableOpacity>
              <Text style={styles.exportNote}>
                {strings.pdExportCancelNote}
              </Text>
            </>
          )}
        </Glass>
      </View>
    </Modal>
  );
}

function ExportDocIcon({ stroke = T.mauveDeep, accent = T.mauve }) {
  return (
    <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 13h6M9 17h6M9 9h2"
        stroke={accent}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PaletteIcon({ color = T.mauveDeep }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
        fill={color}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
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
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.9 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={[
        styles.roundBtn,
        disabled && styles.roundBtnOff,
        active   && styles.roundBtnActive,
        { transform: [{ scale }] },
      ]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

function TrackingPill({ active, onPress }) {
  const { strings } = useLanguage();
  const scale = useRef(new Animated.Value(1)).current;
  // Both states render a plain View, switching backgrounds via the
  // active/idle style. We used to wrap the idle state in <Glass>, but
  // Glass's `content: flex:1` collapses to 0×0 inside a flex-row
  // toolbar parent that has no fixed width — same WelcomeScreen
  // haptic-tile trap. The white pill below is solid enough that
  // dropping the BlurView is barely perceptible.
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.94 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.trackPill, active ? styles.trackPillOn : styles.trackPillIdle]}>
          <PencilIcon color={active ? '#fff' : T.mauveDeep}/>
          <Text style={[styles.trackPillTxt, active && styles.trackPillTxtOn]}>{strings.pdTrackingPill}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Minimap ─────────────────────────────────────────────────────────────────
// Pattern thumbnail — same recipe as WorkshopScreen's Mini, just inlined
// to keep this screen self-contained. Memoised on `project` so scroll
// updates (which re-render the parent every frame) don't rebuild the
// SVG. With imageDataUri available, falls back to the cached raster.
const MinimapThumb = memo(function MinimapThumb({ project, thumbW, thumbH }) {
  if (project.imageDataUri) {
    return (
      <Image
        source={{ uri: project.imageDataUri }}
        style={{ width: thumbW, height: thumbH }}
        resizeMode="stretch"
        fadeDuration={0}
      />
    );
  }
  const cw = thumbW / project.width;
  const byColor = new Map();
  for (let r = 0; r < project.height; r++) {
    for (let c = 0; c < project.width; c++) {
      const cid = project.grid[r][c];
      let parts = byColor.get(cid);
      if (!parts) { parts = []; byColor.set(cid, parts); }
      parts.push(`M${c * cw} ${r * cw}h${cw}v${cw}h-${cw}z`);
    }
  }
  const items = [];
  for (const [cid, parts] of byColor) {
    items.push(
      <Path key={`mn-${cid}`} d={parts.join('')} fill={project.colors[cid]?.dmcHex || '#fff'}/>
    );
  }
  return (
    <Svg width={thumbW} height={thumbH} viewBox={`0 0 ${thumbW} ${thumbH}`}>
      {items}
    </Svg>
  );
});

const MINI_OUTER = 90;
const MINI_PAD   = 6;
const MINI_INNER = MINI_OUTER - MINI_PAD * 2;

function Minimap({ project, cellSize, viewport, scrollOff, onJump }) {
  const W = project.width;
  const H = project.height;
  // Aspect-preserving scale so non-square patterns still fit.
  const scale  = MINI_INNER / Math.max(W, H);
  const thumbW = W * scale;
  const thumbH = H * scale;

  const contentW = W * cellSize;
  const contentH = H * cellSize;

  // Viewport rect in minimap coords, clamped so it never overflows the
  // thumb (happens when content < viewport, i.e. zoomed out fully).
  const vw = contentW > 0 ? Math.min(thumbW, (viewport.w / contentW) * thumbW) : thumbW;
  const vh = contentH > 0 ? Math.min(thumbH, (viewport.h / contentH) * thumbH) : thumbH;
  const vx = contentW > 0 ? Math.max(0, Math.min(thumbW - vw, (scrollOff.x / contentW) * thumbW)) : 0;
  const vy = contentH > 0 ? Math.max(0, Math.min(thumbH - vh, (scrollOff.y / contentH) * thumbH)) : 0;

  // Stable scrub fn ref — updated every render so it sees the latest
  // dimensions/viewport without forcing the PanResponder to rebuild.
  // The PanResponder is created once (empty deps) so it doesn't drop
  // the gesture mid-drag.
  const scrubRef = useRef(null);
  scrubRef.current = (lx, ly) => {
    if (contentW <= 0 || contentH <= 0 || viewport.w <= 0 || viewport.h <= 0) return;
    // Clamp first so dragging the finger past the minimap edges still
    // pegs the viewport at the corresponding corner instead of bailing.
    const tx = Math.max(0, Math.min(thumbW, lx - MINI_PAD));
    const ty = Math.max(0, Math.min(thumbH, ly - MINI_PAD));
    const px = (tx / thumbW) * contentW;
    const py = (ty / thumbH) * contentH;
    const maxX = Math.max(0, contentW - viewport.w);
    const maxY = Math.max(0, contentH - viewport.h);
    const sx = Math.max(0, Math.min(maxX, px - viewport.w / 2));
    const sy = Math.max(0, Math.min(maxY, py - viewport.h / 2));
    onJump(sx, sy);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder:         () => true,
    onMoveShouldSetPanResponderCapture:  () => true,
    onPanResponderTerminationRequest:    () => false,
    onPanResponderGrant: (e) => {
      const lx = e.nativeEvent.locationX;
      const ly = e.nativeEvent.locationY;
      scrubRef.current?.(lx, ly);
    },
    onPanResponderMove: (e) => {
      const lx = e.nativeEvent.locationX;
      const ly = e.nativeEvent.locationY;
      scrubRef.current?.(lx, ly);
    },
  }), []);

  return (
    <View style={styles.minimapWrap} pointerEvents="box-none">
      <View {...panResponder.panHandlers}>
        <Glass tone="light" radius={R.medium} intensity={50} style={styles.minimap}>
          <View style={{ width: thumbW, height: thumbH }}>
            <MinimapThumb project={project} thumbW={thumbW} thumbH={thumbH}/>
            <Svg
              style={StyleSheet.absoluteFill}
              width={thumbW}
              height={thumbH}
            >
              <Rect
                x={vx} y={vy}
                width={vw} height={vh}
                stroke={T.mauve} strokeWidth={1.5}
                fill="transparent"
                vectorEffect="non-scaling-stroke"
              />
            </Svg>
          </View>
        </Glass>
      </View>
    </View>
  );
}

// ─── Color chip ──────────────────────────────────────────────────────────────
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
          <Circle cx={CHIP_SIZE / 2} cy={CHIP_SIZE / 2} r={CHIP_RADIUS}
            stroke={T.lineSoft} strokeWidth={CHIP_STROKE} fill="none"/>
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
          <Circle cx={CHIP_SIZE / 2} cy={CHIP_SIZE / 2} r={CHIP_INNER}
            fill={color.dmcHex} stroke={T.line} strokeWidth={0.5}/>
        </Svg>

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

function pickContrast(hex) {
  if (!hex || hex.length < 7) return 'rgba(74,63,63,0.7)';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? 'rgba(74,63,63,0.7)' : 'rgba(255,255,255,0.95)';
}

// ─── Spotlight panel ─────────────────────────────────────────────────────────
function ColorSpotlight({ color, progress, focus, onMarkDone, onUnmark, onClear, onToggleFocus }) {
  const { strings } = useLanguage();
  const slide = useRef(new Animated.Value(0)).current;
  const y     = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(y,     { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const allDone = progress.done >= progress.total && progress.total > 0;
  const remaining = progress.total - progress.done;

  return (
    <Animated.View style={[styles.spotlightWrap, { opacity: slide, transform: [{ translateY: y }] }]}>
    <Glass tone="light" radius={R.expressive} intensity={50} style={styles.spotlight}>
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
            {progress.done}/{progress.total} {strings.pdRibbonStitchSuffix} · {allDone ? strings.pdSpotlightDoneStatus : strings.pdSpotlightRemaining(remaining)}
          </Text>
        </View>

        <TouchableOpacity onPress={onClear} style={styles.spotClose} activeOpacity={0.7}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M6 6l12 12M6 18L18 6" stroke={T.inkMute} strokeWidth="2.2" strokeLinecap="round"/>
          </Svg>
        </TouchableOpacity>
      </View>

      <View style={styles.spotActions}>
        <TouchableOpacity
          onPress={onToggleFocus}
          activeOpacity={0.85}
          style={[styles.spotActionFocus, focus && styles.spotActionFocusOn]}
        >
          <Text style={[styles.spotActionFocusTxt, focus && styles.spotActionFocusTxtOn]}>
            {focus ? strings.pdSpotlightFocusOff : strings.pdSpotlightFocusOn}
          </Text>
        </TouchableOpacity>

        {allDone ? (
          <TouchableOpacity onPress={onUnmark} activeOpacity={0.85} style={styles.spotActionMainGhost}>
            <Text style={styles.spotActionGhostTxt}>{strings.pdSpotlightUnmark}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onMarkDone} activeOpacity={0.85} style={styles.spotActionMainPrimary}>
            <Text style={styles.spotActionPrimaryTxt}>{strings.pdSpotlightMarkAll}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Glass>
    </Animated.View>
  );
}

// ─── Coach tooltip ───────────────────────────────────────────────────────────
// First-use educational hint that sits below the modeChip on the canvas.
// Owns its own 4-second lifecycle: springs in, holds, fades out, then
// calls onAutoDismiss so the parent can null its `coachTip` state.
// `pointerEvents="none"` on the wrap so a long Turkish sentence parked
// over the pattern can't swallow taps while the user is trying to mark
// cells underneath.
function buildCoachCopy(strings) {
  return {
    tracking: strings.pdCoachTracking,
    focus:    strings.pdCoachFocus,
  };
}

const COACH_DWELL_MS = 4000;

function CoachTooltip({ kind, onAutoDismiss }) {
  const { strings } = useLanguage();
  const COACH_COPY = buildCoachCopy(strings);
  const opacity = useRef(new Animated.Value(0)).current;
  const lift    = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(lift,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => onAutoDismiss?.());
    }, COACH_DWELL_MS);

    return () => clearTimeout(t);
  }, [kind]);

  return (
    <Animated.View
      style={[styles.coachTipWrap, { opacity, transform: [{ translateY: lift }] }]}
      pointerEvents="none"
    >
      <Glass tone="dark" radius={R.medium} intensity={50} blurTint="dark" style={styles.coachTipInner}>
        <Text style={styles.coachTipText}>{COACH_COPY[kind]}</Text>
      </Glass>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generation — buildPdfHtml lives in utils/pdf.js so WorkshopScreen's
// completion celebration can reuse the same renderer. expo-print calls
// stay here because the multi-stage progress modal is screen-specific.
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
  },

  // ── Export error banner (above the ribbon) ──
  exportErrorWrap: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },

  // ── Export progress modal ──
  exportBackdrop: {
    flex: 1,
    backgroundColor: S.glassOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  // minHeight floor — same Glass.js flex-collapse workaround used on
  // the bottom sheets / dialogs elsewhere. Keeps icon + title + shimmer
  // + button + note from squeezing to nothing.
  exportCard: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    alignItems: 'center',
    minHeight: 240,
    shadowColor: T.ink,
    shadowOpacity: 0.20,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  exportIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
  },
  exportTitle: {
    fontSize: 15,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.1,
    marginBottom: 14,
    textAlign: 'center',
  },
  exportShimmer: {
    marginBottom: 18,
    alignSelf: 'stretch',
  },
  exportCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: R.pill,
    backgroundColor: S.surfaceSunken,
    borderWidth: 1,
    borderColor: T.line,
  },
  exportCancelTxt: {
    fontSize: 13,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
  exportNote: {
    fontSize: 11,
    fontFamily: F.regular,
    color: S.textTertiary,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 10,
    paddingHorizontal: 8,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8,
    gap: 8,
  },
  iconBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 16, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },

  // ── Progress ribbon ──
  ribbon: {
    paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10,
    gap: 6,
  },
  ribbonBarTrack: {
    height: 4, backgroundColor: T.lineSoft, borderRadius: R.hairline, overflow: 'hidden',
  },
  ribbonBarFill: { height: '100%', backgroundColor: T.mauve, borderRadius: R.hairline },
  ribbonStats: { fontSize: 11, fontFamily: F.semibold },
  ribbonStrong: { fontFamily: F.bold, color: S.textPrimary },
  ribbonDim: { color: S.textTertiary, fontFamily: F.regular },

  // ── Canvas ──
  canvasWrap: { flex: 1, marginHorizontal: 14, position: 'relative' },
  canvasV: {
    flex: 1, backgroundColor: S.surfaceElevated, borderRadius: R.expressive,
    borderWidth: 1, borderColor: T.line,
  },
  modeChip: {
    position: 'absolute', top: 10, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
  },

  // ── Minimap ──
  // Bottom-right of canvasWrap; the canvas itself ends just above the
  // toolBar so the minimap naturally sits clear of the colors strip.
  minimapWrap: {
    position: 'absolute',
    right: 10, bottom: 10,
  },
  minimap: {
    width: 90, height: 90,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.ink,
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modeChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.mauve },
  modeChipTxt: { fontSize: 11, fontFamily: F.bold, color: S.textOnBrand, letterSpacing: 0.3 },

  // ── Coach tooltip ──
  // Anchored just below the modeChip (chip is top:10 with ~32 px height,
  // so top:52 leaves a 10 px gap). Full-width with horizontal gutters
  // and alignItems:center so the inner Glass auto-sizes to its text up
  // to maxWidth and stays centered under the chip.
  coachTipWrap: {
    position: 'absolute',
    top: 52,
    left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  coachTipInner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 360,
    shadowColor: T.ink,
    shadowOpacity: 0.30,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  coachTipText: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: '#fff',
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // ── Toolbar ──
  toolBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  zoomGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    padding: 4,
  },
  zoomDots: {
    flexDirection: 'row', paddingHorizontal: 8, gap: 3, alignItems: 'center',
  },
  zoomDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: T.lineSoft },
  zoomDotOn:{ backgroundColor: T.mauve, width: 6, height: 6, borderRadius: 3 },

  roundBtn: {
    width: 32, height: 32, borderRadius: R.small,
    backgroundColor: S.surfaceElevated,
    borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  roundBtnOff: { opacity: 0.35 },
  roundBtnActive: { backgroundColor: T.rose, borderColor: T.mauve },

  trackPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  // Idle pill (was Glass; see comment in TrackingPill). Solid white
  // with a hairline border to read clearly against the cream root.
  trackPillIdle: {
    backgroundColor: S.surfaceElevated,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: T.line,
  },
  trackPillOn: {
    backgroundColor: S.surfaceBrand,
    borderRadius: R.pill,
    shadowColor: T.mauveDeep, shadowOpacity: 0.22,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  trackPillTxt:  { fontSize: 13, fontFamily: F.bold, color: S.textBrand, letterSpacing: 0.2 },
  trackPillTxtOn:{ color: S.textOnBrand },

  // ── Spotlight ──
  spotlightWrap: {
    marginHorizontal: 14, marginBottom: 8,
  },
  spotlight: {
    shadowColor: T.ink, shadowOpacity: 0.05,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  spotInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
  },
  spotSwatch: {
    width: 52, height: 52, borderRadius: R.medium,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  spotSwatchSym: { fontSize: 22, fontFamily: F.bold },
  spotInfo: { flex: 1, gap: 4 },
  spotInfoTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  spotCode: { fontSize: 15, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.1 },
  spotPct:  { fontSize: 14, fontFamily: F.bold, color: S.textBrand },
  spotName: { fontSize: 11, fontFamily: F.regular, color: S.textSecondary, lineHeight: 16 },
  spotBarTrack: {
    height: 4, backgroundColor: T.lineSoft, borderRadius: R.hairline, overflow: 'hidden', marginTop: 2,
  },
  spotBarFill: { height: '100%', backgroundColor: T.mauve, borderRadius: R.hairline },
  spotMeta: { fontSize: 10, fontFamily: F.semibold, color: S.textTertiary, marginTop: 2 },
  spotClose: {
    width: 28, height: 28, borderRadius: R.small,
    backgroundColor: S.surfaceSunken,
    alignItems: 'center', justifyContent: 'center',
  },
  // Action row sits at the bottom of the spotlight Glass — the row owns
  // the top divider so individual buttons stay un-bordered. Both buttons
  // are flex: 1 so they evenly split the card width; the inner edge is
  // a hairline separator.
  spotActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  spotActionFocus: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: S.surfaceSunken,
    borderRightWidth: 1,
    borderRightColor: T.line,
  },
  spotActionFocusOn: {
    backgroundColor: S.surfaceAccent,
  },
  spotActionFocusTxt: {
    fontSize: 13, fontFamily: F.semibold,
    color: S.textBrand, letterSpacing: 0.1,
  },
  spotActionFocusTxtOn: {
    fontFamily: F.bold,
  },
  spotActionMainPrimary: {
    flex: 1,
    backgroundColor: S.surfaceBrand,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  spotActionMainGhost: {
    flex: 1,
    backgroundColor: S.surfaceSunken,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  spotActionPrimaryTxt: { fontSize: 13, fontFamily: F.bold, color: S.textOnBrand, letterSpacing: 0.3 },
  spotActionGhostTxt: { fontSize: 13, fontFamily: F.semibold, color: S.textSecondary },

  // ── Color circles strip ──
  colorsBar: {
    // Glass wrapper, no solid bg here
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
    shadowColor: T.mauveDeep, shadowOpacity: 0.25,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  chipSymbolWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  chipSymbol: { fontSize: 20, fontFamily: F.bold },
  chipDoneCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  chipDoneCheckTxt: { fontSize: 13, fontFamily: F.bold, color: T.successTx, lineHeight: 14 },
  chipCode: { fontSize: 10, fontFamily: F.semibold, color: S.textSecondary, letterSpacing: 0.3 },
  chipCodeOn: { color: S.textBrand },

  // ── "Tümü" chip (opens palette modal) ──
  allChipRing: {
    backgroundColor: S.surfaceAccent,
    borderWidth: 1,
    borderColor: T.line,
  },
  allChipCode: {
    color: S.textBrand,
    fontFamily: F.bold,
  },

  // ── Palette modal ──
  paletteBackdropWrap: {
    flex: 1,
    backgroundColor: S.glassOverlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  paletteScroll: {
    maxHeight: '82%',
    flexGrow: 0,
  },
  paletteContent: {
    // ColorLegend brings its own Glass card; nothing extra needed here.
  },
});
