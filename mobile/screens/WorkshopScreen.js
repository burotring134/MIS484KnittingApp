import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform, Alert } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { T } from '../utils/theme';
import { deleteProject } from '../utils/storage';

const DIFF_TINTS = {
  easy:   { label: 'Kolay', bg: T.mint,     fg: T.successTx },
  medium: { label: 'Orta',  bg: T.lavender, fg: T.mauveDeep },
  hard:   { label: 'Zor',   bg: T.rose,     fg: T.mauveDeep },
};

function Mini({ pattern, size = 72 }) {
  const cw = size / Math.max(pattern.width, pattern.height);
  const rects = [];
  for (let r = 0; r < pattern.height; r++) {
    for (let c = 0; c < pattern.width; c++) {
      const color = pattern.colors[pattern.grid[r][c]];
      rects.push(
        <Rect key={`${r}-${c}`}
          x={c * cw} y={r * cw}
          width={cw} height={cw}
          fill={color?.dmcHex || '#fff'}
        />
      );
    }
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects}
    </Svg>
  );
}

function cellCount(p) {
  return p.width * p.height;
}

function completedCount(p) {
  if (!p.completed) return 0;
  return Object.keys(p.completed).length;
}

export default function WorkshopScreen({ projects, onBack, onOpen, onRefresh, onNew }) {
  const handleDelete = (id) => {
    Alert.alert('Projeyi sil', 'Bu proje kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(id);
          onRefresh?.();
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Atölyem</Text>
        <View style={{ width: 60 }}/>
      </View>

      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Henüz proje yok</Text>
          <Text style={styles.emptyDesc}>
            Yeni pattern oluştur ya da koleksiyondan bir desen seç — buraya kaydedilir.
          </Text>
          <TouchableOpacity style={styles.emptyCta} onPress={onNew} activeOpacity={0.85}>
            <Text style={styles.emptyCtaTxt}>Yeni Pattern</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>{projects.length} proje · uzun bas → sil</Text>

          {projects.map((p) => {
            const done = completedCount(p);
            const total = cellCount(p);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const diff = DIFF_TINTS[p.difficulty] || DIFF_TINTS.medium;

            return (
              <TouchableOpacity
                key={p.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => onOpen(p.id)}
                onLongPress={() => handleDelete(p.id)}
              >
                <View style={styles.thumb}>
                  <Mini pattern={p}/>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <View style={[styles.diffPill, { backgroundColor: diff.bg }]}>
                      <Text style={[styles.diffPillTxt, { color: diff.fg }]}>{diff.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {p.width}×{p.height} · {p.colors.length} renk · {total.toLocaleString()} stitches
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]}/>
                  </View>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressTxt}>{pct}% tamamlandı</Text>
                    <Text style={styles.dateTxt}>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.newBtn} onPress={onNew} activeOpacity={0.85}>
            <Text style={styles.newBtnTxt}>+ Yeni Pattern Oluştur</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.cream, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backTxt: { fontSize: 16, color: T.mauveDeep, fontWeight: '600' },
  topTitle: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.4 },
  emptyDesc:  { fontSize: 14, color: T.inkSoft, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  emptyCta:   {
    marginTop: 20, backgroundColor: T.mauve,
    paddingHorizontal: 26, paddingVertical: 14,
    borderRadius: 9999,
  },
  emptyCtaTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  scroll: { padding: 20, paddingTop: 4, gap: 12 },
  sub: { fontSize: 12, color: T.inkMute, marginBottom: 8 },

  card: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: T.paper, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: T.line,
    shadowColor: T.ink, shadowOpacity: 0.03, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  thumb: {
    width: 72, height: 72, borderRadius: 12, overflow: 'hidden',
    backgroundColor: T.creamDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
  diffPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  diffPillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  meta: { fontSize: 12, color: T.inkMute, marginTop: 3 },
  barTrack: {
    height: 4, borderRadius: 2, backgroundColor: T.lineSoft,
    marginTop: 10, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: T.mauve },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressTxt: { fontSize: 11, fontWeight: '700', color: T.mauveDeep },
  dateTxt: { fontSize: 11, color: T.inkMute },

  newBtn: {
    marginTop: 12, padding: 16, borderRadius: 16,
    backgroundColor: T.creamDeep, alignItems: 'center',
    borderWidth: 1, borderColor: T.line, borderStyle: 'dashed',
  },
  newBtnTxt: { fontSize: 14, fontWeight: '700', color: T.mauveDeep },
});
