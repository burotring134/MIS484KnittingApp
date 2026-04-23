import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { T } from '../utils/theme';
import { API_BASE } from '../config';
import { saveProject } from '../utils/storage';

const DIFF_LABEL = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
const DIFF_TINT  = { easy: T.mint, medium: T.lavender, hard: T.rose };

export default function CollectionScreen({ onBack, onAdded }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    let off = false;
    fetch(`${API_BASE}/api/templates`)
      .then((r) => r.json())
      .then((data) => { if (!off) setList(data); })
      .catch((err) => { if (!off) setError(err.message); });
    return () => { off = true; };
  }, []);

  const addToWorkshop = async (tpl) => {
    setAdding(tpl.id);
    try {
      const resp = await fetch(`${API_BASE}/api/templates/${tpl.id}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const full = await resp.json();
      await saveProject({
        name:       full.name,
        source:     'template',
        difficulty: full.difficulty,
        width:      full.width,
        height:     full.height,
        grid:       full.grid,
        colors:     full.colors,
        completed:  {},
      });
      Alert.alert(
        'Eklendi',
        `"${full.name}" atölyene kaydedildi.`,
        [{ text: 'Tamam', onPress: () => onAdded?.() }]
      );
    } catch (err) {
      Alert.alert('Hata', err.message);
    } finally {
      setAdding(null);
    }
  };

  const grouped = list ? {
    easy:   list.filter((t) => t.difficulty === 'easy'),
    medium: list.filter((t) => t.difficulty === 'medium'),
    hard:   list.filter((t) => t.difficulty === 'hard'),
  } : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Koleksiyon</Text>
        <View style={{ width: 60 }}/>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Hazır Desenler</Text>
        <Text style={styles.sub}>Zorluk seviyesine göre seç, atölyene ekle, işlemeye başla</Text>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTxt}>Sunucuya ulaşılamadı: {error}</Text>
          </View>
        )}

        {!list && !error && (
          <View style={styles.loading}>
            <ActivityIndicator color={T.mauve}/>
            <Text style={styles.loadingTxt}>Şablonlar yükleniyor…</Text>
          </View>
        )}

        {grouped && ['easy', 'medium', 'hard'].map((diff) => (
          <View key={diff} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={[styles.diffBadge, { backgroundColor: DIFF_TINT[diff] }]}>
                <Text style={styles.diffBadgeTxt}>{DIFF_LABEL[diff]}</Text>
              </View>
              <Text style={styles.sectionCount}>{grouped[diff].length} desen</Text>
            </View>
            <View style={styles.cards}>
              {grouped[diff].map((tpl) => (
                <View key={tpl.id} style={styles.card}>
                  <View style={styles.swatchRow}>
                    {tpl.swatches.map((hex, i) => (
                      <View key={i} style={[styles.swatch, { backgroundColor: hex }]}/>
                    ))}
                  </View>
                  <Text style={styles.cardTitle}>{tpl.name}</Text>
                  <Text style={styles.cardMeta}>
                    {tpl.width}×{tpl.height} · {tpl.colors} renk
                  </Text>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => addToWorkshop(tpl)}
                    disabled={adding === tpl.id}
                    activeOpacity={0.85}
                  >
                    {adding === tpl.id
                      ? <ActivityIndicator size="small" color="#fff"/>
                      : <Text style={styles.addBtnTxt}>Atölyeme Ekle</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
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

  scroll: { padding: 20, paddingTop: 4 },
  heading: { fontSize: 26, fontWeight: '900', color: T.ink, letterSpacing: -0.8 },
  sub:     { fontSize: 13, color: T.inkSoft, marginTop: 4, marginBottom: 18 },

  errorCard: { backgroundColor: T.errorBg, padding: 14, borderRadius: 16, marginVertical: 10 },
  errorTxt:  { fontSize: 13, color: T.errorTx },

  loading: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingTxt: { fontSize: 13, color: T.inkSoft },

  section: { marginBottom: 24 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  diffBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 9999 },
  diffBadgeTxt: { fontSize: 12, fontWeight: '800', color: T.mauveDeep, letterSpacing: 0.5 },
  sectionCount: { fontSize: 11, color: T.inkMute, fontWeight: '600' },

  cards: { gap: 12 },
  card: {
    backgroundColor: T.paper, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: T.line,
    shadowColor: T.ink, shadowOpacity: 0.04, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  swatchRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  swatch:    { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: T.line },
  cardTitle: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  cardMeta:  { fontSize: 12, color: T.inkMute, marginTop: 2, marginBottom: 12 },
  addBtn: {
    backgroundColor: T.mauve,
    paddingVertical: 11, borderRadius: 9999,
    alignItems: 'center',
  },
  addBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
