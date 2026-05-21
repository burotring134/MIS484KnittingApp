import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SPRING } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import Glass from '../components/Glass';
import Shimmer from '../components/Shimmer';

// The visible step labels and the fun-fact rotator's source list are
// resolved inside the LoadingScreen component (via useLanguage) so a
// language switch mid-load swaps them live. Pulling these to module
// scope as `const STEPS = strings.loadingSteps` would snapshot the
// initial language and freeze the timeline on it.

const RING_SIZE   = 170;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC   = 2 * Math.PI * RING_RADIUS;

// Per-step cadence. Total minimum time on screen = (STEPS.length - 1) *
// STEP_MS + completion settle, so backend has to beat ~10–11s before the
// user is "waiting on backend" rather than "watching progress". Tuned for
// feel: any faster and the steps blur; any slower and it drags.
const STEP_MS         = 2000;
const COMPLETE_HOLD   = 350;  // hold last "active" frame before flipping to done
const COMPLETE_SETTLE = 700;  // time for ring to fill 95→100 + check to land

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// One row in the step timeline. The active row shows a streaming-style
// typewriter render of its label (chars revealed one at a time) so the
// AI feels like it's "narrating" rather than ticking a list.
function StepRow({ index, total, label, state }) {
  const isLast = index === total - 1;

  const fade  = useRef(new Animated.Value(state === 'pending' ? 0.4 : 1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(state === 'done' ? 1 : 0)).current;
  const [typed, setTyped] = useState(state === 'done' ? label : (state === 'active' ? '' : label));

  // Typewriter only runs while the row is active. On enter we reset to ""
  // and reveal one char every 40ms.
  useEffect(() => {
    if (state !== 'active') {
      setTyped(label);
      return;
    }
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(label.slice(0, i));
      if (i >= label.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [state, label]);

  useEffect(() => {
    Animated.spring(fade, { ...SPRING.gentle, toValue: state === 'pending' ? 0.4 : 1 }).start();
    Animated.spring(check, { ...SPRING.gentle, toValue: state === 'done' ? 1 : 0 }).start();
  }, [state]);

  useEffect(() => {
    if (state !== 'active') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 720, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  return (
    <Animated.View style={[styles.row, { opacity: fade }]}>
      <View style={styles.col}>
        <View style={[
          styles.bullet,
          state === 'done'   && styles.bulletDone,
          state === 'active' && styles.bulletActive,
        ]}>
          {state === 'active' && (
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse }] }]}/>
          )}
          {state === 'done' && (
            <Animated.Text style={[styles.check, { opacity: check }]}>✓</Animated.Text>
          )}
        </View>
        {!isLast && (
          <View style={[
            styles.connector,
            state === 'done' && styles.connectorDone,
          ]}/>
        )}
      </View>
      <View style={{ flex: 1, paddingTop: 2 }}>
        <Text style={[
          styles.label,
          state === 'active' && styles.labelActive,
          state === 'done'   && styles.labelDone,
        ]}>
          {typed}
        </Text>
        {state === 'active' && typed.length < label.length && (
          <Shimmer width={140} height={6} style={{ marginTop: 8 }} radius={R.hairline}/>
        )}
      </View>
    </Animated.View>
  );
}

// Cycles through `facts` every `intervalMs`. Cross-fade is two-phase:
// the current fact springs out (opacity → 0, lift -8), then on settle we
// swap the text, drop it to +12 and spring it back in. The lift direction
// is consistent (always upward exit, upward entry) so each cycle reads
// as one continuous "thought" being replaced.
//
// 6 s lets the user comfortably read one fact and roll into a second
// within the ~12 s total loading window (6 steps × 2 s). The start
// index is randomised so heavy users don't see the same opener every
// run; idxRef is seeded with the same value so the rotation continues
// from the random start instead of jumping back to 0+1.
function FactCard({ facts, intervalMs = 6000 }) {
  const { strings } = useLanguage();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * facts.length));
  const fade   = useRef(new Animated.Value(1)).current;
  const transY = useRef(new Animated.Value(0)).current;
  const idxRef = useRef(index);

  useEffect(() => {
    const id = setInterval(() => {
      Animated.parallel([
        Animated.spring(fade,   { ...SPRING.gentle, toValue: 0 }),
        Animated.spring(transY, { ...SPRING.gentle, toValue: -8 }),
      ]).start(() => {
        idxRef.current = (idxRef.current + 1) % facts.length;
        setIndex(idxRef.current);
        transY.setValue(12);
        Animated.parallel([
          Animated.spring(fade,   { ...SPRING.gentle, toValue: 1 }),
          Animated.spring(transY, { ...SPRING.gentle, toValue: 0 }),
        ]).start();
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [facts.length, intervalMs]);

  return (
    <Glass tone="light" radius={R.expressive} intensity={45} style={styles.factCard}>
      <Text style={styles.factKicker}>{strings.loadingFactsKicker}</Text>
      <Animated.View style={[styles.factBody, { opacity: fade, transform: [{ translateY: transY }] }]}>
        <Text style={styles.factText}>{facts[index]}</Text>
      </Animated.View>
    </Glass>
  );
}

// LoadingScreen — paced step timeline that always runs to completion.
//
// `done` is set by the parent when the backend job finishes. The screen
// auto-advances through steps 0..N-1 on its own clock; it parks at the
// last step ("Pattern hazırlanıyor") until `done` is true. Once `done`
// arrives AND we've visually reached that last step, the screen flips
// everything to "done", fills the ring to 100%, and finally calls
// `onComplete` so the parent can navigate away. This guarantees the
// user always sees the full progression even when the backend is fast.
export default function LoadingScreen({ done = false, onComplete }) {
  const { strings } = useLanguage();
  const STEPS = strings.loadingSteps;
  const FACTS = strings.loadingFacts;
  const insets   = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);

  // Auto-advance the timeline. Parks at the final step — completion
  // beyond that comes from the `done` effect below.
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const id = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(id);
  }, [step]);

  // Completion sweep: only runs once, only when backend is `done` AND
  // we've reached the visual last step. setStep(STEPS.length) is the
  // "everything done" sentinel — every row treats itself as done.
  //
  // No cleanup function on purpose: setStep below changes `step`, which
  // re-runs the effect. A naive cleanup would cancel the onComplete
  // timeout before it ever fired (the bug that left the screen stuck at
  // 100%). `finishedRef` already guarantees single-fire.
  useEffect(() => {
    if (finishedRef.current) return;
    if (!done) return;
    if (step < STEPS.length - 1) return;
    finishedRef.current = true;

    setTimeout(() => setStep(STEPS.length),                 COMPLETE_HOLD);
    setTimeout(() => onComplete?.(),         COMPLETE_HOLD + COMPLETE_SETTLE);
  }, [done, step, onComplete]);

  // Progress target — 95% cap while waiting on backend, 100% when the
  // completion sweep has fired. Spring is non-native because the ring's
  // dashoffset is interpolated from this same value.
  useEffect(() => {
    const target = step >= STEPS.length
      ? 1.0
      : Math.min(0.95, (step + 1) / STEPS.length);
    Animated.spring(progress, { ...SPRING.gentle, toValue: target, useNativeDriver: false }).start();
  }, [step]);

  const dashOffset = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [RING_CIRC, 0],
  });

  const pctValue = step >= STEPS.length
    ? 1.0
    : Math.min(0.95, (step + 1) / STEPS.length);
  const pct = Math.round(pctValue * 100);
  const visibleStep = Math.min(step + 1, STEPS.length);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>{strings.loadingKicker}</Text>
          <Text style={styles.heading}>{strings.loadingHeading}</Text>
        </View>

        {/* ── Ring inside a glass disc — feels like a liquid lens ─── */}
        <Glass tone="light" radius={R.pill} intensity={40} style={styles.ringGlass}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={S.glassStrokeDark}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={T.mauve}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={styles.pct}>
              {pct}<Text style={styles.pctSuffix}>%</Text>
            </Text>
            <Text style={styles.stepCount}>{visibleStep} / {STEPS.length}</Text>
          </View>
        </Glass>

        <View style={styles.stepsList}>
          {STEPS.map((s, i) => {
            const stepState = i < step ? 'done' : i === step ? 'active' : 'pending';
            return (
              <StepRow
                key={i}
                index={i}
                total={STEPS.length}
                label={s}
                state={stepState}
              />
            );
          })}
        </View>

        <FactCard facts={FACTS}/>
      </ScrollView>
    </View>
  );
}

const BULLET_SIZE = 22;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 4,
  },

  header: {
    alignItems: 'center',
    paddingTop: 16,
  },
  kicker:  { fontSize: 11, fontFamily: F.bold, color: S.textBrand, letterSpacing: 2.5 },
  heading: { fontSize: 28, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.6, marginTop: 8 },

  ringGlass: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    marginBottom: 22,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct:        { fontSize: 48, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -2, lineHeight: 52 },
  pctSuffix:  { fontSize: 22, fontFamily: F.regular, color: S.textTertiary },
  stepCount:  { fontSize: 10, fontFamily: F.bold, color: S.textTertiary, letterSpacing: 2, marginTop: 4 },

  stepsList: {
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 2,
  },
  col: {
    width: BULLET_SIZE,
    alignItems: 'center',
  },
  bullet: {
    width: BULLET_SIZE, height: BULLET_SIZE, borderRadius: BULLET_SIZE / 2,
    borderWidth: 2, borderColor: T.line,
    backgroundColor: S.surfaceSunken,
    alignItems: 'center', justifyContent: 'center',
  },
  bulletActive: { borderColor: T.mauve, backgroundColor: T.mauve },
  bulletDone:   { borderColor: T.mint,  backgroundColor: T.mint },
  pulseRing: {
    position: 'absolute',
    width: BULLET_SIZE, height: BULLET_SIZE, borderRadius: BULLET_SIZE / 2,
    borderWidth: 2, borderColor: T.mauve,
    backgroundColor: 'transparent',
    opacity: 0.55,
  },
  check: { fontSize: 12, fontFamily: F.bold, color: S.textSuccess, lineHeight: 13 },

  connector: {
    width: 2,
    height: 16,
    backgroundColor: T.line,
    marginTop: 3,
    marginBottom: 3,
  },
  connectorDone: { backgroundColor: T.mint },

  label: {
    fontSize: 14,
    fontFamily: F.regular,
    color: S.textSecondary,
    lineHeight: 22,
  },
  labelActive: { fontFamily: F.bold, color: S.textPrimary },
  labelDone:   { color: S.textSecondary },

  // ── Fun-fact card ─────────────────────────────────────────────
  // Lives inside the ScrollView so it's always reachable — on tall
  // devices it sits naturally below the timeline; on short ones the
  // user can scroll a few px to see it. Fixed marginTop (not auto)
  // because we no longer rely on flex distribution.
  factCard: {
    marginTop: 22,
    padding: 16,
    gap: 10,
    shadowColor: T.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  factKicker: {
    fontSize: 11,
    fontFamily: F.bold,
    color: S.textBrand,
    letterSpacing: 2.4,
  },
  // minHeight reserves vertical space for ~3 lines so the card doesn't
  // jump in height as facts of varying length cycle through.
  factBody: {
    minHeight: 66,
  },
  factText: {
    fontSize: 14,
    fontFamily: F.regular,
    color: S.textPrimary,
    lineHeight: 22,
    letterSpacing: 0.05,
  },
});
