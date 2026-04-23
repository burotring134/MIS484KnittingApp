import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar, Platform } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { T } from '../utils/theme';

const STEPS = [
  'Fotoğraf yükleniyor…',
  'AI kanaviçe stiline çeviriyor…',
  'Grid boyutuna küçültülüyor…',
  'Renk paleti hesaplanıyor…',
  'DMC ipliklerine eşleniyor…',
  'Pattern hazırlanıyor…',
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function LoadingScreen() {
  const [step, setStep] = useState(0);
  const [anim] = useState(new Animated.Value(0));

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1 < STEPS.length ? s + 1 : s));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progress = Math.min(0.95, (step + 0.5) / STEPS.length);
  const pct = Math.round(progress * 100);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.center}>
        <View style={styles.ringWrap}>
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Defs>
              <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%"  stopColor={T.mauve}/>
                <Stop offset="50%" stopColor="#C9A9D8"/>
                <Stop offset="100%" stopColor="#A8CBBE"/>
              </LinearGradient>
            </Defs>
            <Circle cx="110" cy="110" r="100" stroke={T.lineSoft} strokeWidth="12" fill="none"/>
            <Circle
              cx="110" cy="110" r="100"
              stroke="url(#ring)" strokeWidth="12" fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 100}
              strokeDashoffset={2 * Math.PI * 100 * (1 - progress)}
              transform="rotate(-90 110 110)"
            />
          </Svg>
          <View style={styles.ringInner}>
            <Text style={styles.ringPct}>{pct}<Text style={styles.ringPctSuffix}>%</Text></Text>
            <Text style={styles.ringLabel}>WEAVING</Text>
          </View>
          <Animated.View style={[styles.spinDot, { transform: [{ rotate }] }]}>
            <View style={styles.spinDotInner}/>
          </Animated.View>
        </View>

        <Text style={styles.heading}>Pattern dokunuyor…</Text>
        <Text style={styles.sub}>Bu işlem 30 saniye kadar sürebilir.</Text>
      </View>

      <View style={styles.steps}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <View key={i} style={[styles.step, active && styles.stepActive, done && styles.stepDone]}>
              <View style={[styles.stepDot,
                done   && { backgroundColor: T.mint },
                active && { backgroundColor: T.mauve },
              ]}/>
              <Text style={[styles.stepTxt,
                active && styles.stepTxtActive,
                done   && styles.stepTxtDone,
              ]}>{s}</Text>
              {active && <Text style={styles.stepDots}>···</Text>}
              {done   && <Text style={styles.stepCheck}>✓</Text>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.cream,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  center: {
    alignItems: 'center',
    paddingTop: 40,
  },
  ringWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringPct: { fontSize: 56, fontWeight: '900', color: T.ink, letterSpacing: -2, lineHeight: 60 },
  ringPctSuffix: { fontSize: 24, color: T.inkSoft, fontWeight: '700' },
  ringLabel: { fontSize: 10, color: T.inkMute, fontWeight: '700', letterSpacing: 2, marginTop: 4 },
  spinDot: {
    position: 'absolute',
    width: 220,
    height: 220,
    alignItems: 'center',
  },
  spinDotInner: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: T.mauveDeep,
    marginTop: -2,
    shadowColor: T.mauveDeep, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },

  heading: { fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.4, marginTop: 26 },
  sub: { fontSize: 13, color: T.inkSoft, marginTop: 6 },

  steps: {
    marginTop: 32,
    paddingHorizontal: 24,
    gap: 6,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  stepActive: { backgroundColor: T.paper },
  stepDone:   { opacity: 0.55 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.lineSoft,
  },
  stepTxt:       { flex: 1, fontSize: 14, color: T.inkMute, fontWeight: '500' },
  stepTxtActive: { color: T.ink, fontWeight: '700' },
  stepTxtDone:   { color: T.inkSoft },
  stepDots:      { fontSize: 14, color: T.mauveDeep, fontWeight: '800' },
  stepCheck:     { fontSize: 14, color: T.successTx, fontWeight: '800' },
});
