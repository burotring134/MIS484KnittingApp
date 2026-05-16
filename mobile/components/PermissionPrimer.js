import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R } from '../utils/theme';
import Glass from './Glass';

// Pre-prompt privacy rationale that fires before the OS permission
// dialog the first time the user reaches for the camera or photo
// library. After a hard denial, the same sheet recasts itself as a
// route into iOS Settings — the OS won't re-issue its prompt on iOS,
// so we hand the user the only door that's left.
//
// Shape mirrors WorkshopScreen's ActionSheet (sibling scrim, glass
// bottom sheet, intensity 70) so the sheet language stays consistent
// across the app.
//
// Copy:
//  - `camera + prime`   uses the spec-verbatim title/body.
//  - `gallery + prime`  is the natural adaptation — "albümünden seçmek"
//    instead of "fotoğrafına dokunmak" — and the body acknowledges that
//    the *selected* photo is the only data point we touch.
//  - `* + settings`     swaps the title to the spec line and routes the
//    primary CTA to Settings via Linking.openSettings.

const COPY = {
  camera: {
    prime: {
      title:   'Fotoğrafına dokunmak için iznine ihtiyacımız var',
      body:    "Fotoğrafın telefondan ayrılmaz — yalnızca senin için pattern üretmek üzere bir kerelik AI'a gönderilir. Albümlerine, kişilerine veya başka verilerine asla dokunmayız.",
      primary: 'İzin ver',
    },
    settings: {
      title:   'Ayarlardan izin vermen gerek',
      body:    "Önceden reddedildiği için sistem ekranı tekrar açılamaz. Ayarlar'da Threadia'yı bul ve kamera erişimini aç — sonra geri dön.",
      primary: 'Ayarları Aç',
    },
  },
  gallery: {
    prime: {
      title:   'Albümünden fotoğraf seçmek için iznine ihtiyacımız var',
      body:    "Seçtiğin fotoğraf telefondan ayrılmaz — yalnızca senin için pattern üretmek üzere bir kerelik AI'a gönderilir. Diğer albümlerine, kişilerine veya başka verilerine asla dokunmayız.",
      primary: 'İzin ver',
    },
    settings: {
      title:   'Ayarlardan izin vermen gerek',
      body:    "Önceden reddedildiği için sistem ekranı tekrar açılamaz. Ayarlar'da Threadia'yı bul ve fotoğraf erişimini aç — sonra geri dön.",
      primary: 'Ayarları Aç',
    },
  },
};

export default function PermissionPrimer({ visible, kind, mode, onPrimary, onDismiss }) {
  const insets = useSafeAreaInsets();
  const copy = (kind && mode && COPY[kind]?.[mode]) || null;

  return (
    <Modal
      visible={visible && !!copy}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={onDismiss}/>
        <Glass
          tone="light"
          radius={R.large}
          intensity={70}
          blurTint="light"
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}
        >
          <View style={styles.grabber}/>
          <View style={styles.iconBubble}>
            <ShieldIcon/>
          </View>
          <Text style={styles.title}>{copy?.title}</Text>
          <Text style={styles.body}>{copy?.body}</Text>
          <TouchableOpacity
            onPress={onPrimary}
            activeOpacity={0.88}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel={copy?.primary}
          >
            <Text style={styles.primaryTxt}>{copy?.primary}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.7}
            style={styles.ghostBtn}
            accessibilityRole="button"
            accessibilityLabel="Şimdi değil"
          >
            <Text style={styles.ghostTxt}>Şimdi değil</Text>
          </TouchableOpacity>
        </Glass>
      </View>
    </Modal>
  );
}

function ShieldIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
        stroke={T.mauveDeep} strokeWidth="2" strokeLinejoin="round"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke={T.mauveDeep} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    flex: 1,
    backgroundColor: S.glassOverlay,
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 340,
    gap: 10,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: T.line,
    alignSelf: 'center',
    marginBottom: 10,
  },
  iconBubble: {
    width: 46, height: 46,
    borderRadius: R.medium,
    backgroundColor: S.surfaceAccent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  body: {
    fontSize: 13,
    fontFamily: F.regular,
    color: S.textSecondary,
    lineHeight: 21,
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: S.surfaceBrand,
    paddingVertical: 14,
    borderRadius: R.pill,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryTxt: {
    color: S.textOnBrand,
    fontSize: 15,
    fontFamily: F.bold,
    letterSpacing: 0.2,
  },
  ghostBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostTxt: {
    color: S.textSecondary,
    fontSize: 14,
    fontFamily: F.semibold,
    letterSpacing: 0.2,
  },
});
