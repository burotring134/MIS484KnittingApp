import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, StatusBar, Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SPRING, TYPO, DIFFICULTIES } from '../utils/theme';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';
import ErrorBanner from '../components/ErrorBanner';

// Hick's law in action — three grouped options, never a free numeric input.
// Each option is a glass tile so the user can read the AI-friendly meta
// (grid + colours) without it competing visually with the label.
//
// `suggested` is the difficulty id the caller thinks is the best fit for
// the current photo (defaults to 'medium'). `suggestedReason` is the
// short human-readable basis for that pick (e.g. "Karesel ve yüksek
// çözünürlüklü") — required so the badge isn't an unfounded AI claim;
// when null, the badge renders without an explanation line.
//
// `error` (optional) is a `{title, message, retry?}` triple set by the
// parent when the previous generate() attempt failed; rendered as an
// inline ErrorBanner below the top bar. `onDismissError` clears it.
export default function DifficultyScreen({
  previewUri,
  suggested = 'medium',
  suggestedReason = null,
  error,
  onDismissError,
  onBack,
  onPick,
}) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const y    = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fade, { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(y,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 14),
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <SpringIconBtn onPress={onBack}>
          <ChevronLeftIcon/>
        </SpringIconBtn>
        <Text style={styles.topTitle}>Zorluk Seç</Text>
        <View style={styles.topBarSpacer}/>
      </View>

      {/* Inline error from the previous generate() — slides down on
          mount. Retry re-fires the same generate(difficultyId) the
          parent stashed, after clearing the banner. */}
      {error && (
        <View style={styles.errorWrap}>
          <ErrorBanner
            title={error.title}
            message={error.message}
            onRetry={error.retry ? () => {
              onDismissError?.();
              error.retry();
            } : undefined}
            onDismiss={onDismissError}
          />
        </View>
      )}

      {previewUri && (
        <View style={styles.previewWrap}>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover"/>
          <View style={styles.previewShade}/>
        </View>
      )}

      <Animated.View style={[styles.body, { opacity: fade, transform: [{ translateY: y }] }]}>
        <Text style={styles.heading}>Bu fotoğraf için ne kadar detay istiyorsun?</Text>
        <Text style={styles.sub}>AI onu seçtiğin seviyeye göre işler</Text>

        <View style={styles.options}>
          {DIFFICULTIES.map((d, i) => {
            const isSuggested = d.id === suggested;
            return (
              <SpringPressable key={d.id} onPress={() => { haptics.selection(); onPick(d.id); }} delay={i * 50}>
                <Glass tone="light" radius={R.expressive} intensity={45} style={styles.option}>
                  <View style={[styles.optionSwatch, { backgroundColor: d.tint }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionKicker}>{d.kicker}</Text>
                    <Text style={styles.optionLabel}>{d.label}</Text>
                    <Text style={styles.optionDesc}>{d.desc}</Text>
                    <Text style={styles.optionMeta}>{d.gridSize} cell · {d.numColors} renk</Text>
                    {isSuggested && suggestedReason && (
                      <Text style={styles.suggestionReason}>— {suggestedReason}</Text>
                    )}
                  </View>
                  <Text style={styles.optionChevron}>›</Text>
                </Glass>
                {isSuggested && <AISuggestionBadge/>}
              </SpringPressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

// AI-recommendation pill — sits absolutely on the suggested tile, juts
// slightly above the top edge so it reads as a sticker.
//
// Important: Glass.js routes any style props it doesn't recognise as
// "outer layout" (width/height/margin/alignSelf/flex) into the *inner*
// content view — including `position`/`top`/`right`. If we put the
// absolute position directly on Glass, its outer wrap stays in normal
// flow, ends up with zero in-flow children (BlurView + tint are
// absoluteFill), and collapses to 0 px. The badge then takes a flow
// slot inside SpringPressable's column-flex Animated.View, which
// pushes the column into `stretch` mode and squeezes the sibling
// tile's text column to nothing. Wrapping Glass in a plain absolute
// View keeps the badge fully out of flow and lets Glass live with its
// normal in-flow content view.
function AISuggestionBadge() {
  return (
    <View style={styles.aiBadgeAnchor} pointerEvents="none">
      <Glass tone="mauve" radius={R.pill} intensity={45} style={styles.aiBadgePill}>
        <View style={styles.aiBadgeDot}/>
        <Text style={styles.aiBadgeTxt}>AI ÖNERİSİ</Text>
      </Glass>
    </View>
  );
}

function SpringPressable({ children, onPress, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.97 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </TouchableOpacity>
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
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  topBarSpacer: { width: 40 },

  errorWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  previewWrap: {
    marginHorizontal: 20,
    height: 180,
    borderRadius: R.expressive,
    overflow: 'hidden',
    backgroundColor: S.surfaceSunken,
  },
  preview: { width: '100%', height: '100%' },
  previewShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R.expressive,
    borderWidth: 1,
    borderColor: S.glassStrokeDark,
  },

  body: { paddingHorizontal: 20, paddingTop: 22, flex: 1 },
  heading: { fontSize: 22, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.4, lineHeight: 30 },
  sub: { fontSize: 13, fontFamily: F.regular, color: S.textSecondary, marginTop: 4, lineHeight: 20 },

  options: { marginTop: 22, gap: 12 },
  // minHeight is the load-bearing prop here. Glass.js's content view
  // has `flex: 1`, which in an indefinitely-tall wrap collapses the
  // intrinsic height of nested column-flex Text children to ~0. With a
  // definite minHeight on the wrap (minHeight passes through Glass.js's
  // outer destructure), the content view inherits a real vertical
  // budget and the middle text column can render its full 4 lines.
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    minHeight: 120,
  },
  optionSwatch: { width: 44, height: 44, borderRadius: R.medium },
  optionKicker: {
    ...TYPO.kickerMd,
    color: S.textBrand,
    marginBottom: 2,
  },
  optionLabel:  { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  optionDesc:   { fontSize: 12, fontFamily: F.regular, color: S.textSecondary, marginTop: 2, lineHeight: 18 },
  optionMeta:   { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary, marginTop: 6, letterSpacing: 0.3 },
  // Audit line for the suggested tile — paired with the AI badge, this
  // is the short string that explains *why* the heuristic picked this
  // difficulty (e.g. "Karesel ve yüksek çözünürlüklü"). Brand-coloured
  // so it reads as connected to the badge, not as a fourth meta line.
  suggestionReason: {
    fontSize: 11,
    fontFamily: F.semibold,
    color: S.textBrand,
    marginTop: 6,
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  optionChevron:{ fontSize: 24, color: S.textTertiary },

  // ── AI badge ──
  // Anchor View carries position + shadow (shadow on the outer wrap so
  // Glass's overflow:hidden can't clip it).
  aiBadgeAnchor: {
    position: 'absolute',
    top: -8,
    right: 14,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // Glass pill — pure inner layout, no positioning.
  aiBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiBadgeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: T.mauveDeep,
  },
  aiBadgeTxt: {
    fontSize: 10,
    fontFamily: F.bold,
    color: S.textBrand,
    letterSpacing: 1.5,
  },
});
