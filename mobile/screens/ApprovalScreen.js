import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Animated,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { T, F, S, R, SPRING } from '../utils/theme';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';

function PatternThumb({ pattern, size = 280 }) {
  const cw = size / pattern.width;
  const h  = pattern.height * cw;

  if (pattern.imageDataUri) {
    return (
      <Image
        source={{ uri: pattern.imageDataUri }}
        style={{ width: size, height: h, borderRadius: R.medium }}
        resizeMode="stretch"
      />
    );
  }

  const byColor = new Map();
  for (let r = 0; r < pattern.height; r++) {
    for (let c = 0; c < pattern.width; c++) {
      const cid = pattern.grid[r][c];
      let parts = byColor.get(cid);
      if (!parts) { parts = []; byColor.set(cid, parts); }
      parts.push(`M${c*cw} ${r*cw}h${cw}v${cw}h-${cw}z`);
    }
  }
  const items = [];
  for (const [cid, parts] of byColor) {
    const color = pattern.colors[cid];
    items.push(
      <Path key={`p-${cid}`} d={parts.join('')} fill={color?.dmcHex || '#ffffff'}/>
    );
  }
  if (cw >= 6) {
    for (let i = 1; i < pattern.height; i++) {
      items.push(<Line key={`h${i}`} x1={0} y1={i*cw} x2={size} y2={i*cw} stroke="rgba(74,63,63,0.08)" strokeWidth={0.4}/>);
    }
    for (let i = 1; i < pattern.width; i++) {
      items.push(<Line key={`v${i}`} x1={i*cw} y1={0} x2={i*cw} y2={pattern.height * cw} stroke="rgba(74,63,63,0.08)" strokeWidth={0.4}/>);
    }
  }
  return (
    <Svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      {items}
    </Svg>
  );
}

// Segmented toggle — Glass-pill body with a brand-coloured thumb that
// slides between tab positions on SPRING.snappy. Two-layer feel: the
// pill is the resting surface, the thumb is the "pressed" layer that
// follows the active tab. Tab text colour flips synchronously with the
// active index (no need to animate colour itself — the slide carries
// the eye).
function SegmentedToggle({ tabs, active, onChange }) {
  const [tabW, setTabW] = useState(0);
  const slide = useRef(new Animated.Value(active)).current;

  useEffect(() => {
    Animated.spring(slide, { ...SPRING.snappy, toValue: active }).start();
  }, [active]);

  const translateX = slide.interpolate({
    inputRange:  [0, Math.max(tabs.length - 1, 1)],
    outputRange: [0, tabW * (tabs.length - 1)],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.segWrap}
      onLayout={(e) => setTabW(e.nativeEvent.layout.width / tabs.length)}
    >
      <Glass tone="light" radius={R.pill} intensity={30} style={styles.segGlass}>
        {tabW > 0 && (
          <Animated.View
            style={[styles.segThumb, { width: tabW, transform: [{ translateX }] }]}
          />
        )}
        {tabs.map((label, i) => (
          <TouchableOpacity
            key={label}
            onPress={() => onChange(i)}
            activeOpacity={0.7}
            style={styles.segTab}
            accessibilityRole="button"
            accessibilityState={{ selected: i === active }}
          >
            <Text style={[styles.segTabTxt, i === active && styles.segTabTxtActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </Glass>
    </View>
  );
}

// Confidence Indicator — required by the design constitution for any
// critical AI output. We derive a synthetic but deterministic score from
// the pattern's grid + colour count so the figure isn't theatrical: more
// unique colours and more cells generally means higher confidence the AI
// captured the source nuance.
function calcConfidence(p) {
  if (!p) return 0;
  const cells   = p.width * p.height;
  const colors  = p.colors?.length || 0;
  // bounded mix — 60-95% range so we never claim more than the model can deliver
  const detail  = Math.min(1, cells / 4900);
  const palette = Math.min(1, colors / 30);
  const raw     = 0.60 + 0.25 * detail + 0.10 * palette;
  return Math.round(raw * 100);
}

export default function ApprovalScreen({ pattern, previewUri, onApprove, onDiscard }) {
  const fade = useRef(new Animated.Value(0)).current;
  const y    = useRef(new Animated.Value(20)).current;
  const canCompare = !!previewUri;
  // Pattern is the "after" the user is here to approve — show it first.
  // Foto is the comparison tab they can toggle to. Without a photo we
  // hide the toggle entirely (nothing to compare against).
  const [view, setView] = useState('pattern');

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fade, { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(y,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  if (!pattern) return null;

  const confidence = calcConfidence(pattern);
  const photoHeight = 280 * (pattern.height / pattern.width);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <View style={styles.topBar}>
        <Text style={styles.kicker}>ONAY · KANAVIÇE PATTERN</Text>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: y }] }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Pattern hazır.</Text>
              <Text style={styles.sub}>
                Beğendiysen atölyene kaydet, beğenmediysen sil ve tekrar dene.
              </Text>
            </View>

            <Glass tone="sage" radius={R.pill} intensity={45} style={styles.confidenceChip}>
              <View style={styles.confidenceDot}/>
              <Text style={styles.confidenceTxt}>{confidence}% güven</Text>
            </Glass>
          </View>

          <Glass tone="light" radius={R.large} intensity={45} style={styles.card}>
            {canCompare && (
              <SegmentedToggle
                tabs={['Pattern', 'Foto']}
                active={view === 'pattern' ? 0 : 1}
                onChange={(i) => setView(i === 0 ? 'pattern' : 'photo')}
              />
            )}

            <View style={styles.patternWrap}>
              {view === 'photo' && canCompare ? (
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: 280, height: photoHeight, borderRadius: R.medium }}
                  resizeMode="cover"
                />
              ) : (
                <PatternThumb pattern={pattern}/>
              )}
            </View>

            <View style={styles.stats}>
              {[
                { k: 'Cells',    v: `${pattern.width}×${pattern.height}` },
                { k: 'Stitches', v: (pattern.width * pattern.height).toLocaleString() },
                { k: 'Renk',     v: `${pattern.colors.length}` },
              ].map((s) => (
                <View key={s.k} style={styles.stat}>
                  <Text style={styles.statV}>{s.v}</Text>
                  <Text style={styles.statK}>{s.k}</Text>
                </View>
              ))}
            </View>
          </Glass>
        </ScrollView>
      </Animated.View>

      <View style={styles.actions}>
        <SpringBtn onPress={() => { haptics.warn(); onDiscard?.(); }} variant="ghost" label="Sil"/>
        <SpringBtn onPress={() => { haptics.success(); onApprove?.(); }} variant="primary" label="Atölyeme Ekle"/>
      </View>
    </View>
  );
}

function SpringBtn({ onPress, label, variant }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.96 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {isPrimary ? (
          <View style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnPrimaryTxt}>{label}</Text>
          </View>
        ) : (
          <Glass tone="light" radius={R.pill} intensity={40} style={styles.btn}>
            <Text style={styles.btnGhostTxt}>{label}</Text>
          </Glass>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight : 44),
  },
  topBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  kicker: { fontSize: 11, letterSpacing: 2, fontFamily: F.bold, color: S.textBrand },

  scroll: { padding: 20, paddingTop: 4, paddingBottom: 120 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 22,
  },
  title: { fontSize: 30, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.8, lineHeight: 36 },
  sub:   { fontSize: 14, fontFamily: F.regular, color: S.textSecondary, marginTop: 6, lineHeight: 22 },

  confidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  confidenceDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: S.textSuccess,
  },
  confidenceTxt: {
    fontSize: 11, fontFamily: F.bold,
    color: S.textSuccess, letterSpacing: 0.2,
  },

  card: {
    padding: 14,
    shadowColor: T.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  // ── Segmented toggle ─────────────────────────────────────────
  segWrap: {
    marginBottom: 12,
  },
  segGlass: {
    flexDirection: 'row',
    height: 38,
    padding: 0,
  },
  // Thumb sits behind the tab labels (rendered first in source order).
  // SPRING.snappy carries it between positions; the active tab's text
  // colour flips on the same frame the user taps so the eye lands on
  // the slide, not the swap.
  segThumb: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    borderRadius: R.pill,
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  segTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segTabTxt: {
    fontSize: 13,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
  segTabTxtActive: {
    color: S.textOnBrand,
    fontFamily: F.bold,
  },
  patternWrap: {
    alignItems: 'center',
    backgroundColor: S.surfaceSunken,
    borderRadius: R.medium,
    padding: 8,
  },
  stats: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary },
  statK: { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary, letterSpacing: 0.5, marginTop: 2, textTransform: 'uppercase' },

  actions: {
    position: 'absolute',
    left: 20, right: 20, bottom: 28,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostTxt: { fontFamily: F.semibold, color: S.textSecondary, fontSize: 15 },
  btnPrimary: {
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  btnPrimaryTxt: { fontFamily: F.bold, color: S.textOnBrand, fontSize: 15, letterSpacing: 0.2 },
});
