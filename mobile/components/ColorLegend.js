import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T, F, S, R } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import Glass from './Glass';

function SearchIcon({ color = T.inkSoft }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 19a8 8 0 1 1 5.293-14.293A8 8 0 0 1 11 19zm9 1l-4.35-4.35"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Picks a readable text colour for the symbol that sits on top of a
// coloured swatch — dark text on light swatches, light text on dark.
// Mirrors the implementation used by ColorChip in ProjectDetailScreen.
function pickContrast(hex) {
  if (!hex || hex.length < 7) return 'rgba(74,63,63,0.7)';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.65 ? 'rgba(74,63,63,0.7)' : 'rgba(255,255,255,0.95)';
}

export default function ColorLegend({ colors, highlighted, onHighlight }) {
  const { strings } = useLanguage();
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
        <View style={[styles.swatchOuter, { backgroundColor: (color.dmcHex || '#ccc') + '28' }]}>
          <View style={[styles.swatchInner, { backgroundColor: color.dmcHex || '#ccc' }]}>
            {color.symbol && (
              <Text style={[styles.swatchSym, { color: pickContrast(color.dmcHex) }]}>
                {color.symbol}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.codeRow}>
            <Text style={styles.code}>DMC {color.dmcCode}</Text>
            <Glass tone="rose" radius={R.pill} intensity={35} style={styles.countChip}>
              <Text style={styles.countChipTxt}>{color.count.toLocaleString()}</Text>
            </Glass>
          </View>
          <Text style={styles.name} numberOfLines={1}>{color.dmcName}</Text>
        </View>

        <Text style={styles.pct}>{pct.toFixed(1)}%</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Glass tone="light" radius={R.large} intensity={50} style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.title}>{strings.legendTitle}</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchIcon/>
        <TextInput
          style={styles.searchInput}
          placeholder={strings.legendSearchPlaceholder}
          placeholderTextColor={S.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(c) => String(c.id)}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{strings.legendEmptyForSearch(search)}</Text>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.footerTxt}>{strings.legendFooterColors(colors.length)}</Text>
        <Text style={styles.footerTxt}>{strings.legendFooterStitches(totalStitches.toLocaleString())}</Text>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 14,
    shadowColor: T.ink,
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.3 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: S.surfaceSunken,
    borderRadius: R.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: T.line,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular, color: S.textPrimary, padding: 0 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: R.medium,
  },
  rowActive: { backgroundColor: S.surfaceSunken },

  swatchOuter: {
    width: 52,
    height: 52,
    borderRadius: R.medium,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  swatchInner: {
    width: 36,
    height: 36,
    borderRadius: R.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSym: { fontSize: 14, fontFamily: F.bold },

  info:    { flex: 1, gap: 3 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code:    { fontSize: 14, fontFamily: F.bold, color: S.textPrimary },
  countChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countChipTxt: { fontSize: 10, fontFamily: F.bold, color: S.textBrand },
  name:    { fontSize: 12, fontFamily: F.regular, color: S.textSecondary, lineHeight: 18 },

  pct: { fontSize: 12, fontFamily: F.bold, color: S.textBrand, minWidth: 36, textAlign: 'right' },

  sep:   { height: 1, backgroundColor: T.lineSoft, marginHorizontal: 6 },
  empty: { textAlign: 'center', fontFamily: F.regular, color: S.textTertiary, fontSize: 13, paddingVertical: 16, lineHeight: 20 },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  footerTxt: { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary },
});
