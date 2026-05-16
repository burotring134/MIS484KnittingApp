import { useEffect, useRef, useMemo, memo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Polyline } from 'react-native-svg';
import { T, F, S, R, SPRING, TYPO } from '../utils/theme';
import * as haptics from '../utils/haptics';
import Glare from '../components/Glare';

// Time-of-day salute. Bands picked to match how Turkish speakers naturally
// switch greetings (sabah/gündüz/akşam) — not solar noon.
function greetingForHour(h) {
  if (h >= 5 && h < 12)  return 'Günaydın';
  if (h >= 12 && h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

// Feather-style line icons. Stroke colour is parametrised so the icon
// can swap palette without a re-render — used during the rest/press
// crossfade.
function CameraIcon({ color, size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7h3l2-3h8l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"
        stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth="2.1"/>
    </Svg>
  );
}

function GalleryIcon({ color, size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="3"
        stroke={color} strokeWidth="2.1"/>
      <Circle cx="9" cy="9.5" r="1.6" stroke={color} strokeWidth="2.1"/>
      <Polyline points="21 16 16 11 5 21"
        stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </Svg>
  );
}

// HomeScreen — primary photo CTAs on top, discovery tiles below. Sections
// open with letter-spaced kicker labels (smaller than a full H2) so the
// page's only big type is the brand and the tile counts — clear visual
// hierarchy (Tesler: AI app, keep chrome quiet).
export default function HomeScreen({
  projectCount,
  projects = [],
  onTakePhoto,
  onGallery,
  onWorkshop,
  onCollection,
  onOpen,
  onSettings,
  // Bumped by App.js whenever the user lands here via workshop "+".
  // Forwarded to the photo / gallery HeroCards so their Glare bursts
  // once on arrival rather than looping forever.
  glareTrigger,
}) {
  const insets = useSafeAreaInsets();

  // Greeting is computed at mount — the home screen is short-lived in
  // practice, and re-deriving on every render would just churn.
  const salute = useMemo(() => greetingForHour(new Date().getHours()), []);

  // Storage prepends new/edited projects, so the index is effectively
  // recency-sorted; take the first two for the "DEVAM EDEN" strip.
  const recent = projects.slice(0, 2);

  const openProfile = () => onSettings?.();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Math.max(insets.top, 16) + 16,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.salute}>{salute}</Text>
            <Text style={styles.brand}>threadia</Text>
            <Text style={styles.greeting}>Anılarını ilmek ilmek ör.</Text>
          </View>
          <TouchableOpacity
            onPress={openProfile}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Profil"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>T</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Yeni Pattern ────────────────────────────────────────── */}
        <SectionKicker label="YENİ PATTERN" sub="Fotoğrafını AI ile kanaviçeye çevir"/>

        <HeroCard
          Icon={CameraIcon}
          title="Fotoğraf Çek"
          desc="Anlık bir kare yakala"
          variant="primary"
          onPress={onTakePhoto}
          glareTrigger={glareTrigger}
        />
        <HeroCard
          Icon={GalleryIcon}
          title="Galeriden Seç"
          desc="Telefondaki bir fotoğrafı kullan"
          variant="secondary"
          onPress={onGallery}
          glareTrigger={glareTrigger}
        />

        {/* ── Keşfet ──────────────────────────────────────────────── */}
        <View style={styles.discoverGap}/>
        <SectionKicker label="KEŞFET" sub="Atölyen ve hazır koleksiyon"/>

        <View style={styles.row}>
          <DiscoveryTile
            kicker="ATÖLYE"
            count={projectCount}
            label="kayıtlı proje"
            onPress={onWorkshop}
          />
          <DiscoveryTile
            kicker="KOLEKSİYON"
            count={9}
            label="hazır şablon"
            onPress={onCollection}
          />
        </View>

        {/* ── Devam Eden ─────────────────────────────────────────── */}
        {recent.length > 0 && (
          <>
            <View style={styles.discoverGap}/>
            <SectionKicker label="DEVAM EDEN" sub="Kaldığın yerden devam et"/>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {recent.map((p) => (
                <ContinuingCard key={p.id} project={p} onPress={() => onOpen?.(p.id)}/>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Section kicker — letter-spaced small label + subtle subtitle. Saves
// the 20px H2 weight for headings that actually deserve it.
function SectionKicker({ label, sub }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionSub}>{sub}</Text>
    </View>
  );
}

// HeroCard — two layers cross-fade on press. Both variants rest as a
// Soft Petal card, but `primary` carries a Rose Dust icon badge for
// visual emphasis (mini-Fitts: signals "this is the main action").
// The press layer collapses both into the same mauve treatment.
function HeroCard({ Icon, title, desc, variant, onPress, glareTrigger }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    haptics.tap();
    Animated.parallel([
      Animated.spring(scale, { ...SPRING.snappy, toValue: 0.98 }),
      Animated.spring(press, { ...SPRING.snappy, toValue: 1 }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }),
      Animated.spring(press, { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  };

  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.heroBtn}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Resting layer — Soft Petal card. Glare is the first child so
            the diagonal highlight sweep sits on top of the bg fill but
            below icon/text. The sweep is a one-shot triggered by
            `glareTrigger` (bumped when user arrives from workshop "+");
            no continuous loop. radius matches heroCard's borderRadius
            so the sweep stays clipped to the rounded corners. */}
        <View style={[styles.heroCard, styles.heroPetal]}>
          <Glare radius={R.expressive} runKey={glareTrigger}/>
          <View style={[styles.heroIcon, isPrimary ? styles.heroIconPrimary : styles.heroIconSecondary]}>
            <Icon color={isPrimary ? S.textOnBrand : T.mauveDeep} size={28}/>
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitleDark}>{title}</Text>
            <Text style={styles.heroDescDark}>{desc}</Text>
          </View>
          <Text style={styles.heroChevronDark}>›</Text>
        </View>

        {/* Pressed layer — solid Rose Dust */}
        <Animated.View pointerEvents="none" style={[styles.heroOverlay, { opacity: press }]}>
          <View style={[styles.heroCard, styles.heroMauve]}>
            <View style={[styles.heroIcon, styles.heroIconPressed]}>
              <Icon color="#fff" size={28}/>
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroDesc}>{desc}</Text>
            </View>
            <Text style={styles.heroChevron}>›</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// DiscoveryTile — sage-tinted action tile. Count-forward layout: the big
// number is the affordance, the kicker is context, the label is the unit.
function DiscoveryTile({ kicker, count, label, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { ...SPRING.snappy, toValue: 0.97 }),
      Animated.spring(press, { ...SPRING.snappy, toValue: 1 }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }),
      Animated.spring(press, { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ width: '100%', transform: [{ scale }] }}>
        <View style={[styles.tile, styles.tileSage]}>
          <Text style={styles.tileKicker}>{kicker}</Text>
          <View style={{ flex: 1 }}/>
          <Text style={styles.tileCount}>{count}</Text>
          <Text style={styles.tileLabel}>{label}</Text>
        </View>
        <Animated.View pointerEvents="none" style={[styles.tileOverlay, { opacity: press }]}>
          <View style={[styles.tile, styles.tileSageDeep]}>
            <Text style={styles.tileKicker}>{kicker}</Text>
            <View style={{ flex: 1 }}/>
            <Text style={styles.tileCount}>{count}</Text>
            <Text style={styles.tileLabel}>{label}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// PatternThumb — Mini chart, either the cached raster or an inline SVG
// rebuilt from the project grid. Same approach as WorkshopScreen's Mini;
// duplicated locally so HomeScreen can stay self-contained.
const PatternThumb = memo(function PatternThumb({ pattern, size }) {
  if (pattern.imageDataUri) {
    return (
      <Image
        source={{ uri: pattern.imageDataUri }}
        style={{ width: size, height: size }}
        resizeMode="stretch"
      />
    );
  }
  const cw = size / Math.max(pattern.width, pattern.height);
  const byColor = new Map();
  for (let r = 0; r < pattern.height; r++) {
    for (let c = 0; c < pattern.width; c++) {
      const cid = pattern.grid[r][c];
      let parts = byColor.get(cid);
      if (!parts) { parts = []; byColor.set(cid, parts); }
      parts.push(`M${c * cw} ${r * cw}h${cw}v${cw}h-${cw}z`);
    }
  }
  const items = [];
  for (const [cid, parts] of byColor) {
    const color = pattern.colors[cid];
    items.push(
      <Path key={`mp-${cid}`} d={parts.join('')} fill={color?.dmcHex || '#fff'}/>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {items}
    </Svg>
  );
});

// ContinuingCard — 140×180 horizontal-strip card. Same snappy/bouncy
// press physics as HeroCard so the home page feels of-a-piece.
function ContinuingCard({ project, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const done  = project.completed ? Object.keys(project.completed).length : 0;
  const total = project.width * project.height;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const onPressIn  = () => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.96 }).start();
  const onPressOut = () => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.recentCard, { transform: [{ scale }] }]}>
        <View style={styles.recentThumb}>
          <PatternThumb pattern={project} size={108}/>
        </View>
        <Text style={styles.recentName} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.recentPct}>{pct}%</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.surfacePrimary },
  scroll: {
    paddingHorizontal: 20,
  },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  salute: {
    fontSize: 11,
    fontFamily: F.bold,
    color: S.textBrand,
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  brand: {
    fontSize: 32,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -1,
    lineHeight: 40,
  },
  greeting: {
    fontSize: 14,
    fontFamily: F.regular,
    color: S.textSecondary,
    marginTop: 6,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: R.medium,
    backgroundColor: S.surfaceAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
  avatarTxt: {
    fontSize: 15, fontFamily: F.bold, color: S.textBrand,
  },

  // ── Section kicker ────────────────────────────────────────────
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    ...TYPO.kickerMd,
    color: S.textBrand,
  },
  sectionSub: {
    fontSize: 14,
    fontFamily: F.regular,
    color: S.textPrimary,
    marginTop: 6,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  // ── Hero cards ─────────────────────────────────────────────────
  heroBtn: { marginBottom: 12 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: R.expressive,
  },
  heroPetal: {
    backgroundColor: S.surfaceAccent,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  heroMauve: {
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R.expressive,
    overflow: 'hidden',
  },
  heroIcon: {
    width: 52, height: 52,
    borderRadius: R.medium,
    alignItems: 'center', justifyContent: 'center',
  },
  // Primary action — Rose Dust badge: signals "this is the main CTA"
  heroIconPrimary:   { backgroundColor: S.surfaceBrand },
  // Secondary action — white badge: subtle, supporting
  heroIconSecondary: { backgroundColor: S.surfaceElevated },
  // Pressed (card already mauve) — translucent white badge
  heroIconPressed:   { backgroundColor: 'rgba(255,255,255,0.22)' },

  heroBody: { flex: 1, gap: 2 },
  heroTitle:    { fontSize: 17, fontFamily: F.bold, color: S.textOnBrand, letterSpacing: -0.2 },
  heroDesc:     { fontSize: 13, fontFamily: F.regular, color: 'rgba(255,255,255,0.88)', lineHeight: 20 },
  heroChevron:  { fontSize: 24, color: 'rgba(255,255,255,0.85)' },

  heroTitleDark:   { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  heroDescDark:    { fontSize: 13, fontFamily: F.regular, color: T.mauveDeep, lineHeight: 20 },
  heroChevronDark: { fontSize: 24, color: T.mauveDeep },

  // ── Discover ───────────────────────────────────────────────────
  discoverGap: { height: 28 },
  row: { flexDirection: 'row', gap: 12 },
  tile: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 150,
    borderRadius: R.expressive,
    overflow: 'hidden',
  },
  tileSage: {
    backgroundColor: S.surfaceSuccess,
    shadowColor: T.successTx,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  tileSageDeep: {
    backgroundColor: T.successTx,
  },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R.expressive,
    overflow: 'hidden',
  },
  tileKicker: {
    fontSize: 10, letterSpacing: 1.8,
    fontFamily: F.bold, color: S.textSuccess,
  },
  tileCount: {
    fontSize: 38, fontFamily: F.bold,
    color: S.textPrimary, letterSpacing: -1.8,
    lineHeight: 44,
  },
  tileLabel: {
    fontSize: 12, fontFamily: F.regular,
    color: T.ink, opacity: 0.7,
    marginTop: 2, lineHeight: 18, letterSpacing: 0.1,
  },

  // ── Devam Eden ────────────────────────────────────────────────
  // Negative-margin lets the strip bleed past the ScrollView's 20px
  // gutter so the first card sits flush with the column edge.
  recentScroll: {
    paddingRight: 20,
    paddingLeft: 0,
    gap: 12,
  },
  recentCard: {
    width: 140,
    height: 180,
    borderRadius: R.expressive,
    backgroundColor: S.surfaceElevated,
    padding: 12,
    shadowColor: T.ink,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  recentThumb: {
    width: 116,
    height: 116,
    borderRadius: R.medium,
    overflow: 'hidden',
    backgroundColor: S.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.lineSoft,
    marginBottom: 10,
  },
  recentName: {
    fontSize: 13,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.1,
  },
  recentPct: {
    fontSize: 11,
    fontFamily: F.bold,
    color: S.textBrand,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
