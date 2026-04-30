import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { T } from '../utils/theme';

const STEPS = [
  'Fotoğraf yükleniyor',
  'AI kanaviçe stiline çeviriyor',
  'Grid boyutuna küçültülüyor',
  'Renk paleti hesaplanıyor',
  'DMC ipliklerine eşleniyor',
  'Pattern hazırlanıyor',
];

const RING_SIZE   = 170;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC   = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─────────────────────────────────────────────────────────────────────────────
// StepRow — one row in the vertical timeline. Owns its own animation state so
// only the active row pulses and only the most recent done row plays its
// check fade-in.
// ─────────────────────────────────────────────────────────────────────────────
function StepRow({ index, total, label, state }) {
  const isLast = index === total - 1;

  // Fade for the whole row — pending rows sit at lower opacity so the active
  // row reads as the focus.
  const fade  = useRef(new Animated.Value(state === 'pending' ? 0.4 : 1)).current;
  // Pulse on the active bullet only.
  const pulse = useRef(new Animated.Value(1)).current;
  // Check mark opacity on done rows.
  const check = useRef(new Animated.Value(state === 'done' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: state === 'pending' ? 0.4 : 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
    Animated.timing(check, {
      toValue: state === 'done' ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
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
      <Text style={[
        styles.label,
        state === 'active' && styles.labelActive,
        state === 'done'   && styles.labelDone,
      ]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoadingScreen
// ─────────────────────────────────────────────────────────────────────────────
export default function LoadingScreen() {
  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1 < STEPS.length ? s + 1 : s));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const target = Math.min(0.95, (step + 1) / STEPS.length);
    Animated.timing(progress, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // SVG props can't be native-driven
    }).start();
  }, [step]);

  const dashOffset = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [RING_CIRC, 0],
  });

  const pct = Math.round(Math.min(0.95, (step + 1) / STEPS.length) * 100);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.header}>
        <Text style={styles.kicker}>HAZIRLANIYOR</Text>
        <Text style={styles.heading}>Pattern dokunuyor</Text>
      </View>

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={T.lineSoft}
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
          <Text style={styles.stepCount}>{Math.min(step + 1, STEPS.length)} / {STEPS.length}</Text>
        </View>
      </View>

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
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const BULLET_SIZE = 22;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.cream,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
    paddingHorizontal: 28,
  },

  header: {
    alignItems: 'center',
    paddingTop: 22,
  },
  kicker:  { fontSize: 11, fontWeight: '800', color: T.mauveDeep, letterSpacing: 2.5 },
  heading: { fontSize: 28, fontWeight: '900', color: T.ink, letterSpacing: -0.8, marginTop: 8 },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 32,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct:        { fontSize: 48, fontWeight: '900', color: T.ink, letterSpacing: -2.5, lineHeight: 52 },
  pctSuffix:  { fontSize: 22, fontWeight: '700', color: T.inkMute },
  stepCount:  { fontSize: 10, fontWeight: '800', color: T.inkMute, letterSpacing: 2, marginTop: 4 },

  // ── Step list ────────────────────────────────────────────────────────────
  stepsList: {
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  col: {
    width: BULLET_SIZE,
    alignItems: 'center',
  },
  bullet: {
    width: BULLET_SIZE, height: BULLET_SIZE, borderRadius: BULLET_SIZE / 2,
    borderWidth: 2, borderColor: T.line,
    backgroundColor: T.creamDeep,
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
  check: { fontSize: 12, fontWeight: '900', color: T.successTx, lineHeight: 13 },

  connector: {
    width: 2,
    height: 26,
    backgroundColor: T.line,
    marginTop: 4,
    marginBottom: 4,
  },
  connectorDone: { backgroundColor: T.mint },

  label: {
    flex: 1,
    fontSize: 14,
    color: T.inkSoft,
    fontWeight: '500',
    paddingTop: 2,
    lineHeight: 20,
  },
  labelActive: { color: T.ink, fontWeight: '700' },
  labelDone:   { color: T.inkSoft },
});
