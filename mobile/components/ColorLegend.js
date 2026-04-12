import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
} from 'react-native';

const C = {
  primary:          '#006c52',
  primaryContainer: '#8ff6cf',
  surface:          '#fbf9f5',
  surfaceLowest:    '#ffffff',
  surfaceLow:       '#f5f4ef',
  surfaceMid:       '#efeee9',
  onSurface:        '#31332f',
  onSurfaceVar:     '#5e605b',
  outlineVar:       '#b2b2ad',
  secondaryContainer: '#f2cead',
  onSecondaryContainer: '#523b23',
};

export default function ColorLegend({ colors, highlighted, onHighlight }) {
  const [search, setSearch] = useState('');
  const totalStitches = colors.reduce((s, c) => s + c.count, 0);

  const filtered = colors.filter(
    (c) =>
      c.dmcCode?.toLowerCase().includes(search.toLowerCase()) ||
      c.dmcName?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item: color }) => {
    const pct          = totalStitches > 0 ? (color.count / totalStitches) * 100 : 0;
    const isHighlighted = highlighted === color.id;

    return (
      <TouchableOpacity
        style={[styles.row, isHighlighted && styles.rowActive]}
        onPress={() => onHighlight(color.id)}
        activeOpacity={0.7}
      >
        {/* Double-circle swatch */}
        <View style={[styles.swatchOuter, { backgroundColor: (color.dmcHex || '#ccc') + '28' }]}>
          <View style={[styles.swatchInner, { backgroundColor: color.dmcHex || '#ccc' }]}>
            {color.symbol && (
              <Text style={styles.swatchSym}>{color.symbol}</Text>
            )}
          </View>
        </View>

        {/* Labels */}
        <View style={styles.info}>
          <View style={styles.codeRow}>
            <Text style={styles.code}>DMC {color.dmcCode}</Text>
            <View style={styles.countChip}>
              <Text style={styles.countChipTxt}>{color.count.toLocaleString()}</Text>
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>{color.dmcName}</Text>
        </View>

        {/* Percentage */}
        <Text style={styles.pct}>{pct.toFixed(1)}%</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHead}>
        <Text style={styles.title}>Thread Palette</Text>
        <TouchableOpacity style={styles.exportBtn} activeOpacity={0.7}>
          <Text style={styles.exportTxt}>↓  Export PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⊙</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search DMC code or name…"
          placeholderTextColor={C.outlineVar}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(c) => String(c.id)}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>"{search}" bulunamadı</Text>
        }
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerTxt}>{colors.length} colors total</Text>
        <Text style={styles.footerTxt}>{totalStitches.toLocaleString()} stitches</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius:    32,
    padding:         24,
    gap:             16,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.04,
    shadowRadius:    32,
    shadowOffset:    { width: 0, height: 10 },
    elevation:       3,
  },

  cardHead: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  title: { fontSize: 22, fontWeight: '900', color: C.onSurface, letterSpacing: -0.5 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportTxt: { fontSize: 13, fontWeight: '700', color: C.primary },

  searchWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    backgroundColor: C.surfaceLow,
    borderRadius:    9999,
    paddingHorizontal: 18,
    paddingVertical:   12,
  },
  searchIcon:  { fontSize: 16, color: C.outlineVar },
  searchInput: { flex: 1, fontSize: 14, color: C.onSurface },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius:    20,
  },
  rowActive: { backgroundColor: C.surfaceLow },

  swatchOuter: {
    width:           56,
    height:          56,
    borderRadius:    28,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  swatchInner: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
  },
  swatchSym: { fontSize: 16, fontWeight: '700', color: 'rgba(0,0,0,0.50)' },

  info:    { flex: 1, gap: 3 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code:    { fontSize: 14, fontWeight: '800', color: C.onSurface },
  countChip: {
    backgroundColor:   C.secondaryContainer,
    borderRadius:      9999,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  countChipTxt: { fontSize: 10, fontWeight: '900', color: C.onSecondaryContainer },
  name:    { fontSize: 12, color: C.onSurfaceVar },

  pct: { fontSize: 12, fontWeight: '700', color: C.primary, minWidth: 36, textAlign: 'right' },

  sep:   { height: 1, backgroundColor: C.surfaceLow, marginHorizontal: 8 },
  empty: { textAlign: 'center', color: C.outlineVar, fontSize: 13, paddingVertical: 16 },

  footer: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingTop:     12,
    borderTopWidth: 1,
    borderTopColor: C.surfaceMid,
  },
  footerTxt: { fontSize: 11, color: C.outlineVar },
});
