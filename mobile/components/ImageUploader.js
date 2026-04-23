import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const C = {
  primary:          '#006c52',
  primaryContainer: '#8ff6cf',
  onPrimary:        '#e5fff1',
  surface:          '#fbf9f5',
  surfaceLowest:    '#ffffff',
  surfaceLow:       '#f5f4ef',
  surfaceMid:       '#efeee9',
  surfaceHigh:      '#e9e8e3',
  onSurface:        '#31332f',
  onSurfaceVar:     '#5e605b',
  outlineVar:       '#b2b2ad',
};

export default function ImageUploader({
  onImageSelected,
  previewUri,
  onGenerate,
  loading,
  hasImage,
}) {
  const [picking, setPicking] = useState(false);

  const pickFromLibrary = async () => {
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ayarlardan fotoğraf kütüphanesi erişimine izin ver.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]) onImageSelected(result.assets[0]);
    } catch (err) {
      Alert.alert('Hata', err.message);
    } finally {
      setPicking(false);
    }
  };

  const takePhoto = async () => {
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ayarlardan kamera erişimine izin ver.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 });
      if (!result.canceled && result.assets?.[0]) onImageSelected(result.assets[0]);
    } catch (err) {
      Alert.alert('Hata', err.message);
    } finally {
      setPicking(false);
    }
  };

  // ── With preview ───────────────────────────────────────────────────────────
  if (previewUri) {
    return (
      <View style={styles.previewCard}>
        <View style={styles.previewImgWrap}>
          <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="cover" />
          <View style={styles.previewOverlay}>
            <TouchableOpacity style={styles.changeBtn} onPress={pickFromLibrary} activeOpacity={0.85}>
              <Text style={styles.changeTxt}>Fotoğrafı Değiştir</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.genBtn, loading && styles.genBtnLoading]}
          onPress={onGenerate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={C.onPrimary} size="small" />
          ) : (
            <Text style={styles.genTxt}>Kanaviçe Pattern Oluştur</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Upload hero ────────────────────────────────────────────────────────────
  return (
    <View style={styles.hero}>
      {/* Dot grid decoration */}
      <View style={styles.dotGrid} pointerEvents="none">
        {Array.from({ length: 80 }).map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>

      <View style={styles.heroContent}>
        <Text style={styles.heroHeadline}>
          Turn memories{'\n'}into <Text style={styles.heroAccent}>stitches</Text>
        </Text>
        <Text style={styles.heroSub}>
          Upload a photo to generate a personalized{'\n'}AI cross-stitch pattern in seconds.
        </Text>

        {picking ? (
          <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 16 }} />
        ) : (
          <View style={styles.heroBtns}>
            <TouchableOpacity style={styles.primaryBtn} onPress={pickFromLibrary} activeOpacity={0.85}>
              <Text style={styles.primaryBtnTxt}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={takePhoto} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnTxt}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: {
    borderRadius:    32,
    overflow:        'hidden',
    backgroundColor: C.surfaceLow,
    minHeight:       300,
    justifyContent:  'center',
    shadowColor:     C.onSurface,
    shadowOpacity:   0.04,
    shadowRadius:    32,
    shadowOffset:    { width: 0, height: 12 },
    elevation:       3,
  },
  dotGrid: {
    position:   'absolute',
    top:        0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    flexWrap:   'wrap',
    opacity:    0.06,
    padding:    12,
    gap:        14,
  },
  dot: {
    width:         4,
    height:        4,
    borderRadius:  2,
    backgroundColor: C.primary,
  },

  heroContent: {
    paddingHorizontal: 32,
    paddingVertical:   40,
    alignItems:        'center',
    gap:               12,
  },
  heroHeadline: {
    fontSize:    36,
    fontWeight:  '900',
    color:       C.onSurface,
    textAlign:   'center',
    letterSpacing: -1,
    lineHeight:  42,
  },
  heroAccent: { color: C.primary, fontStyle: 'italic' },
  heroSub: {
    fontSize:   14,
    color:      C.onSurfaceVar,
    textAlign:  'center',
    lineHeight: 21,
  },

  heroBtns: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     8,
  },
  primaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: C.primary,
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderRadius:    9999,
    shadowColor:     C.primary,
    shadowOpacity:   0.30,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       6,
  },
  primaryBtnTxt:  { fontSize: 15, fontWeight: '700', color: C.onPrimary },

  secondaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: C.surfaceLowest,
    paddingHorizontal: 24,
    paddingVertical:   14,
    borderRadius:    9999,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.05,
    shadowRadius:    10,
    shadowOffset:    { width: 0, height: 3 },
    elevation:       2,
  },
  secondaryBtnTxt:  { fontSize: 15, fontWeight: '700', color: C.onSurface },

  // ── Preview ──────────────────────────────────────────────────────────────────
  previewCard: {
    borderRadius:    32,
    overflow:        'hidden',
    gap:             0,
    shadowColor:     C.onSurface,
    shadowOpacity:   0.05,
    shadowRadius:    32,
    shadowOffset:    { width: 0, height: 12 },
    elevation:       4,
  },
  previewImgWrap: { height: 260, position: 'relative' },
  previewImg:     { width: '100%', height: '100%' },
  previewOverlay: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(49,51,47,0.25)',
    alignItems:      'flex-end',
  },
  changeBtn: {
    backgroundColor:   'rgba(255,255,255,0.92)',
    borderRadius:      9999,
    paddingHorizontal: 16,
    paddingVertical:    7,
  },
  changeTxt: { fontSize: 12, fontWeight: '700', color: C.primary },

  // Generate button
  genBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: C.primary,
    paddingVertical: 18,
    borderBottomLeftRadius:  32,
    borderBottomRightRadius: 32,
    shadowColor:     C.primary,
    shadowOpacity:   0.28,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 6 },
    elevation:       6,
  },
  genBtnLoading: { backgroundColor: C.onSurfaceVar },
  genTxt:  { fontSize: 16, fontWeight: '800', color: C.onPrimary, letterSpacing: -0.2 },
});
