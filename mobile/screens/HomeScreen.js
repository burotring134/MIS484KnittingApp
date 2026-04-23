import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { T } from '../utils/theme';

export default function HomeScreen({ projectCount, onTakePhoto, onGallery, onWorkshop, onCollection }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>HOŞGELDİN</Text>
            <Text style={styles.brand}>threadia</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>T</Text></View>
        </View>

        {/* Primary photo actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Pattern</Text>
          <Text style={styles.sectionSub}>Fotoğrafını AI ile kanaviçeye çevir</Text>
        </View>

        <TouchableOpacity style={[styles.heroCard, styles.primaryCard]} onPress={onTakePhoto} activeOpacity={0.9}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconMono}>CAM</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Fotoğraf Çek</Text>
            <Text style={styles.heroDesc}>Kamerayı kullan, anlık bir kare yakala</Text>
          </View>
          <Text style={styles.heroChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.heroCard, styles.softCard]} onPress={onGallery} activeOpacity={0.9}>
          <View style={[styles.heroIcon, styles.heroIconAlt]}>
            <Text style={styles.heroIconMonoAlt}>IMG</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitleDark}>Galeriden Seç</Text>
            <Text style={styles.heroDescDark}>Telefondaki bir fotoğrafı kullan</Text>
          </View>
          <Text style={styles.heroChevronDark}>›</Text>
        </TouchableOpacity>

        <View style={[styles.section, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Keşfet</Text>
          <Text style={styles.sectionSub}>Atölyen ve hazır koleksiyon</Text>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.tile, { backgroundColor: T.lavender }]} onPress={onWorkshop} activeOpacity={0.85}>
            <Text style={styles.tileKicker}>ATÖLYE</Text>
            <Text style={styles.tileTitle}>Projelerim</Text>
            <Text style={styles.tileCount}>{projectCount}</Text>
            <Text style={styles.tileFoot}>kayıtlı proje</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.tile, { backgroundColor: T.butter }]} onPress={onCollection} activeOpacity={0.85}>
            <Text style={styles.tileKicker}>KOLEKSİYON</Text>
            <Text style={styles.tileTitle}>Hazır Desenler</Text>
            <Text style={styles.tileCount}>9</Text>
            <Text style={styles.tileFoot}>şablon · Kolay/Orta/Zor</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.cream },
  scroll: {
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight : 40) + 8,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    color: T.mauveDeep,
  },
  brand: {
    fontSize: 34,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: -1.2,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 16, fontWeight: '800', color: T.mauveDeep },

  section: {
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.4,
  },
  sectionSub: {
    fontSize: 13,
    color: T.inkSoft,
    marginTop: 2,
  },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: T.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryCard: { backgroundColor: T.mauve },
  softCard: { backgroundColor: T.paper, borderWidth: 1, borderColor: T.line },

  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconAlt: {
    backgroundColor: T.rose,
  },
  heroIconMono:    { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#fff' },
  heroIconMonoAlt: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: T.mauveDeep },

  heroTitle:     { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroDesc:      { fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  heroChevron:   { fontSize: 28, color: 'rgba(255,255,255,0.8)', fontWeight: '300' },

  heroTitleDark:   { fontSize: 17, fontWeight: '800', color: T.ink, letterSpacing: -0.3 },
  heroDescDark:    { fontSize: 13, color: T.inkSoft, marginTop: 2 },
  heroChevronDark: { fontSize: 28, color: T.inkMute, fontWeight: '300' },

  row: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    minHeight: 140,
    shadowColor: T.ink,
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tileKicker: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '800',
    color: T.mauveDeep,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  tileCount: {
    fontSize: 36,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: -1.5,
    marginTop: 12,
  },
  tileFoot: {
    fontSize: 11,
    color: T.inkSoft,
    marginTop: -2,
  },
});
