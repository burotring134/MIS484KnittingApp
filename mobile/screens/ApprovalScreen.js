import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { T } from '../utils/theme';

// New patterns ship with a pre-rendered chart PNG straight from the
// backend — render it as a single Image quad. Older saved projects (or
// any save where the PNG didn't make it through) fall back to a
// path-batched SVG so the screen still renders without spending W*H on
// individual rects.
function PatternThumb({ pattern, size = 280 }) {
  const cw = size / pattern.width;
  const h  = pattern.height * cw;

  if (pattern.imageDataUri) {
    return (
      <Image
        source={{ uri: pattern.imageDataUri }}
        style={{ width: size, height: h }}
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
      items.push(<Line key={`h${i}`} x1={0} y1={i*cw} x2={size} y2={i*cw} stroke="rgba(61,52,48,0.08)" strokeWidth={0.4}/>);
    }
    for (let i = 1; i < pattern.width; i++) {
      items.push(<Line key={`v${i}`} x1={i*cw} y1={0} x2={i*cw} y2={pattern.height * cw} stroke="rgba(61,52,48,0.08)" strokeWidth={0.4}/>);
    }
  }
  return (
    <Svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      {items}
    </Svg>
  );
}

export default function ApprovalScreen({ pattern, onApprove, onDiscard }) {
  if (!pattern) return null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.topBar}>
        <Text style={styles.kicker}>ONAY · KANAVIÇE PATTERN</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Pattern hazır.</Text>
        <Text style={styles.sub}>
          Beğendiysen atölyene kaydet, beğenmediysen sil ve tekrar dene.
        </Text>

        <View style={styles.card}>
          <View style={styles.patternWrap}>
            <PatternThumb pattern={pattern}/>
          </View>

          <View style={styles.stats}>
            {[
              { k: 'Cells',   v: `${pattern.width}×${pattern.height}` },
              { k: 'Stitches',v: (pattern.width * pattern.height).toLocaleString() },
              { k: 'Renk',    v: `${pattern.colors.length}` },
            ].map((s) => (
              <View key={s.k} style={styles.stat}>
                <Text style={styles.statV}>{s.v}</Text>
                <Text style={styles.statK}>{s.k}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onDiscard} activeOpacity={0.85}>
          <Text style={styles.btnGhostTxt}>Sil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onApprove} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryTxt}>Atölyeme Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.cream, paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight : 44) },
  topBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  kicker: { fontSize: 11, letterSpacing: 2, fontWeight: '800', color: T.mauveDeep },

  scroll: { padding: 20, paddingTop: 4, paddingBottom: 120 },
  title: { fontSize: 30, fontWeight: '900', color: T.ink, letterSpacing: -1 },
  sub:   { fontSize: 14, color: T.inkSoft, marginTop: 6, lineHeight: 20 },

  card: {
    marginTop: 22,
    backgroundColor: T.paper,
    borderRadius: 24,
    padding: 14,
    shadowColor: T.ink,
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  patternWrap: {
    alignItems: 'center',
    backgroundColor: T.creamDeep,
    borderRadius: 16,
    padding: 8,
  },
  stats: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontSize: 17, fontWeight: '800', color: T.ink },
  statK: { fontSize: 11, fontWeight: '600', color: T.inkMute, letterSpacing: 0.5, marginTop: 2, textTransform: 'uppercase' },

  actions: {
    position: 'absolute',
    left: 20, right: 20, bottom: 28,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 9999,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: T.paper,
    borderWidth: 1, borderColor: T.line,
  },
  btnGhostTxt: { color: T.inkSoft, fontSize: 15, fontWeight: '700' },
  btnPrimary: {
    backgroundColor: T.mauve,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  btnPrimaryTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
