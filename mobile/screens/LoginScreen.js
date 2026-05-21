import { useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, Image, Platform,
  TouchableOpacity,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T, F, S, R } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getProjectIdsForClaim } from '../utils/storage';
import * as haptics from '../utils/haptics';

// Sign-in gate. Mounted by App.js whenever there is no persisted token.
// On success the auth context updates and App.js re-renders into the
// usual welcome/home flow. Apple is the only provider for now — the
// privacy line below is intentional copy so a first-time user knows
// what we'll do with the credential.
export default function LoginScreen() {
  const { strings } = useLanguage();
  const { signInWithApple, devSkipLogin } = useAuth();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const handleApple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert(strings.loginUnsupportedTitle, strings.loginUnsupportedBody);
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      // Locally-stored anonymous project ids. They'll be claimed under
      // the new account on the backend in a single transaction so the
      // user's workshop survives the cutover.
      const claimProjectIds = await getProjectIdsForClaim().catch(() => []);

      haptics.success();
      await signInWithApple({
        identityToken: credential.identityToken,
        fullName: credential.fullName,
        claimProjectIds,
      });
      // No setBusy(false) — once we sign in, App.js unmounts this
      // screen, so flipping local state would just race with the
      // unmount.
    } catch (err) {
      // The Apple sheet's cancel button raises an ERR_REQUEST_CANCELED;
      // that's user intent, not a failure, so we swallow it silently.
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        setBusy(false);
        return;
      }
      console.log('[LoginScreen] apple sign-in failed:', err?.message);
      Alert.alert(strings.loginFailedTitle, strings.loginFailedBody);
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.hero}>
        <Image
          source={require('../assets/favicon_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Threadia</Text>
        <Text style={styles.tagline}>{strings.loginTagline}</Text>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.subtitle}>{strings.loginSubtitle}</Text>

        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={R.pill}
            style={styles.appleBtn}
            onPress={handleApple}
          />
        ) : null}

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={T.mauve} />
            <Text style={styles.busyTxt}>{strings.loginCheckingSession}</Text>
          </View>
        ) : null}

        <Text style={styles.privacy}>{strings.loginPrivacyNote}</Text>

        {__DEV__ ? (
          <TouchableOpacity
            onPress={devSkipLogin}
            activeOpacity={0.6}
            style={styles.devSkip}
            accessibilityLabel="Developer: skip login"
          >
            <Text style={styles.devSkipTxt}>dev · skip login</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 14,
    fontFamily: F.regular,
    color: S.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  bottom: {
    gap: 14,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: F.regular,
    color: S.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  appleBtn: {
    height: 52,
    width: '100%',
  },
  busy: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyTxt: {
    fontSize: 13,
    fontFamily: F.regular,
    color: S.textSecondary,
  },
  privacy: {
    fontSize: 12,
    fontFamily: F.regular,
    color: S.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    opacity: 0.85,
  },
  // Dev-only escape hatch — visible only in development builds (Expo Go,
  // dev clients). The button compiles out of release bundles because
  // Metro/Babel strip `__DEV__ ? ... : null` branches when minifying.
  devSkip: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devSkipTxt: {
    fontSize: 11,
    fontFamily: F.regular,
    color: S.textTertiary,
    letterSpacing: 0.4,
    opacity: 0.6,
  },
});
