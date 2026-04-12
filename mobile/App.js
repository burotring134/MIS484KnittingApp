import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';

import ImageUploader  from './components/ImageUploader';
import PatternGrid    from './components/PatternGrid';
import ColorLegend    from './components/ColorLegend';
import LoadingSpinner from './components/LoadingSpinner';
import { API_BASE }   from './config';

// ── Design tokens (Stitch design system) ────────────────────────────────────
export const C = {
  primary:          '#006c52',
  primaryDim:       '#005f47',
  primaryContainer: '#8ff6cf',
  onPrimary:        '#e5fff1',
  surface:          '#fbf9f5',
  surfaceLowest:    '#ffffff',
  surfaceLow:       '#f5f4ef',
  surfaceMid:       '#efeee9',
  surfaceHigh:      '#e9e8e3',
  surfaceHighest:   '#e3e3dc',
  onSurface:        '#31332f',
  onSurfaceVar:     '#5e605b',
  outlineVar:       '#b2b2ad',
  tertiaryContainer:'#b8dffd',
  secondaryContainer:'#f2cead',
  error:            '#a83836',
};

const NAV_TABS = [
  { key: 'home',    icon: '✦',  label: 'Create'  },
  { key: 'library', icon: '⊞',  label: 'Library' },
  { key: 'palette', icon: '◉',  label: 'Palette' },
  { key: 'settings',icon: '⚙',  label: 'Settings'},
];

export default function App() {
  const [pattern,     setPattern]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [previewUri,  setPreviewUri]  = useState(null);
  const [imageAsset,  setImageAsset]  = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const [activeTab,   setActiveTab]   = useState('home');

  const handleGenerate = async () => {
    if (!imageAsset) return;
    setLoading(true);
    setError(null);
    setPattern(null);
    setHighlighted(null);

    const fd = new FormData();
    fd.append('image', {
      uri:  imageAsset.uri,
      type: imageAsset.mimeType || 'image/jpeg',
      name: imageAsset.fileName  || 'photo.jpg',
    });
    fd.append('gridSize',  '50');
    fd.append('numColors', '12');

    try {
      const resp = await fetch(`${API_BASE}/api/pattern`, {
        method:  'POST',
        body:    fd,
        headers: {
          'Content-Type': 'multipart/form-data',
          'ngrok-skip-browser-warning': 'true',
        },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${resp.status}`);
      }
      setPattern(await resp.json());
    } catch (err) {
      setError(err.message || 'Bağlantı hatası. config.js adresini kontrol et.');
    } finally {
      setLoading(false);
    }
  };

  const toggleHighlight = (id) =>
    setHighlighted((prev) => (prev === id ? null : id));

  const showEmpty = !pattern && !loading && !error;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerGrid}>⊞</Text>
          <Text style={styles.headerTitle}>Threadia</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>T</Text>
        </View>
      </View>

      {/* ── Body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Upload hero */}
        <ImageUploader
          onImageSelected={(asset) => {
            setImageAsset(asset);
            setPreviewUri(asset.uri);
            setPattern(null);
            setError(null);
          }}
          previewUri={previewUri}
          onGenerate={handleGenerate}
          loading={loading}
          hasImage={!!imageAsset}
        />

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTxt}>⚠  {error}</Text>
          </View>
        )}

        {/* Loading */}
        {loading && <LoadingSpinner />}

        {/* Pattern result */}
        {pattern && !loading && (
          <>
            {/* Result header */}
            <View style={styles.resultHead}>
              <View>
                <Text style={styles.resultTitle}>Pattern</Text>
                <Text style={styles.resultSub}>
                  Generated AI Pattern · {pattern.width}×{pattern.height}
                </Text>
              </View>
              <View style={styles.statsBadge}>
                <Text style={styles.statsNum}>{(pattern.width * pattern.height).toLocaleString()}</Text>
                <Text style={styles.statsLabel}>stitches</Text>
              </View>
            </View>

            {/* Stitch details strip */}
            <View style={styles.detailsStrip}>
              {[
                { label: 'Total Stitches', val: (pattern.width * pattern.height).toLocaleString() },
                { label: 'Colors Used',    val: `${pattern.colors.length} DMC`                   },
                { label: 'Grid Size',      val: `${pattern.width}×${pattern.height}`              },
              ].map((item) => (
                <View key={item.label} style={styles.detailItem}>
                  <Text style={styles.detailVal}>{item.val}</Text>
                  <Text style={styles.detailLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <PatternGrid
              grid={pattern.grid}
              colors={pattern.colors}
              width={pattern.width}
              height={pattern.height}
              highlighted={highlighted}
            />

            <ColorLegend
              colors={pattern.colors}
              highlighted={highlighted}
              onHighlight={toggleHighlight}
            />
          </>
        )}

        {/* Empty / How it works */}
        {showEmpty && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerTxt}>HOW IT WORKS</Text>
              <View style={styles.dividerLine} />
            </View>

            {[
              { icon: '📁', step: '1. Upload',     desc: 'Choose any photo from your library or snap a fresh shot.' },
              { icon: '✨', step: '2. AI Process', desc: 'Our neural engine maps every pixel to the perfect thread color.' },
              { icon: '⊞', step: '3. Stitch',     desc: 'Follow the printable grid with your DMC thread list.' },
            ].map((item) => (
              <View key={item.step} style={styles.stepCard}>
                <View style={styles.stepIconWrap}>
                  <Text style={styles.stepIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.stepTitle}>{item.step}</Text>
                <Text style={styles.stepDesc}>{item.desc}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom Navigation ── */}
      <View style={styles.nav}>
        {NAV_TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, active && styles.navIconActive]}>
                {tab.icon}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.surface,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  // Header
  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 24,
    paddingVertical:   18,
    backgroundColor:  'rgba(251,249,245,0.92)',
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerGrid:  { fontSize: 20, color: C.primary },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.primary, letterSpacing: -0.8 },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.primaryContainer,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: C.primary },

  // Scroll
  scroll: { flex: 1 },
  body:   { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  // Error
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius:    20,
    padding:         18,
  },
  errorTxt: { fontSize: 13, color: C.error, lineHeight: 20 },

  // Result header
  resultHead: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    paddingTop:     8,
  },
  resultTitle: { fontSize: 28, fontWeight: '900', color: C.onSurface, letterSpacing: -1 },
  resultSub:   { fontSize: 12, color: C.onSurfaceVar, marginTop: 2 },
  statsBadge: {
    backgroundColor: C.primaryContainer,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:    8,
    alignItems:      'center',
  },
  statsNum:   { fontSize: 16, fontWeight: '900', color: C.primary },
  statsLabel: { fontSize: 9,  fontWeight: '600', color: C.primaryDim, letterSpacing: 0.5 },

  // Details strip
  detailsStrip: {
    flexDirection:   'row',
    backgroundColor: C.surfaceLowest,
    borderRadius:    24,
    padding:         20,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.04,
    shadowRadius:    24,
    shadowOffset:    { width: 0, height: 8 },
    elevation:       2,
  },
  detailItem:  { flex: 1, alignItems: 'center', gap: 2 },
  detailVal:   { fontSize: 15, fontWeight: '800', color: C.primary },
  detailLabel: { fontSize: 10, color: C.onSurfaceVar, textAlign: 'center' },

  // How it works divider
  divider: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginTop:     8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.outlineVar, opacity: 0.3 },
  dividerTxt:  { fontSize: 10, fontWeight: '700', color: C.onSurfaceVar, opacity: 0.5, letterSpacing: 2 },

  // Step cards
  stepCard: {
    backgroundColor: C.surfaceLow,
    borderRadius:    24,
    padding:         28,
    alignItems:      'center',
    gap:             8,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.03,
    shadowRadius:    20,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       1,
  },
  stepIconWrap: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: C.surfaceHigh,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    4,
  },
  stepIcon:  { fontSize: 28 },
  stepTitle: { fontSize: 17, fontWeight: '800', color: C.onSurface, letterSpacing: -0.3 },
  stepDesc:  { fontSize: 13, color: C.onSurfaceVar, textAlign: 'center', lineHeight: 20 },

  // Bottom nav
  nav: {
    flexDirection:   'row',
    justifyContent:  'space-around',
    alignItems:      'center',
    backgroundColor: 'rgba(251,249,245,0.92)',
    paddingBottom:   Platform.OS === 'ios' ? 20 : 12,
    paddingTop:      14,
    borderTopLeftRadius:  40,
    borderTopRightRadius: 40,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.04,
    shadowRadius:    20,
    shadowOffset:    { width: 0, height: -8 },
    elevation:       8,
  },
  navItem: {
    width:           52,
    height:          52,
    borderRadius:    26,
    alignItems:      'center',
    justifyContent:  'center',
  },
  navItemActive: {
    backgroundColor: C.primaryContainer,
  },
  navIcon:       { fontSize: 22, color: C.onSurfaceVar },
  navIconActive: { color: C.primary },
});
