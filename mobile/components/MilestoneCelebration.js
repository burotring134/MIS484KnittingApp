import { useEffect, useRef } from 'react';
import {
  View, Text, Modal, StyleSheet, Animated, Pressable,
} from 'react-native';
import Svg, { Circle, Path, Rect, Line, G } from 'react-native-svg';
import { T, F, S, R, SP, SPRING, TYPO } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import Glass from './Glass';
import * as haptics from '../utils/haptics';

// react-native-svg lets us animate stroke* attributes via the Animated
// API. Only JS driver (useNativeDriver:false) — SVG attributes aren't
// transform/opacity so native driver can't reach them.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// How long the celebration sits on screen before auto-dismissing. The
// countdown pie depletes over this same duration so the user can see
// the dismissal coming. 6 s leaves room for the user to actually read
// the 100% body (which carries the framing instructions).
const AUTO_DISMISS_MS = 6000;

// Countdown pie geometry. r=7 + strokeWidth=14 means the stroke fills
// from the center (r=0) out to r=14, painting a solid disc that erodes
// as the dashoffset grows — that's what gives the "depleting pie"
// shape, vs. a hollow progress ring.
const PIE_R       = 7;
const PIE_STROKE  = 14;
const PIE_CIRC    = 2 * Math.PI * PIE_R;
const PIE_BOX     = 36;  // viewBox / rendered size; r + strokeWidth/2 + a hair

// ─── Copy table ──────────────────────────────────────────────────────────
// One entry per threshold. `kicker` is the small uppercase eyebrow so the
// surface always reads as "you reached a checkpoint" before the headline
// lands. `title` and `body` come straight from the spec.
//
// Built per-render from the live `strings` (via useLanguage) instead of
// a module-level snapshot so a language switch mid-session swaps the
// copy without a reload. The Illo refs stay stable since they're plain
// components.
function buildMilestones(strings) {
  return {
    25:  { kicker: strings.milestone25Kicker,  title: strings.milestone25Title,  body: strings.milestone25Body,  Illo: QuarterIllo },
    50:  { kicker: strings.milestone50Kicker,  title: strings.milestone50Title,  body: strings.milestone50Body,  Illo: HalfIllo },
    75:  { kicker: strings.milestone75Kicker,  title: strings.milestone75Title,  body: strings.milestone75Body,  Illo: ThreeQuarterIllo },
    100: { kicker: strings.milestone100Kicker, title: strings.milestone100Title, body: strings.milestone100Body, Illo: CompleteIllo },
  };
}

// ─── Component ───────────────────────────────────────────────────────────
// Full-screen scrim + centered glass card. Mounts only while `threshold`
// is non-null — the parent owns the timing (when the project crosses a
// new band) and the dismiss callback. The card animates in on mount with
// a gentle spring; auto-dismisses after AUTO_DISMISS_MS via a smooth
// fade-out. A countdown pie in the top-right depletes over the same
// window so the user sees the dismissal coming and isn't surprised.
//
// Tapping the scrim closes early — the user can dismiss faster than the
// timer if they've already read the card.
export default function MilestoneCelebration({ threshold, onClose }) {
  const { strings } = useLanguage();
  const MILESTONES = buildMilestones(strings);
  const entry = threshold != null ? MILESTONES[threshold] : null;

  // Independent animated values:
  //  - opacity → JS driver, drives backdrop fade in + out.
  //  - scale / lift → native driver, drives card entry spring.
  //  - pie → JS driver (SVG strokeDashoffset isn't reachable from native).
  // Splitting JS and native drivers across separate Animated.Views avoids
  // the same crash that bit Welcome's haptic tile.
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.92)).current;
  const lift    = useRef(new Animated.Value(18)).current;
  const pie     = useRef(new Animated.Value(0)).current;

  // Refs let the cleanup path cancel both timers cleanly. Without them a
  // user tapping the scrim mid-countdown would still get the auto-close
  // fire a moment later, which can race with onClose() and re-open the
  // sheet on the parent.
  const dismissTimerRef = useRef(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (threshold == null) return;
    closedRef.current = false;
    opacity.setValue(0);
    scale.setValue(0.92);
    lift.setValue(18);
    pie.setValue(0);
    haptics.success();

    // Entrance — backdrop fades up, card springs in.
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.spring(scale,   { ...SPRING.bouncy, toValue: 1 }),
      Animated.spring(lift,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();

    // Countdown pie — linear over the full dwell so the depletion rate
    // matches the visible countdown the user is tracking.
    Animated.timing(pie, {
      toValue: 1,
      duration: AUTO_DISMISS_MS,
      useNativeDriver: false,
    }).start();

    // Auto-dismiss — fade backdrop down, then call onClose so the parent
    // can clear `milestone` state. closedRef guards against early
    // dismissal racing with the timer.
    dismissTimerRef.current = setTimeout(() => {
      if (closedRef.current) return;
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }).start(() => {
        if (closedRef.current) return;
        closedRef.current = true;
        onClose?.();
      });
    }, AUTO_DISMISS_MS);

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [threshold]);

  // Early dismiss — user tapped the scrim. Cancel the pending auto-
  // dismiss, fade out, then call onClose.
  const handleEarlyDismiss = () => {
    if (closedRef.current) return;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      if (closedRef.current) return;
      closedRef.current = true;
      onClose?.();
    });
  };

  if (!entry) return null;
  const Illo = entry.Illo;

  // strokeDashoffset goes 0 → PIE_CIRC as the timer runs, eroding the
  // filled disc into empty. The rotate(-90) on the parent <G> starts
  // the depletion from 12-o'clock, matching what a wall-clock second
  // hand would do.
  const dashOffset = pie.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PIE_CIRC],
  });

  return (
    <Modal
      visible={threshold != null}
      transparent
      animationType="none"
      onRequestClose={handleEarlyDismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleEarlyDismiss} />

        <Animated.View
          style={[
            styles.cardWrap,
            { transform: [{ scale }, { translateY: lift }] },
          ]}
          pointerEvents="box-none"
        >
          <Glass tone="light" radius={R.large} intensity={70} style={styles.card}>
            {/* Countdown pie — top-right corner of the card. The track
                is a thin light circle; the pie wedge sits on top and
                erodes as time passes. Centered inside a 36×36 box. */}
            <View style={styles.pieWrap} pointerEvents="none">
              <Svg width={PIE_BOX} height={PIE_BOX} viewBox={`0 0 ${PIE_BOX} ${PIE_BOX}`}>
                <G rotation="-90" origin={`${PIE_BOX / 2}, ${PIE_BOX / 2}`}>
                  {/* Background track — light cream so the depleting
                      pie reads against it. */}
                  <Circle
                    cx={PIE_BOX / 2}
                    cy={PIE_BOX / 2}
                    r={PIE_R + PIE_STROKE / 2}
                    fill={T.lineSoft}
                  />
                  {/* Depleting pie wedge. The stroke is wide enough to
                      span from r=0 (center) out to r=PIE_R+PIE_STROKE/2,
                      so it paints a solid disc that the dashoffset
                      eats away. */}
                  <AnimatedCircle
                    cx={PIE_BOX / 2}
                    cy={PIE_BOX / 2}
                    r={PIE_R}
                    fill="transparent"
                    stroke={T.mauveDeep}
                    strokeWidth={PIE_STROKE}
                    strokeDasharray={`${PIE_CIRC} ${PIE_CIRC}`}
                    strokeDashoffset={dashOffset}
                  />
                </G>
              </Svg>
            </View>

            <View style={styles.illoWrap}>
              <Illo />
            </View>

            <Text style={styles.kicker}>{entry.kicker}</Text>
            <Text style={styles.title}>{entry.title}</Text>
            {/* 100% has roughly 4× the body copy of the other tiers
                (the framing how-to gets tacked on), so we tighten the
                body type to keep the card from running off the screen
                on small devices. */}
            <Text style={[styles.body, threshold === 100 && styles.bodyLong]}>
              {entry.body}
            </Text>
          </Glass>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Illustrations ────────────────────────────────────────────────────────
// Each milestone gets a unique SVG built from the Threadia palette
// (mauve / rose / sage / cream). Wrapped in a 132×132 viewport so the
// card layout stays constant across thresholds.
//
// All four share a "circular ring + cross-stitch mark" motif so the set
// reads as a series — the difference is what fills the ring and which
// element gets the spotlight.

// 25% — quarter wedge filled in mauve over an empty ring. A single
// cross-stitch "x" sits in the wedge to anchor the theme.
function QuarterIllo() {
  return (
    <Svg width="132" height="132" viewBox="0 0 132 132" fill="none">
      {/* Outer ring */}
      <Circle cx="66" cy="66" r="50" stroke={T.line} strokeWidth="3" fill={T.cream} />
      {/* Quarter wedge — top right */}
      <Path
        d="M66 16 A50 50 0 0 1 116 66 L66 66 Z"
        fill={T.mauve}
        opacity={0.85}
      />
      {/* Single stitch mark in the wedge */}
      <G stroke={T.paper} strokeWidth="3" strokeLinecap="round">
        <Line x1="86" y1="36" x2="98" y2="48" />
        <Line x1="98" y1="36" x2="86" y2="48" />
      </G>
      {/* Center pin */}
      <Circle cx="66" cy="66" r="5" fill={T.mauveDeep} />
      {/* Sprout — top accent */}
      <Path
        d="M66 12 C 62 6, 60 4, 56 4 M66 12 C 70 6, 72 4, 76 4"
        stroke={T.successTx}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// 50% — half ring filled. Stitches form a small row inside the filled
// half, reading as "halfway through the row."
function HalfIllo() {
  return (
    <Svg width="132" height="132" viewBox="0 0 132 132" fill="none">
      <Circle cx="66" cy="66" r="50" stroke={T.line} strokeWidth="3" fill={T.cream} />
      {/* Right half filled */}
      <Path
        d="M66 16 A50 50 0 0 1 66 116 L66 66 Z"
        fill={T.mauve}
        opacity={0.85}
      />
      {/* Stitch row across the meridian */}
      <G stroke={T.paper} strokeWidth="2.8" strokeLinecap="round">
        <Line x1="74" y1="44" x2="86" y2="56" />
        <Line x1="86" y1="44" x2="74" y2="56" />
        <Line x1="74" y1="60" x2="86" y2="72" />
        <Line x1="86" y1="60" x2="74" y2="72" />
        <Line x1="74" y1="76" x2="86" y2="88" />
        <Line x1="86" y1="76" x2="74" y2="88" />
      </G>
      {/* Meridian line */}
      <Line x1="66" y1="16" x2="66" y2="116" stroke={T.mauveDeep} strokeWidth="2" />
      {/* Bird — descent metaphor */}
      <Path
        d="M22 36 Q 30 30, 38 36 M38 36 Q 46 30, 54 36"
        stroke={T.mauveDeep}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// 75% — three quarters filled. A small unfinished gap remains in the
// top-left; the rest is dense with stitch marks.
function ThreeQuarterIllo() {
  return (
    <Svg width="132" height="132" viewBox="0 0 132 132" fill="none">
      <Circle cx="66" cy="66" r="50" stroke={T.line} strokeWidth="3" fill={T.cream} />
      {/* Three quarters filled — everything except top-left quadrant */}
      <Path
        d="M66 16 A50 50 0 0 1 116 66 A50 50 0 0 1 66 116 A50 50 0 0 1 16 66 L66 66 Z"
        fill={T.mauve}
        opacity={0.85}
      />
      {/* The unfilled top-left wedge gets a subtle stripe pattern to
          read as "still to do" rather than "ignored" */}
      <Path
        d="M16 66 A50 50 0 0 1 66 16 L66 66 Z"
        fill={T.rose}
        opacity={0.4}
      />
      {/* Stitch marks scattered in filled area */}
      <G stroke={T.paper} strokeWidth="2.4" strokeLinecap="round">
        <Line x1="80" y1="44" x2="90" y2="54" />
        <Line x1="90" y1="44" x2="80" y2="54" />
        <Line x1="92" y1="72" x2="102" y2="82" />
        <Line x1="102" y1="72" x2="92" y2="82" />
        <Line x1="60" y1="90" x2="70" y2="100" />
        <Line x1="70" y1="90" x2="60" y2="100" />
      </G>
      {/* Finish-line flag */}
      <Line x1="106" y1="20" x2="106" y2="46" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" />
      <Rect x="106" y="20" width="14" height="9" fill={T.mauveDeep} />
      <Rect x="106" y="29" width="14" height="9" fill={T.paper} stroke={T.mauveDeep} strokeWidth="1" />
    </Svg>
  );
}

// 100% — complete ring filled, encircled by a halo. A subtle sage star
// burst marks the milestone as a peak.
function CompleteIllo() {
  return (
    <Svg width="132" height="132" viewBox="0 0 132 132" fill="none">
      {/* Halo */}
      <Circle cx="66" cy="66" r="60" stroke={T.successTx} strokeWidth="1.5" opacity={0.5} fill="none" />
      {/* Star burst rays */}
      <G stroke={T.successTx} strokeWidth="2" strokeLinecap="round" opacity={0.65}>
        <Line x1="66" y1="4" x2="66" y2="12" />
        <Line x1="66" y1="120" x2="66" y2="128" />
        <Line x1="4" y1="66" x2="12" y2="66" />
        <Line x1="120" y1="66" x2="128" y2="66" />
        <Line x1="22" y1="22" x2="28" y2="28" />
        <Line x1="104" y1="104" x2="110" y2="110" />
        <Line x1="22" y1="110" x2="28" y2="104" />
        <Line x1="104" y1="28" x2="110" y2="22" />
      </G>
      {/* Filled disc */}
      <Circle cx="66" cy="66" r="42" fill={T.mauve} />
      <Circle cx="66" cy="66" r="42" stroke={T.mauveDeep} strokeWidth="2" fill="none" />
      {/* Centered checkmark — bold and final */}
      <Path
        d="M48 66 L60 78 L86 52"
        stroke={T.paper}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: S.glassOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  cardWrap: {
    width: '100%',
    // Bumped from 340 → 360 so the long 100% body has more horizontal
    // room to wrap. Still fits a 375 pt iPhone width with the scrim's
    // 28px gutter on both sides.
    maxWidth: 360,
  },
  // minHeight floor — same Glass.js flex-collapse workaround used on
  // the export modal. Without it the column children (illo, kicker,
  // title, body) can squeeze to nothing in some layouts.
  card: {
    padding: SP.xl,
    paddingTop: SP.xxl,
    paddingBottom: SP.xl,
    alignItems: 'center',
    minHeight: 320,
    shadowColor: T.ink,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  // Countdown pie — top-right of the card. Absolutely positioned so it
  // doesn't push the centered content off-axis, and pointerEvents:none
  // (set on the wrap above) so it can't intercept the scrim tap-to-
  // dismiss when the user reaches past the card.
  pieWrap: {
    position: 'absolute',
    top: SP.md,
    right: SP.md,
  },
  illoWrap: {
    marginBottom: SP.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  kicker: {
    ...TYPO.kickerMd,
    color: S.textBrand,
    marginBottom: SP.sm,
  },
  title: {
    ...TYPO.h2,
    color: S.textPrimary,
    textAlign: 'center',
    marginBottom: SP.md,
  },
  body: {
    ...TYPO.bodyMd,
    color: S.textSecondary,
    textAlign: 'center',
  },
  // For 100% — the framing-how-to body. ~155 chars vs ~50 elsewhere, so
  // we drop a notch to bodySm and tighten the line height. Stays
  // readable on a 6 s dwell, doesn't push the card off the bottom on
  // small devices.
  bodyLong: {
    ...TYPO.bodySm,
    lineHeight: 19,
  },
});
