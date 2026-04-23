import { View, Text, TouchableOpacity, Image, StyleSheet, StatusBar, Platform } from 'react-native';
import { T, DIFFICULTIES } from '../utils/theme';

export default function DifficultyScreen({ previewUri, onBack, onPick }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Zorluk Seç</Text>
        <View style={{ width: 60 }}/>
      </View>

      {previewUri && (
        <View style={styles.previewWrap}>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover"/>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.heading}>Bu fotoğraf için ne kadar detay istiyorsun?</Text>
        <Text style={styles.sub}>AI onu seçtiğin seviyeye göre işler</Text>

        <View style={styles.options}>
          {DIFFICULTIES.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={styles.option}
              onPress={() => onPick(d.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.optionSwatch, { backgroundColor: d.tint }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{d.label}</Text>
                <Text style={styles.optionDesc}>{d.desc}</Text>
                <Text style={styles.optionMeta}>{d.gridSize} cell · {d.numColors} renk</Text>
              </View>
              <Text style={styles.optionChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.cream, paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight : 44) },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  backTxt: { fontSize: 16, color: T.mauveDeep, fontWeight: '600' },
  topTitle: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },

  previewWrap: {
    marginHorizontal: 20,
    height: 180,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: T.creamDeep,
  },
  preview: { width: '100%', height: '100%' },

  body: { paddingHorizontal: 20, paddingTop: 22, flex: 1 },
  heading: { fontSize: 22, fontWeight: '800', color: T.ink, letterSpacing: -0.5, lineHeight: 28 },
  sub: { fontSize: 13, color: T.inkSoft, marginTop: 4 },

  options: { marginTop: 22, gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 20,
    padding: 16,
    shadowColor: T.ink,
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  optionSwatch: { width: 44, height: 44, borderRadius: 14 },
  optionLabel: { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  optionDesc:  { fontSize: 12, color: T.inkSoft, marginTop: 2, lineHeight: 16 },
  optionMeta:  { fontSize: 11, color: T.inkMute, fontWeight: '600', marginTop: 6, letterSpacing: 0.3 },
  optionChevron: { fontSize: 26, color: T.inkMute, fontWeight: '300' },
});
