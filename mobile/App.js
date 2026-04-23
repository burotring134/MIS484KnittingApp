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
  { key: 'home',     label: 'Create'  },
  { key: 'palette',  label: 'Palette' },
  { key: 'library',  label: 'Library' },
  { key: 'settings', label: 'Settings'},
];

const GRID_OPTIONS  = [30, 50, 80, 100];
const COLOR_OPTIONS = [8, 12, 16, 20, 25];

export default function App() {
  const [pattern,     setPattern]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [previewUri,  setPreviewUri]  = useState(null);
  const [imageAsset,  setImageAsset]  = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const [activeTab,   setActiveTab]   = useState('home');
  const [gridSize,    setGridSize]    = useState(50);
  const [numColors,   setNumColors]   = useState(12);

  const handleGenerate = async () => {
    if (!imageAsset) return;
    setLoading(true);
    setError(null);
    setPattern(null);
    setHighlighted(null);
    setActiveTab('home');

    const fd = new FormData();
    fd.append('image', {
      uri:  imageAsset.uri,
      type: imageAsset.mimeType || 'image/jpeg',
      name: imageAsset.fileName  || 'photo.jpg',
    });
    fd.append('gridSize',  String(gridSize));
    fd.append('numColors', String(numColors));

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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Threadia</Text>
        <View style={styles.avatar}><Text style={styles.avatarTxt}>T</Text></View>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'home' && (
          <CreateTab
            imageAsset={imageAsset}
            previewUri={previewUri}
            loading={loading}
            error={error}
            pattern={pattern}
            highlighted={highlighted}
            onImageSelected={(asset) => {
              setImageAsset(asset);
              setPreviewUri(asset.uri);
              setPattern(null);
              setError(null);
            }}
            onGenerate={handleGenerate}
            toggleHighlight={toggleHighlight}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            gridSize={gridSize}
            setGridSize={setGridSize}
            numColors={numColors}
            setNumColors={setNumColors}
          />
        )}

        {activeTab === 'palette' && (
          <PaletteTab
            pattern={pattern}
            highlighted={highlighted}
            onHighlight={toggleHighlight}
            goCreate={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'library' && <LibraryTab />}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
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
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ── Create tab ──────────────────────────────────────────────────────────────
function CreateTab({
  imageAsset, previewUri, loading, error, pattern, highlighted,
  onImageSelected, onGenerate, toggleHighlight,
}) {
  return (
    <>
      <ImageUploader
        onImageSelected={onImageSelected}
        previewUri={previewUri}
        onGenerate={onGenerate}
        loading={loading}
        hasImage={!!imageAsset}
      />

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      )}

      {loading && <LoadingSpinner />}

      {pattern && !loading && (
        <>
          <View style={styles.resultHead}>
            <View>
              <Text style={styles.resultTitle}>Pattern</Text>
              <Text style={styles.resultSub}>
                {pattern.width}×{pattern.height} · {pattern.colors.length} colours
              </Text>
            </View>
            <View style={styles.statsBadge}>
              <Text style={styles.statsNum}>{(pattern.width * pattern.height).toLocaleString()}</Text>
              <Text style={styles.statsLabel}>stitches</Text>
            </View>
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

      {!pattern && !loading && !error && (
        <>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerTxt}>HOW IT WORKS</Text>
            <View style={styles.dividerLine} />
          </View>
          {[
            { step: '1. Upload',     desc: 'Choose any photo from your library or snap a fresh shot.' },
            { step: '2. AI Process', desc: 'Our neural engine maps every pixel to the perfect thread color.' },
            { step: '3. Stitch',     desc: 'Follow the printable grid with your DMC thread list.' },
          ].map((item) => (
            <View key={item.step} style={styles.stepCard}>
              <Text style={styles.stepTitle}>{item.step}</Text>
              <Text style={styles.stepDesc}>{item.desc}</Text>
            </View>
          ))}
        </>
      )}
    </>
  );
}

// ── Settings tab ────────────────────────────────────────────────────────────
function SettingsTab({ gridSize, setGridSize, numColors, setNumColors }) {
  return (
    <>
      <Text style={styles.tabHeading}>Settings</Text>
      <Text style={styles.tabSub}>These apply the next time you generate a pattern.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Grid width</Text>
        <Text style={styles.cardHint}>Cells across · more cells = more detail</Text>
        <View style={styles.pickerRow}>
          {GRID_OPTIONS.map((w) => {
            const on = w === gridSize;
            return (
              <TouchableOpacity
                key={w}
                onPress={() => setGridSize(w)}
                style={[styles.picker, on && styles.pickerOn]}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickerTxt, on && styles.pickerTxtOn]}>{w}</Text>
                <Text style={[styles.pickerSub, on && styles.pickerSubOn]}>cells</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Thread colours</Text>
        <Text style={styles.cardHint}>Number of distinct DMC colours</Text>
        <View style={styles.pickerRow}>
          {COLOR_OPTIONS.map((n) => {
            const on = n === numColors;
            return (
              <TouchableOpacity
                key={n}
                onPress={() => setNumColors(n)}
                style={[styles.picker, on && styles.pickerOn]}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickerTxt, on && styles.pickerTxtOn]}>{n}</Text>
                <Text style={[styles.pickerSub, on && styles.pickerSubOn]}>colours</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Recommendations</Text>
        <Text style={styles.tipLine}><Text style={styles.tipBold}>Portraits:</Text> 50–80 cells, 12–16 colours</Text>
        <Text style={styles.tipLine}><Text style={styles.tipBold}>Scenes:</Text> 80–100 cells, 16–25 colours</Text>
        <Text style={styles.tipLine}><Text style={styles.tipBold}>Icons / logos:</Text> 30 cells, 5–10 colours</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLine}>
          API: <Text style={styles.infoMono}>{API_BASE}</Text>
        </Text>
      </View>
    </>
  );
}

// ── Palette tab ─────────────────────────────────────────────────────────────
function PaletteTab({ pattern, highlighted, onHighlight, goCreate }) {
  if (!pattern) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No palette yet</Text>
        <Text style={styles.emptyDesc}>
          Generate a pattern first — your DMC thread palette will appear here.
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={goCreate} activeOpacity={0.85}>
          <Text style={styles.emptyBtnTxt}>Go to Create</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.tabHeading}>Palette</Text>
      <Text style={styles.tabSub}>
        {pattern.colors.length} DMC colours · tap to highlight in the grid
      </Text>
      <ColorLegend
        colors={pattern.colors}
        highlighted={highlighted}
        onHighlight={onHighlight}
      />
    </>
  );
}

// ── Library tab (placeholder) ───────────────────────────────────────────────
function LibraryTab() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Library coming soon</Text>
      <Text style={styles.emptyDesc}>
        Saved patterns will live here. For now, generate one from the Create tab and download the image.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.surface,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 24,
    paddingVertical:   18,
    backgroundColor:  'rgba(251,249,245,0.92)',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.primary, letterSpacing: -0.8 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: C.primary },

  scroll: { flex: 1 },
  body:   { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  errorCard: { backgroundColor: '#fef2f2', borderRadius: 20, padding: 18 },
  errorTxt:  { fontSize: 13, color: C.error, lineHeight: 20 },

  resultHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8,
  },
  resultTitle: { fontSize: 28, fontWeight: '900', color: C.onSurface, letterSpacing: -1 },
  resultSub:   { fontSize: 12, color: C.onSurfaceVar, marginTop: 2 },
  statsBadge: {
    backgroundColor: C.primaryContainer, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center',
  },
  statsNum:   { fontSize: 16, fontWeight: '900', color: C.primary },
  statsLabel: { fontSize: 9,  fontWeight: '600', color: C.primaryDim, letterSpacing: 0.5 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.outlineVar, opacity: 0.3 },
  dividerTxt:  { fontSize: 10, fontWeight: '700', color: C.onSurfaceVar, opacity: 0.5, letterSpacing: 2 },

  stepCard: {
    backgroundColor: C.surfaceLow, borderRadius: 24, padding: 28,
    alignItems: 'center', gap: 8,
    shadowColor: C.onSurface, shadowOpacity: 0.03, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 1,
  },
  stepTitle: { fontSize: 17, fontWeight: '800', color: C.onSurface, letterSpacing: -0.3 },
  stepDesc:  { fontSize: 13, color: C.onSurfaceVar, textAlign: 'center', lineHeight: 20 },

  // ── Tabs (settings / palette / library) ──
  tabHeading: { fontSize: 28, fontWeight: '900', color: C.onSurface, letterSpacing: -0.8, marginTop: 8 },
  tabSub:     { fontSize: 13, color: C.onSurfaceVar, marginTop: 4, marginBottom: 8 },

  card: {
    backgroundColor: C.surfaceLowest, borderRadius: 22, padding: 18,
    shadowColor: C.onSurface, shadowOpacity: 0.04, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardLabel: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  cardHint:  { fontSize: 12, color: C.onSurfaceVar, marginTop: 2 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  picker: {
    flexGrow: 1, minWidth: 64, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    backgroundColor: C.surfaceMid,
  },
  pickerOn:  { backgroundColor: C.primary },
  pickerTxt: { fontSize: 18, fontWeight: '800', color: C.onSurface },
  pickerTxtOn: { color: '#fff' },
  pickerSub: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, color: C.onSurfaceVar, marginTop: 2, textTransform: 'uppercase' },
  pickerSubOn: { color: 'rgba(255,255,255,0.85)' },

  tipsCard: {
    backgroundColor: C.secondaryContainer, borderRadius: 22, padding: 18,
  },
  tipsTitle: { fontSize: 13, fontWeight: '800', color: C.onSurface, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  tipLine:   { fontSize: 13, color: C.onSurface, lineHeight: 22 },
  tipBold:   { fontWeight: '800' },

  infoCard: {
    backgroundColor: C.surfaceLow, borderRadius: 16, padding: 14,
  },
  infoLine: { fontSize: 11, color: C.onSurfaceVar },
  infoMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: C.onSurface },

  emptyState: {
    backgroundColor: C.surfaceLowest, borderRadius: 24, padding: 32, alignItems: 'center',
    marginTop: 40, gap: 12,
    shadowColor: C.onSurface, shadowOpacity: 0.04, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: C.onSurface, letterSpacing: -0.5, textAlign: 'center' },
  emptyDesc:  { fontSize: 14, color: C.onSurfaceVar, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    marginTop: 8, backgroundColor: C.primary,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 9999,
  },
  emptyBtnTxt: { color: C.onPrimary, fontSize: 14, fontWeight: '800' },

  // Bottom nav
  nav: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(251,249,245,0.92)',
    paddingBottom: Platform.OS === 'ios' ? 20 : 12, paddingTop: 14,
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    shadowColor: C.onSurface, shadowOpacity: 0.04, shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 }, elevation: 8,
  },
  navItem: {
    paddingHorizontal: 16, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  navItemActive: { backgroundColor: C.primaryContainer },
  navIcon:       { fontSize: 12, fontWeight: '600', color: C.onSurfaceVar },
  navIconActive: { color: C.primary },
});
