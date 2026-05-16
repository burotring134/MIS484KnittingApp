import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Animated, Dimensions, Image,
} from 'react-native';
import Svg, { Circle, Path, Line, Ellipse, Rect, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SPRING, TYPO } from '../utils/theme';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Illustrations ──────────────────────────────────────────────────────────
// All three SVG illustrations use the same palette (rose/mauve/mint/ink) so
// the carousel feels of-a-piece — the composition changes, the colour story
// doesn't. Slide 0 instead uses the brand logo (same asset as the splash)
// so the first impression of the app is its identity, not decoration.

function LogoIllustration({ size = 200 }) {
  return (
    <Image
      source={require('../assets/favicon_logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

function NeedleIllustration({ w = 280, h = 180 }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 260 160">
      <Circle cx="60"  cy="70" r="42" fill={T.rose}   opacity="0.55"/>
      <Circle cx="200" cy="90" r="34" fill={T.mint}   opacity="0.7"/>
      <Circle cx="130" cy="40" r="26" fill={T.mauve}  opacity="0.55"/>
      <Path d="M40 120 C 80 60, 140 40, 190 70 S 250 140, 210 140 S 150 100, 120 120 S 70 150, 40 120 Z"
        stroke={T.mauve} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="1 4"/>
      <G rotation="-28" origin="150, 80">
        <Line x1="80" y1="80" x2="220" y2="80" stroke={T.ink} strokeWidth="2" strokeLinecap="round"/>
        <Ellipse cx="82" cy="80" rx="8" ry="4" stroke={T.ink} strokeWidth="2" fill="#FFFFFF"/>
        <Line x1="84" y1="80" x2="88" y2="80" stroke={T.ink} strokeWidth="1.2"/>
        <Path d="M220 78 L228 80 L220 82 Z" fill={T.ink}/>
      </G>
    </Svg>
  );
}

// Photo → grid metaphor. Left is a soft cluster of overlapping circles
// (the "photo" as the camera sees it). A dashed flow-arrow leads to a
// crisp 4×4 grid on the right (the chart). The transformation is the
// app's whole value prop in one frame.
function AIProcessIllustration({ w = 280, h = 180 }) {
  const cell = 14;
  const gx   = 188;
  const gy   = 56;
  const palette = [T.rose, T.mauve, T.mint, T.creamDeep];
  return (
    <Svg width={w} height={h} viewBox="0 0 280 180">
      {/* Photo blob — soft, overlapping */}
      <Circle cx="74"  cy="86"  r="40" fill={T.rose}      opacity="0.55"/>
      <Circle cx="98"  cy="64"  r="26" fill={T.mauve}     opacity="0.5"/>
      <Circle cx="58"  cy="112" r="22" fill={T.mauveDeep} opacity="0.32"/>
      <Circle cx="86"  cy="104" r="16" fill={T.mint}      opacity="0.7"/>

      {/* Flow arrow */}
      <Path
        d="M130 90 Q 150 70, 170 90 T 198 92"
        stroke={T.mauve} strokeWidth="2.2"
        fill="none" strokeDasharray="2 5" strokeLinecap="round"
      />
      <Path d="M194 87 L202 92 L194 97 Z" fill={T.mauve}/>

      {/* Crisp 4×4 grid */}
      <G>
        {[0,1,2,3].map((r) =>
          [0,1,2,3].map((c) => (
            <Rect
              key={`g-${r}-${c}`}
              x={gx + c * cell}
              y={gy + r * cell}
              width={cell - 1.5}
              height={cell - 1.5}
              rx="2"
              fill={palette[(r * 2 + c * 3) % palette.length]}
            />
          ))
        )}
      </G>

      {/* Atmospheric dots */}
      <Circle cx="148" cy="42"  r="3.5" fill={T.mint}  opacity="0.55"/>
      <Circle cx="170" cy="140" r="3"   fill={T.mauve} opacity="0.45"/>
      <Circle cx="120" cy="138" r="4.5" fill={T.rose}  opacity="0.5"/>
    </Svg>
  );
}

// Tracking metaphor — a mini chart card with a few cells already ticked
// off. Says "your workshop, your progress" without a word of UI copy.
function TrackingIllustration({ w = 280, h = 180 }) {
  const cell  = 14;
  const cardX = 70;
  const cardY = 36;
  const palette = [T.rose, T.mauve, T.mint, T.creamDeep, T.rose, T.mauve];
  const ticked = new Set(['0,0', '0,1', '1,0', '2,2', '3,3']);
  return (
    <Svg width={w} height={h} viewBox="0 0 280 180">
      {/* Soft backdrop */}
      <Circle cx="140" cy="96"  r="68" fill={T.mint}  opacity="0.35"/>
      <Circle cx="56"  cy="140" r="22" fill={T.rose}  opacity="0.5"/>
      <Circle cx="230" cy="48"  r="18" fill={T.mauve} opacity="0.45"/>

      {/* Card */}
      <Rect
        x={cardX} y={cardY}
        width="140" height="108"
        rx="12"
        fill="#FFFFFF"
        stroke={T.line} strokeWidth="1.5"
      />

      {/* Mini grid 6×4 */}
      <G>
        {[0,1,2,3].map((r) =>
          [0,1,2,3,4,5].map((c) => {
            const fill = palette[(r + c * 2) % palette.length];
            const opacity = ticked.has(`${r},${c}`) ? 1 : 0.45;
            return (
              <Rect
                key={`tg-${r}-${c}`}
                x={cardX + 12 + c * (cell + 2)}
                y={cardY + 12 + r * (cell + 2)}
                width={cell}
                height={cell}
                rx="2"
                fill={fill}
                opacity={opacity}
              />
            );
          })
        )}
        {/* Tick marks on the ticked cells */}
        {Array.from(ticked).map((k) => {
          const [r, c] = k.split(',').map(Number);
          const x0 = cardX + 12 + c * (cell + 2);
          const y0 = cardY + 12 + r * (cell + 2);
          return (
            <Path
              key={`tk-${k}`}
              d={`M${x0 + 3} ${y0 + 7} L${x0 + 6} ${y0 + 10} L${x0 + 11} ${y0 + 4}`}
              stroke={T.mauveDeep} strokeWidth="2"
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          );
        })}
      </G>
    </Svg>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────
// Three full-screen slides in a paging ScrollView. Swipe and the "Sonraki"
// button both drive the same `scrollX` Animated.Value, so dots and slide
// content stay perfectly in lockstep regardless of input. Non-native driver
// here — we interpolate width/colour on the dots, which the native driver
// can't handle.
export default function WelcomeScreen({ onContinue }) {
  const insets    = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const scrollX   = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  // Initial entrance — gentle spring on the whole carousel, once.
  const mountFade = useRef(new Animated.Value(0)).current;
  const mountY    = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(mountFade, { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(mountY,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  const goNext = () => {
    if (index < 2) {
      scrollRef.current?.scrollTo({ x: (index + 1) * SCREEN_W, animated: true });
    } else {
      onContinue?.();
    }
  };

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <Animated.View
        style={{ flex: 1, opacity: mountFade, transform: [{ translateY: mountY }] }}
      >
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumEnd}
          style={{ flex: 1 }}
        >
          <Slide
            scrollX={scrollX}
            index={0}
            insetsTop={insets.top}
            illustration={<LogoIllustration size={200}/>}
            kicker="AI KANAVIÇE STÜDYOSU"
            title="Threadia'ya hoş geldin"
            subtitle="Anılarını ilmek ilmek ör."
            description="Fotoğraflarından DMC iplikli kanaviçe şemaları üret. Atölyende ilerlemeni takip et, PDF olarak yanında taşı."
          />
          <Slide
            scrollX={scrollX}
            index={1}
            insetsTop={insets.top}
            illustration={<AIProcessIllustration w={280} h={180}/>}
            kicker="ADIM 1 · AI ŞEMA"
            title="Foto ver, şema al"
            subtitle="Kolay, Orta veya Zor"
            description="Bir fotoğraf seç, zorluk seviyesini belirle. AI sana sembollü, kareli ve DMC iplik kodlu kanaviçe şeması çıkarır."
          />
          <Slide
            scrollX={scrollX}
            index={2}
            insetsTop={insets.top}
            illustration={<TrackingIllustration w={280} h={180}/>}
            kicker="ADIM 2 · ATÖLYEN"
            title="Her ilmeği takip et"
            subtitle="Kaldığın yerden devam"
            description="İşlediğin hücreleri tek dokunuşla işaretle, ilerlemeni gör. İstediğin zaman PDF olarak çıkar, paylaş ya da yazdır."
            showChips
          />
        </Animated.ScrollView>
      </Animated.View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 18 }]}>
        <Dots scrollX={scrollX}/>
        <HapticSampleTile scrollX={scrollX} activeOnLast={index === 2}/>
        <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.ctaTxt}>{index === 2 ? 'Başla' : 'Sonraki ›'}</Text>
        </TouchableOpacity>
      </View>

      {/* "Atla" — skip onboarding straight to home. Visible on slides 0
          and 1; on the last slide the primary CTA already says "Başla"
          so a duplicate skip would be noise. Driven by scrollX so the
          fade tracks the swipe mid-gesture, and pointerEvents flips to
          'none' once the user lands on the last slide so the
          invisible button can't catch taps that should pass through. */}
      <Animated.View
        pointerEvents={index >= 2 ? 'none' : 'auto'}
        style={[
          styles.skip,
          { top: insets.top + 14, opacity: scrollX.interpolate({
              inputRange:  [0, SCREEN_W, 2 * SCREEN_W],
              outputRange: [1, 1, 0],
              extrapolate: 'clamp',
            }) },
        ]}
      >
        <TouchableOpacity
          onPress={() => { haptics.tap(); onContinue?.(); }}
          hitSlop={12}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Tanıtımı atla"
        >
          <Text style={styles.skipTxt}>Atla</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// One slide — interpolates translateY + scale from `scrollX` so the
// content lifts and zooms into place as the slide centres in the
// viewport. No opacity: cross-fading both neighbours mid-swipe made
// the carousel feel hazy. With scale + translateY only, the leaving
// slide pulls away cleanly while the incoming one snaps in crisp.
function Slide({ scrollX, index, insetsTop, illustration, kicker, title, subtitle, description, showChips }) {
  const inputRange = [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W];
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [30, 0, 30],
    extrapolate: 'clamp',
  });
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.slide, { paddingTop: Math.max(insetsTop, 40) + 8 }]}>
      <Animated.View style={[styles.slideInner, { transform: [{ translateY }, { scale }] }]}>
        <View style={styles.hero}>{illustration}</View>
        <View style={styles.body}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.description}>{description}</Text>
          {showChips && (
            <View style={styles.chipsRow}>
              {['AI Destekli', 'Gerçek DMC', 'PDF Çıktı', 'Takip Modu'].map((chip) => (
                <Glass key={chip} tone="light" radius={R.pill} style={styles.chip} intensity={30}>
                  <Text style={styles.chipTxt}>{chip}</Text>
                </Glass>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// Tactile preview pill — sits above the "Başla" CTA on the last slide and
// invites a single tap. The fire path is `haptics.success()`, then a swap
// of the label to a confirmation line, then a 1.5 s revert. The goal is
// to introduce haptic feedback as part of Threadia's signature *before*
// the user reaches Settings. Older-phone users tend to disable haptics
// without knowing what they are; here we let them feel it once and tie
// the sensation to the act of stitching.
//
// `scrollX` drives an opacity fade tied to the carousel position so the
// tile only materialises during the second half of the swipe into the
// final slide. `activeOnLast` gates taps so the invisible button can't
// fire while the user is on an earlier slide.
function HapticSampleTile({ scrollX, activeOnLast }) {
  const [activated, setActivated] = useState(false);
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activated) return;
    haptics.success();
    Animated.sequence([
      Animated.spring(press, { ...SPRING.snappy, toValue: 1.04 }),
      Animated.spring(press, { ...SPRING.snappy, toValue: 1 }),
    ]).start();
    const t = setTimeout(() => setActivated(false), 1500);
    return () => clearTimeout(t);
  }, [activated]);

  const opacity = scrollX.interpolate({
    inputRange:  [SCREEN_W, 1.5 * SCREEN_W, 2 * SCREEN_W],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  // Outer view: scrollX-driven opacity (JS driver, because scrollX is
  // bound via Animated.event useNativeDriver:false). Inner view: press
  // spring scale (native driver, from SPRING.snappy). Keeping the two
  // on separate Animated.Views avoids the "node animated by both JS
  // and native driver" invariant.
  //
  // Body is a plain View tinted with the soft-petal token + a hairline
  // border, not a Glass panel — Glass's content view is flex:1, which
  // collapses to 0×0 inside an unconstrained parent and crashed the
  // surrounding `controls` row's render. Soft Petal + border gives the
  // same visual register without the layout trap.
  return (
    <Animated.View
      pointerEvents={activeOnLast ? 'auto' : 'none'}
      style={[styles.hapticWrap, { opacity }]}
    >
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <TouchableOpacity
          onPress={() => { if (!activated) setActivated(true); }}
          activeOpacity={0.85}
          style={styles.hapticTile}
          accessibilityRole="button"
          accessibilityLabel={activated
            ? 'Haptik geri bildirim hissedildi'
            : 'Haptik geri bildirimi denemek için dokun'}
          accessibilityHint="Telefon kısa bir titreşimle yanıt verir"
        >
          <Text
            style={[styles.hapticTxt, activated ? styles.hapticTxtPost : styles.hapticTxtPre]}
            numberOfLines={1}
          >
            {activated ? 'İşlerken her ilmek böyle hissedilir ✓' : 'Dokunarak hisset ›'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// Three dots, active one grows wider and shifts from line → mauve.
// Driven by the same scrollX, so it tracks mid-swipe — not just on snap.
function Dots({ scrollX }) {
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => {
        const inputRange = [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W];
        const width = scrollX.interpolate({
          inputRange,
          outputRange: [8, 26, 8],
          extrapolate: 'clamp',
        });
        const backgroundColor = scrollX.interpolate({
          inputRange,
          outputRange: [T.line, T.mauve, T.line],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={i}
            style={[styles.dot, { width, backgroundColor }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
  },
  slide: {
    width: SCREEN_W,
    flex: 1,
  },
  slideInner: {
    flex: 1,
  },
  hero: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 10,
  },
  kicker: {
    ...TYPO.kickerMd,
    color: S.textBrand,
  },
  title: {
    fontSize: 40,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -1.2,
    lineHeight: 46,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 28,
    marginTop: 2,
  },
  description: {
    fontSize: 15,
    fontFamily: F.regular,
    color: S.textSecondary,
    lineHeight: 24,
    marginTop: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipTxt: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: S.textSecondary,
  },

  // ── Bottom controls ──────────────────────────────────────────────
  controls: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: {
    backgroundColor: S.surfaceBrand,
    paddingVertical: 18,
    borderRadius: R.pill,
    alignItems: 'center',
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  // ── Haptic sample tile ──
  // Sits between dots and the primary CTA. alignSelf: center keeps the
  // pill compact; the body is a plain tinted View with a hairline
  // border — Glass collapses to 0×0 in this slot, see HapticSampleTile.
  hapticWrap: {
    alignSelf: 'center',
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  hapticTile: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: R.pill,
    backgroundColor: S.surfaceAccent,
    borderWidth: 1,
    borderColor: S.glassStrokeDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hapticTxt: {
    fontSize: 13,
    fontFamily: F.semibold,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  hapticTxtPre: {
    color: S.textBrand,
  },
  hapticTxtPost: {
    color: S.textSuccess,
  },
  ctaTxt: {
    color: S.textOnBrand,
    fontSize: 17,
    fontFamily: F.bold,
    letterSpacing: 0.2,
  },

  // ── Skip button ──
  // Absolute, sits over the carousel in the top-right. `top` is set
  // inline so it follows the device's actual safe-area inset.
  skip: {
    position: 'absolute',
    right: 20,
  },
  skipTxt: {
    fontSize: 13,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
});
