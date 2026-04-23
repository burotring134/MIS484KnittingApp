import { useState, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const C = {
  primary:          '#006c52',
  primaryContainer: '#8ff6cf',
  surfaceLowest:    '#ffffff',
  surfaceLow:       '#f5f4ef',
  surfaceMid:       '#efeee9',
  onSurface:        '#31332f',
  onSurfaceVar:     '#5e605b',
  outlineVar:       '#b2b2ad',
};

const STEPS = [
  { label: 'Uploading image to fal.ai…'         },
  { label: 'AI converting to cross-stitch style…' },
  { label: 'Resizing to pattern grid…'           },
  { label: 'K-means color quantization…'         },
  { label: 'Mapping pixels to DMC threads…'      },
  { label: 'Building final pattern…'             },
];

export default function LoadingSpinner() {
  const [step, setStep] = useState(0);
  const [spinAnim]  = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1800, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    const id = setInterval(
      () => setStep((s) => (s + 1 < STEPS.length ? s + 1 : s)),
      3200
    );
    return () => clearInterval(id);
  }, []);

  const rotate = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.card}>
      {/* Spinner */}
      <View style={styles.spinnerWrap}>
        <View style={styles.spinnerTrack} />
        <Animated.View style={[styles.spinnerArc, { transform: [{ rotate }] }]} />
      </View>

      <Text style={styles.heading}>Weaving your pattern…</Text>
      <Text style={styles.sub}>This may take up to 30 seconds</Text>

      {/* Steps */}
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.step,
              i === step && styles.stepActive,
              i <  step && styles.stepDone,
              i >  step && styles.stepPending,
            ]}
          >
            <Text
              style={[
                styles.stepLabel,
                i === step && styles.stepLabelActive,
                i <  step  && styles.stepLabelDone,
              ]}
              numberOfLines={1}
            >
              {s.label}
            </Text>
            {i < step  && <Text style={styles.check}>Done</Text>}
            {i === step && <View style={styles.dot} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius:    32,
    padding:         28,
    alignItems:      'center',
    gap:             12,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.04,
    shadowRadius:    32,
    shadowOffset:    { width: 0, height: 10 },
    elevation:       3,
  },

  spinnerWrap: {
    width:          80,
    height:         80,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   4,
  },
  spinnerTrack: {
    position:     'absolute',
    width:        80,
    height:       80,
    borderRadius: 40,
    borderWidth:  4,
    borderColor:  C.surfaceMid,
  },
  spinnerArc: {
    position:         'absolute',
    width:            80,
    height:           80,
    borderRadius:     40,
    borderWidth:      4,
    borderColor:      'transparent',
    borderTopColor:   C.primary,
    borderRightColor: C.primaryContainer,
  },
  heading: { fontSize: 20, fontWeight: '900', color: C.onSurface, letterSpacing: -0.5 },
  sub:      { fontSize: 12, color: C.onSurfaceVar, marginTop: -4 },

  steps:   { width: '100%', gap: 4, marginTop: 4 },
  step: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingVertical:    8,
    paddingHorizontal: 12,
    borderRadius:      16,
  },
  stepActive:  { backgroundColor: C.surfaceLow },
  stepDone:    { opacity: 0.45 },
  stepPending: { opacity: 0.20 },

  stepLabel:       { flex: 1, fontSize: 12, color: C.onSurfaceVar },
  stepLabelActive: { color: C.onSurface, fontWeight: '700' },
  stepLabelDone:   { color: C.outlineVar },

  check: { fontSize: 13, color: C.primary, fontWeight: '800' },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: C.primary,
  },
});
