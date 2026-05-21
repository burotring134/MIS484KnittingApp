import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import Glass from './Glass';

// Post-denial rationale. Fires only when the OS won't re-surface its
// own permission dialog (iOS hard denial — `canAskAgain` is false).
// The sheet's only job at this point is to explain why we're routing
// the user out of the app into Settings, since the in-app prompt has
// no path left to grant the permission.
//
// The first-time / pre-prompt rationale was removed: the user already
// tapped the camera or gallery button, so interposing a custom sheet
// before the OS prompt was just an extra tap. ensurePermission in
// App.js now fires the OS dialog directly on first use.
//
// Shape mirrors WorkshopScreen's ActionSheet (sibling scrim, glass
// bottom sheet, intensity 70) so the sheet language stays consistent
// across the app.

// Derived at render time from the live i18n strings (via useLanguage) so
// a language switch flips the sheet copy without a remount. Keeps the
// structure of the original COPY object so the lookup
// `COPY[kind]?.[mode]` still drives which copy block renders. `mode` is
// always 'settings' now, but the nested shape is preserved so a future
// mode (e.g. partial access on iOS 14+) can slot in without a refactor.
function buildCopy(strings) {
  return {
    camera: {
      settings: {
        title:   strings.permCameraSettingsTitle,
        body:    strings.permCameraSettingsBody,
        primary: strings.permSettingsLabel,
      },
    },
    gallery: {
      settings: {
        title:   strings.permGallerySettingsTitle,
        body:    strings.permGallerySettingsBody,
        primary: strings.permSettingsLabel,
      },
    },
  };
}

export default function PermissionPrimer({ visible, kind, mode, onPrimary, onDismiss }) {
  const { strings } = useLanguage();
  const COPY = buildCopy(strings);
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
            accessibilityLabel={strings.notNow}
          >
            <Text style={styles.ghostTxt}>{strings.notNow}</Text>
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
