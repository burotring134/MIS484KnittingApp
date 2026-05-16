import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ActivityIndicator, Alert, Animated, RefreshControl,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T, F, S, R, SPRING } from '../utils/theme';
import { API_BASE } from '../config';
import { saveProject, getFavorites, toggleFavorite } from '../utils/storage';
import Glass from '../components/Glass';

const DIFF_LABEL = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
const DIFF_TONE  = { easy: 'sage', medium: 'mauve', hard: 'rose' };
const DIFF_FG    = { easy: S.textSuccess, medium: S.textBrand, hard: S.textBrand };

export default function CollectionScreen({ onBack, onAdded }) {
  const [list, setList]         = useState(null);
  const [error, setError]       = useState(null);
  const [adding, setAdding]     = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [tab, setTab]           = useState('all'); // 'all' | 'fav'
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`${API_BASE}/api/templates`)
      .then((r) => r.json())
      .then((data) => { if (!off) setList(data); })
      .catch((err) => { if (!off) setError(err.message); });
    getFavorites().then((favs) => { if (!off) setFavorites(favs); });
    return () => { off = true; };
  }, []);

  // Pull-to-refresh — drops the cached list so the loader state shows
  // while the templates + favorites round trip is in flight. Errors
  // surface to the existing errorCard banner rather than crashing the
  // spinner.
  const handleRefresh = async () => {
    setRefreshing(true);
    setList(null);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/templates`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setList(data);
      setFavorites(await getFavorites());
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Optimistic toggle — UI flips immediately, storage syncs in the
  // background. AsyncStorage write failures are non-fatal (the next
  // launch just rehydrates whatever was last persisted).
  const handleToggleFav = (id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toggleFavorite(id).catch(() => {});
  };

  const addToWorkshop = async (tpl) => {
    setAdding(tpl.id);
    try {
      const resp = await fetch(`${API_BASE}/api/templates/${tpl.id}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const full = await resp.json();
      await saveProject({
        name:         full.name,
        source:       'template',
        difficulty:   full.difficulty,
        width:        full.width,
        height:       full.height,
        grid:         full.grid,
        colors:       full.colors,
        completed:    {},
        imageDataUri: full.imageDataUri,
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

  const visible = list
    ? (tab === 'fav' ? list.filter((t) => favorites.has(t.id)) : list)
    : null;

  const grouped = visible ? {
    easy:   visible.filter((t) => t.difficulty === 'easy'),
    medium: visible.filter((t) => t.difficulty === 'medium'),
    hard:   visible.filter((t) => t.difficulty === 'hard'),
  } : null;

  const favCount = list ? list.filter((t) => favorites.has(t.id)).length : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <View style={styles.topBar}>
        <SpringIconBtn onPress={onBack}><ChevronLeftIcon/></SpringIconBtn>
        <Text style={styles.topTitle}>Koleksiyon</Text>
        <View style={styles.topBarSpacer}/>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={T.mauve}
            colors={[T.mauve]}
          />
        }
      >
        <Text style={styles.heading}>Hazır Desenler</Text>
        <Text style={styles.sub}>Zorluk seviyesine göre seç, atölyene ekle, işlemeye başla</Text>

        <View style={styles.tabsRow}>
          <TabBtn label="Hepsi" active={tab === 'all'} onPress={() => setTab('all')}/>
          <TabBtn label={`Favori (${favCount})`} active={tab === 'fav'} onPress={() => setTab('fav')}/>
        </View>

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

        {grouped && tab === 'fav' && favCount === 0 && (
          <View style={styles.favEmpty}>
            <Text style={styles.favEmptyTitle}>Henüz favorin yok</Text>
            <Text style={styles.favEmptyDesc}>
              Bir desen kartının sağ üstündeki kalbe dokun — buraya gelir.
            </Text>
          </View>
        )}

        {grouped && ['easy', 'medium', 'hard'].map((diff) => {
          if (grouped[diff].length === 0) return null;
          return (
            <View key={diff} style={styles.section}>
              <View style={styles.sectionHead}>
                <Glass tone={DIFF_TONE[diff]} radius={R.pill} intensity={45} style={styles.diffBadge}>
                  <Text style={[styles.diffBadgeTxt, { color: DIFF_FG[diff] }]}>{DIFF_LABEL[diff]}</Text>
                </Glass>
                <Text style={styles.sectionCount}>{grouped[diff].length} desen</Text>
              </View>
              <View style={styles.cards}>
                {grouped[diff].map((tpl) => (
                  <SpringCard
                    key={tpl.id}
                    tpl={tpl}
                    adding={adding === tpl.id}
                    onAdd={() => addToWorkshop(tpl)}
                    isFavorite={favorites.has(tpl.id)}
                    onToggleFav={() => handleToggleFav(tpl.id)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Card has its own spring scale so the whole tile feels physical on tap.
function SpringCard({ tpl, adding, onAdd, isFavorite, onToggleFav }) {
  const scale = useRef(new Animated.Value(1)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(fade, { ...SPRING.gentle, toValue: 1 }).start();
  }, []);

  // Tiny bounce on the heart when toggled — gives the favourite gesture
  // a "click" without a sound. SPRING.bouncy lifts to 1.18 then settles
  // back; SPRING.snappy pulls it down on the way in so it doesn't drift.
  const onHeartPress = () => {
    Animated.sequence([
      Animated.spring(heartScale, { ...SPRING.snappy, toValue: 0.85 }),
      Animated.spring(heartScale, { ...SPRING.bouncy, toValue: 1 }),
    ]).start();
    onToggleFav?.();
  };

  return (
    <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
      <Glass tone="light" radius={R.expressive} intensity={45} style={styles.card}>
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
          onPress={onAdd}
          disabled={adding}
          activeOpacity={1}
          onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.98 }).start()}
          onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
        >
          <View style={styles.addBtn}>
            {adding
              ? <ActivityIndicator size="small" color="#fff"/>
              : <Text style={styles.addBtnTxt}>Atölyeme Ekle</Text>}
          </View>
        </TouchableOpacity>
      </Glass>

      {/* Heart lives outside the Glass so its absolute position measures
          from the card's outer edge, not the Glass content's padding
          box. Sibling of the addBtn touchable (not nested), so neither
          gesture swallows the other. */}
      <TouchableOpacity
        onPress={onHeartPress}
        hitSlop={10}
        activeOpacity={0.7}
        style={styles.heartBtn}
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'Favoriden çıkar' : 'Favoriye ekle'}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <HeartIcon filled={isFavorite}/>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function TabBtn({ label, active, onPress }) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabTxt, styles.tabTxtActive]}>{label}</Text>
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Glass tone="light" radius={R.pill} intensity={30} style={styles.tab}>
        <Text style={styles.tabTxt}>{label}</Text>
      </Glass>
    </TouchableOpacity>
  );
}

function HeartIcon({ filled, size = 22 }) {
  // Feather-style heart — same line-weight + corner family as the rest
  // of the icon set. Filled uses brand mauve; outline drops to inkSoft
  // so it reads as "available action" not "active state".
  const d = "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        fill={filled ? T.mauve : 'none'}
        stroke={filled ? T.mauve : T.inkSoft}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SpringIconBtn({ children, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.92 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Glass tone="light" radius={R.medium} intensity={40} style={styles.iconBtn}>
          {children}
        </Glass>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ChevronLeftIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.surfacePrimary, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  topBarSpacer: { width: 40 },

  scroll: { padding: 20, paddingTop: 4 },
  heading: { fontSize: 26, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.6 },
  sub:     { fontSize: 13, fontFamily: F.regular, color: S.textSecondary, marginTop: 4, marginBottom: 18, lineHeight: 20 },

  errorCard: { backgroundColor: T.errorBg, padding: 14, borderRadius: R.medium, marginVertical: 10 },
  errorTxt:  { fontSize: 13, fontFamily: F.regular, color: S.textDanger, lineHeight: 20 },

  loading: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingTxt: { fontSize: 13, fontFamily: F.regular, color: S.textSecondary },

  section: { marginBottom: 24 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  diffBadge: { paddingHorizontal: 14, paddingVertical: 5 },
  diffBadgeTxt: { fontSize: 12, fontFamily: F.bold, letterSpacing: 0.3 },
  sectionCount: { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary },

  cards: { gap: 12 },
  card: {
    padding: 16,
    shadowColor: T.ink, shadowOpacity: 0.04, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  swatchRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  swatch:    { width: 24, height: 24, borderRadius: R.small, borderWidth: 1, borderColor: T.line },
  cardTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  cardMeta:  { fontSize: 12, fontFamily: F.regular, color: S.textTertiary, marginTop: 2, marginBottom: 12, lineHeight: 18 },
  addBtn: {
    backgroundColor: S.surfaceBrand,
    paddingVertical: 11, borderRadius: R.pill,
    alignItems: 'center',
    shadowColor: T.mauveDeep, shadowOpacity: 0.2,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  addBtnTxt: { fontFamily: F.bold, color: S.textOnBrand, fontSize: 14, letterSpacing: 0.2 },

  // ── Tabs ──
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: S.surfaceBrand,
    borderRadius: R.pill,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabTxt: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
  tabTxtActive: {
    color: S.textOnBrand,
    fontFamily: F.bold,
  },

  // ── Heart button ──
  // Absolute inside the card's Glass content; sits in the corner just
  // inside the Glass border thanks to the card's padding 16.
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Favorite-tab empty state ──
  favEmpty: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  favEmptyTitle: {
    fontSize: 16, fontFamily: F.bold,
    color: S.textPrimary, letterSpacing: -0.2,
  },
  favEmptyDesc: {
    fontSize: 13, fontFamily: F.regular,
    color: S.textSecondary, marginTop: 6,
    textAlign: 'center', lineHeight: 20,
  },
});
