import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import Svg, { Circle, Path, Line, Ellipse, G } from 'react-native-svg';
import { T } from '../utils/theme';

function NeedleIllustration({ w = 260, h = 160 }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 260 160">
      <Circle cx="60"  cy="70" r="42" fill={T.rose}   opacity="0.55"/>
      <Circle cx="200" cy="90" r="34" fill={T.mint}   opacity="0.7"/>
      <Circle cx="130" cy="40" r="26" fill={T.butter} opacity="0.8"/>
      <Path d="M40 120 C 80 60, 140 40, 190 70 S 250 140, 210 140 S 150 100, 120 120 S 70 150, 40 120 Z"
        stroke={T.mauve} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="1 4"/>
      <G rotation="-28" origin="150, 80">
        <Line x1="80" y1="80" x2="220" y2="80" stroke="#6B5D56" strokeWidth="2" strokeLinecap="round"/>
        <Ellipse cx="82" cy="80" rx="8" ry="4" stroke="#6B5D56" strokeWidth="2" fill="#FFFFFF"/>
        <Line x1="84" y1="80" x2="88" y2="80" stroke="#6B5D56" strokeWidth="1.2"/>
        <Path d="M220 78 L228 80 L220 82 Z" fill="#6B5D56"/>
      </G>
    </Svg>
  );
}

export default function WelcomeScreen({ onContinue }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      <View style={styles.hero}>
        <NeedleIllustration w={280} h={180}/>
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>AI CROSS-STITCH STUDIO</Text>
        <Text style={styles.title}>threadia</Text>
        <Text style={styles.subtitle}>
          Anılarını ilmek ilmek ör.
        </Text>
        <Text style={styles.description}>
          Bir fotoğraf yükle, Threadia onu DMC iplik renklerine eşlenmiş
          yazdırılabilir bir kanaviçe şemasına dönüştürsün. Ya da hazır
          koleksiyondan bir desen seç, işlemeye hemen başla.
        </Text>

        <View style={styles.chipsRow}>
          {['AI ile akıllı', 'Gerçek DMC', 'PDF export', 'Takip modu'].map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipTxt}>{chip}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} onPress={onContinue} activeOpacity={0.85}>
          <Text style={styles.ctaTxt}>Başla</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.cream,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 48,
  },
  hero: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    gap: 14,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: '700',
    color: T.mauveDeep,
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: -2,
    lineHeight: 60,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    color: T.inkSoft,
    lineHeight: 23,
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
  },
  chipTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: T.inkSoft,
  },
  cta: {
    marginTop: 'auto',
    marginBottom: 40,
    backgroundColor: T.mauve,
    paddingVertical: 18,
    borderRadius: 9999,
    alignItems: 'center',
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaTxt: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
