import { useEffect, useState, useRef, memo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, Animated, RefreshControl,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SP, SPRING, TYPO, DIFFICULTIES } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { API_BASE } from '../config';
import { saveProject, getFavorites, toggleFavorite } from '../utils/storage';
import { friendlyError } from '../utils/errors';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';
import ErrorBanner from '../components/ErrorBanner';
import Snackbar from '../components/Snackbar';

// Resolve difficulty -> { tint, label } from the canonical DIFFICULTIES
// array in theme.js. The chip's background uses `tint` directly so the
// collection visually echoes the difficulty selector on DifficultyScreen.
function diffFromId(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

// ─── TemplateThumb ──────────────────────────────────────────────────────────
// SVG mini-chart of the template's grid. Sizes itself to fill its parent
// (the square thumb wrapper); cells are non-uniformly stretched
// (`preserveAspectRatio="none"`) so the chart fills the card's preview
// slot even when the source grid is slightly off-square (e.g. 13×12).
// Cells are merged per-colour into one Path so even a 60×60 grid renders
// as ~k Path nodes, not 3600 Rects.
//
// Grid lines come in only when the source grid is coarse enough for them
// to read (max-dim ≤ 30) — denser charts would smear the strokes into a
// wash and obscure the colour data. Stroke is a near-invisible hairline
// (`S.glassStrokeDark`) so it never competes with the colour.
const TemplateThumb = memo(function TemplateThumb({ grid, palette }) {
  if (!grid || !palette || grid.length === 0) return null;
  const h = grid.length;
  const w = grid[0].length;

  // Build one Path per palette entry — cheaper than emitting w*h Rects.
  const byColor = new Map();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cid = grid[r][c];
      let parts = byColor.get(cid);
      if (!parts) { parts = []; byColor.set(cid, parts); }
      parts.push(`M${c} ${r}h1v1h-1z`);
    }
  }

  const items = [];
  for (const [cid, parts] of byColor) {
    const color = palette[cid];
    items.push(
      <Path key={`tp-${cid}`} d={parts.join('')} fill={color?.dmcHex || S.surfaceElevated}/>
    );
  }

  // Grid-line visibility is decided on grid coarseness, not absolute
  // pixel size: a 13×12 template gets crisp hairlines, a 60×60 stays
  // clean. strokeWidth is in viewBox units so it scales down naturally
  // with cell size — looks like a true 0.5 px hairline on the device.
  const showGrid = Math.max(w, h) <= 30;
  if (showGrid) {
    const lines = [];
    for (let i = 1; i < h; i++) lines.push(`M0 ${i}H${w}`);
    for (let i = 1; i < w; i++) lines.push(`M${i} 0V${h}`);
    items.push(
      <Path
        key="grid"
        d={lines.join(' ')}
        stroke={S.glassStrokeDark}
        strokeWidth={0.04}
        fill="none"
      />
    );
  }

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {/* Background fill so any unmapped cell ('0') reads as paper, not
          transparent. Same role as `.flatten()` in the backend pipeline. */}
      <Rect x="0" y="0" width={w} height={h} fill={S.surfaceElevated}/>
      {items}
    </Svg>
  );
});

// ─── PaletteDots ────────────────────────────────────────────────────────────
// First 5 palette colours as small circles under the card title. We
// intentionally cap at 5 (not 6 like the legacy swatch row) because at
// 2-column card widths the row would crowd against the heart and the
// rightmost dot would clip into the favourite button's hit area.
function PaletteDots({ palette, max = 5 }) {
  if (!palette || palette.length === 0) return null;
  const visible = palette.slice(0, max);
  const overflow = palette.length - visible.length;

  return (
    <View style={styles.dotsRow}>
      {visible.map((c, i) => (
        <View
          key={i}
          style={[styles.dot, { backgroundColor: c.dmcHex || S.surfaceElevated }]}
        />
      ))}
      {overflow > 0 && (
        <Text style={styles.dotsMore}>+{overflow}</Text>
      )}
    </View>
  );
}

export default function CollectionScreen({ onBack, onAdded }) {
  // Three columns on iPad (≥600pt wide), two on phones. The grid uses
  // flex-wrap on flexBasis, so changing the basis is enough — no
  // re-mount, no FlatList trick.
  const winWidth = useWindowDimensions().width;
  const gridCols = winWidth >= 600 ? 3 : 2;
  const { strings } = useLanguage();
  // Built per-render from live strings so a language switch updates the
  // section header chips. Cheap — three property reads.
  const DIFF_LABEL = {
    easy:   strings.diffEasyShort,
    medium: strings.diffMediumShort,
    hard:   strings.diffHardShort,
  };
  const insets = useSafeAreaInsets();
  const [list, setList]         = useState(null);
  const [error, setError]       = useState(null);
  const [adding, setAdding]     = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [tab, setTab]           = useState('all'); // 'all' | 'fav'
  const [refreshing, setRefreshing] = useState(false);
  // Non-blocking success toast after addToWorkshop. `null` when idle,
  // truthy while the Snackbar is on screen. Auto-dismisses in 4 s so
  // the user can keep browsing without an extra tap; tapping the
  // action jumps to the workshop.
  const [savedToast, setSavedToast] = useState(false);

  // Fetches templates + favorites once. Extracted into a callable so
  // both initial mount and the retry button on the ErrorBanner can
  // re-use the same path. Returns nothing — state updates do the work.
  const loadTemplates = async () => {
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/templates`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setList(data);
      setFavorites(await getFavorites());
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  useEffect(() => {
    let off = false;
    fetch(`${API_BASE}/api/templates`)
      .then((r) => r.json())
      .then((data) => { if (!off) setList(data); })
      .catch((err) => { if (!off) setError(friendlyError(err)); });
    getFavorites().then((favs) => { if (!off) setFavorites(favs); });
    return () => { off = true; };
  }, []);

  // Pull-to-refresh — drops the cached list so the loader state shows
  // while the templates + favorites round trip is in flight. Errors
  // surface to the ErrorBanner rather than crashing the spinner.
  const handleRefresh = async () => {
    setRefreshing(true);
    setList(null);
    try {
      await loadTemplates();
    } finally {
      setRefreshing(false);
    }
  };

  // Optimistic toggle — UI flips immediately, storage syncs in the
  // background. AsyncStorage write failures are non-fatal (the next
  // launch just rehydrates whatever was last persisted).
  const handleToggleFav = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleFavorite(id).catch(() => {});
  };

  const addToWorkshop = async (tpl) => {
    setAdding(tpl.id);
    try {
      const resp = await fetch(`${API_BASE}/api/templates/${tpl.id}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const full = await resp.json();
      await saveProject({
        name:         strings.templateName(full.id ?? tpl.id, full.name),
        source:       'template',
        difficulty:   full.difficulty,
        width:        full.width,
        height:       full.height,
        grid:         full.grid,
        colors:       full.colors,
        completed:    {},
        imageDataUri: full.imageDataUri,
      });
      // Inline confirmation instead of a blocking Alert — the user
      // can keep browsing and either tap the action to jump to
      // workshop or wait 4 s for it to fade.
      haptics.success();
      setSavedToast(true);
    } catch (err) {
      Alert.alert(strings.error, err.message);
    } finally {
      setAdding(null);
    }
  };

  const visible = list
    ? (tab === 'fav' ? list.filter((t) => favorites.has(t.id)) : list)
    : null;

  const grouped = visible ? {
    easy:   visible.filter((t) => t.difficulty === 'easy'),
    medium: visible.filter((t) => t.difficulty === 'medium'),
    hard:   visible.filter((t) => t.difficulty === 'hard'),
  } : null;

  const favCount = list ? list.filter((t) => favorites.has(t.id)).length : 0;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, SP.md) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <View style={styles.topBar}>
        <SpringIconBtn onPress={onBack}><ChevronLeftIcon/></SpringIconBtn>
        <Text style={styles.topTitle}>{strings.collectionTitle}</Text>
        <View style={styles.topBarSpacer}/>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, SP.lg) + SP.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={T.mauve}
            colors={[T.mauve]}
          />
        }
      >
        <Text style={styles.heading}>{strings.collectionHeading}</Text>
        <Text style={styles.sub}>{strings.collectionSub}</Text>

        <View style={styles.tabsRow}>
          <TabBtn label={strings.collectionTabAll} active={tab === 'all'} onPress={() => setTab('all')}/>
          <TabBtn label={strings.collectionTabFav(favCount)} active={tab === 'fav'} onPress={() => setTab('fav')}/>
        </View>

        {error && (
          <View style={styles.errorBannerWrap}>
            <ErrorBanner
              title={error.title}
              message={error.message}
              onRetry={() => { setError(null); loadTemplates(); }}
              onDismiss={() => setError(null)}
            />
          </View>
        )}

        {!list && !error && (
          <View style={styles.loading}>
            <ActivityIndicator color={T.mauve}/>
            <Text style={styles.loadingTxt}>{strings.collectionLoading}</Text>
          </View>
        )}

        {grouped && tab === 'fav' && favCount === 0 && (
          <View style={styles.favEmpty}>
            <Text style={styles.favEmptyTitle}>{strings.collectionFavEmptyTitle}</Text>
            <Text style={styles.favEmptyDesc}>
              {strings.collectionFavEmptyDesc}
            </Text>
          </View>
        )}

        {grouped && ['easy', 'medium', 'hard'].map((diff) => {
          if (grouped[diff].length === 0) return null;
          const d = diffFromId(diff);
          return (
            <View key={diff} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={[styles.diffChip, { backgroundColor: d.tint }]}>
                  <Text style={styles.diffChipTxt}>{DIFF_LABEL[diff]}</Text>
                </View>
                <Text style={styles.sectionCount}>{strings.collectionSectionCount(grouped[diff].length)}</Text>
              </View>

              <View style={styles.cardGrid}>
                {grouped[diff].map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    adding={adding === tpl.id}
                    onAdd={() => addToWorkshop(tpl)}
                    isFavorite={favorites.has(tpl.id)}
                    onToggleFav={() => handleToggleFav(tpl.id)}
                    cols={gridCols}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Success toast after a template is added to the workshop.
          4 s window — action jumps to the workshop, otherwise the
          user stays on this screen and can add more templates. */}
      <Snackbar
        visible={savedToast}
        message={strings.collectionAddedToast}
        actionLabel={strings.collectionGoToWorkshop}
        duration={4000}
        onAction={() => { setSavedToast(false); onAdded?.(); }}
        onDismiss={() => setSavedToast(false)}
      />
    </View>
  );
}

// ─── TemplateCard ───────────────────────────────────────────────────────────
// Two-column card. The preview thumb occupies the full top half of the
// card (square aspect ratio); name + meta + palette dots + CTA stack
// below. The Glass surface gives the Liquid Glass material called for
// in DESIGN.md; the heart sits in the thumb's top-right corner so it
// reads as an action on the preview, not the metadata.
//
// `flexBasis: '48%'` + `gap: SP.md` on the parent gives the 2-col grid
// with a stable 12 px gutter — `flex: 1` on the card would collapse a
// lone trailing card to the full row width, which would mismatch the
// pair above it.
function TemplateCard({ tpl, adding, onAdd, isFavorite, onToggleFav, cols = 2 }) {
  // `flexBasis` shrinks proportionally with column count so the grid
  // tiles still fill the row exactly once the wrap kicks in. 48% for
  // two columns leaves a 4% gutter; 31% for three columns leaves the
  // same proportional gutter.
  const basisPct = cols >= 3 ? '31%' : '48%';
  const { strings } = useLanguage();
  const scale = useRef(new Animated.Value(1)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(SP.sm)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fade,   { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(enterY, { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  // Tiny bounce on the heart when toggled — gives the favourite gesture
  // a "click" without a sound. Two-step spring (compress → bounce) keeps
  // the motion crisp; SPRING.snappy pulls it down, SPRING.bouncy lifts.
  const onHeartPress = () => {
    Animated.sequence([
      Animated.spring(heartScale, { ...SPRING.snappy, toValue: 0.85 }),
      Animated.spring(heartScale, { ...SPRING.bouncy, toValue: 1 }),
    ]).start();
    onToggleFav?.();
  };

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { flexBasis: basisPct },
        { opacity: fade, transform: [{ scale }, { translateY: enterY }] },
      ]}
    >
      <Glass tone="light" radius={R.expressive} intensity={45} style={styles.card}>
        {/* ── Preview thumb ───────────────────────────────────────────
            Wrapped in a View with explicit top-corner radii so the SVG
            stays clipped to the card's upper edge while leaving the
            content area below sharp/flat — gives the "image card" feel
            without paying for an extra mask layer. */}
        <View style={styles.thumbWrap}>
          <TemplateThumb grid={tpl.grid} palette={tpl.palette}/>

          {/* Heart sits absolute inside the thumb so it floats over the
              preview rather than the metadata block. hitSlop expands the
              tap target beyond the visible glyph (Fitts: tiny icon, big
              effective hit area). */}
          <TouchableOpacity
            onPress={onHeartPress}
            hitSlop={10}
            activeOpacity={0.7}
            style={styles.heartBtn}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? strings.collectionFavRemoveLabel : strings.collectionFavAddLabel}
          >
            <Animated.View style={[styles.heartBg, { transform: [{ scale: heartScale }] }]}>
              <HeartIcon filled={isFavorite}/>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* ── Metadata + CTA ──────────────────────────────────────── */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {strings.templateName(tpl.id, tpl.name)}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {tpl.width}×{tpl.height} · {tpl.colors} renk
          </Text>

          <PaletteDots palette={tpl.palette}/>

          <TouchableOpacity
            onPress={onAdd}
            disabled={adding}
            activeOpacity={1}
            onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.98 }).start()}
            onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
          >
            <View style={styles.addBtn}>
              {adding
                ? <ActivityIndicator size="small" color="#fff"/>
                : <Text style={styles.addBtnTxt}>{strings.collectionAddBtn}</Text>}
            </View>
          </TouchableOpacity>
        </View>
      </Glass>
    </Animated.View>
  );
}

function TabBtn({ label, active, onPress }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabTxt, styles.tabTxtActive]}>{label}</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Glass tone="light" radius={R.pill} intensity={30} style={styles.tab}>
        <Text style={styles.tabTxt}>{label}</Text>
      </Glass>
    </TouchableOpacity>
  );
}

function HeartIcon({ filled, size = 18 }) {
  // Feather-style heart — same line-weight + corner family as the rest
  // of the icon set. Filled uses brand mauve; outline drops to inkSoft
  // so it reads as "available action" not "active state".
  const d = "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        fill={filled ? T.mauve : 'none'}
        stroke={filled ? T.mauve : T.inkSoft}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SpringIconBtn({ children, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.92 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Glass tone="light" radius={R.medium} intensity={40} style={styles.iconBtn}>
          {children}
        </Glass>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ChevronLeftIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.surfacePrimary },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.md,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  topBarSpacer: { width: 40 },

  scroll: { padding: SP.lg, paddingTop: SP.xs },
  heading: { fontSize: 26, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.6 },
  sub:     { fontSize: 13, fontFamily: F.regular, color: S.textSecondary, marginTop: SP.xs, marginBottom: SP.lg, lineHeight: 20 },

  errorBannerWrap: { marginBottom: SP.md },

  loading: { paddingVertical: 40, alignItems: 'center', gap: SP.md },
  loadingTxt: { fontSize: 13, fontFamily: F.regular, color: S.textSecondary },

  section: { marginBottom: SP.sectionGap },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SP.md,
  },
  // Difficulty chip — tint from DIFFICULTIES[].tint, label uses kickerSm
  // so it lands as a compact upper-case eyebrow rather than competing
  // with the section heading.
  diffChip: {
    paddingHorizontal: SP.md,
    paddingVertical: 5,
    borderRadius: R.pill,
  },
  diffChipTxt: {
    ...TYPO.kickerSm,
    color: S.textPrimary,
  },
  sectionCount: { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary },

  // ── Two-column card grid ────────────────────────────────────────
  // `flexWrap: 'wrap'` with explicit `gap` and a `flexBasis: '48%'`
  // child gives a stable 2-up layout even when a section has an odd
  // count (a lone trailing card aligns left rather than stretching).
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SP.md,
  },
  cardWrap: {
    flexBasis: '48%',
    flexGrow: 0,
  },
  // Padding 0 so the thumb can flush to the card's top corners. The
  // body block carries its own padding instead.
  //
  // `minHeight` is load-bearing: Glass.js's content view has flex: 1,
  // which in an unconstrained-height parent collapses to 0. With a
  // definite minHeight the content view inherits a real vertical
  // budget so thumb (aspect-ratio: 1) + body render at full size. The
  // value is conservative — actual card grows to fit thumb + content
  // on devices wider than the 320 px floor.
  card: {
    padding: 0,
    overflow: 'hidden',
    minHeight: 280,
    shadowColor: T.ink, shadowOpacity: 0.05, shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },

  // ── Thumb ───────────────────────────────────────────────────────
  // Wraps the SVG so we can clip the top corners to match the card's
  // outer radius while keeping the bottom flat against the metadata
  // block. The SVG inside fills the wrap exactly.
  thumbWrap: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: S.surfaceSunken,
    borderTopLeftRadius: R.expressive,
    borderTopRightRadius: R.expressive,
    position: 'relative',
  },

  // ── Heart ───────────────────────────────────────────────────────
  // Pinned to the thumb's top-right corner. A translucent disc gives
  // the icon a legibility lift against busy preview colours without
  // shouting like a solid background would.
  heartBtn: {
    position: 'absolute',
    top: SP.sm,
    right: SP.sm,
  },
  heartBg: {
    width: 30,
    height: 30,
    borderRadius: R.pill,
    backgroundColor: S.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Card body ───────────────────────────────────────────────────
  cardBody: {
    padding: SP.md,
    gap: SP.xs,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.1,
  },
  cardMeta: {
    fontSize: 11,
    fontFamily: F.regular,
    color: S.textTertiary,
    lineHeight: 16,
  },

  // ── Palette dots ────────────────────────────────────────────────
  // Sits between title/meta and the CTA. The "+N" overflow chip uses
  // the same colour as cardMeta so it reads as quiet supporting info.
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    marginTop: SP.xs,
    marginBottom: SP.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: S.glassStrokeDark,
  },
  dotsMore: {
    fontSize: 10,
    fontFamily: F.semibold,
    color: S.textTertiary,
    marginLeft: 2,
  },

  // ── Add CTA ─────────────────────────────────────────────────────
  addBtn: {
    backgroundColor: S.surfaceBrand,
    paddingVertical: 10,
    borderRadius: R.pill,
    alignItems: 'center',
    shadowColor: T.mauveDeep, shadowOpacity: 0.18,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  addBtnTxt: {
    fontFamily: F.bold,
    color: S.textOnBrand,
    fontSize: 13,
    letterSpacing: 0.2,
  },

  // ── Tabs ──
  tabsRow: {
    flexDirection: 'row',
    gap: SP.sm,
    marginBottom: SP.lg,
  },
  tab: {
    paddingHorizontal: SP.lg,
    paddingVertical: SP.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: S.surfaceBrand,
    borderRadius: R.pill,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabTxt: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
  tabTxtActive: {
    color: S.textOnBrand,
    fontFamily: F.bold,
  },

  // ── Favorite-tab empty state ──
  favEmpty: {
    paddingVertical: 36,
    paddingHorizontal: SP.lg,
    alignItems: 'center',
  },
  favEmptyTitle: {
    fontSize: 16, fontFamily: F.bold,
    color: S.textPrimary, letterSpacing: -0.2,
  },
  favEmptyDesc: {
    fontSize: 13, fontFamily: F.regular,
    color: S.textSecondary, marginTop: SP.xs + 2,
    textAlign: 'center', lineHeight: 20,
  },
});
