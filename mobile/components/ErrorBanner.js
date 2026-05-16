import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T, F, S, R, SPRING } from '../utils/theme';
import Glass from './Glass';

const AUTO_DISMISS_MS = 5000;

// ErrorBanner — inline glass-rose strip used at the top of screens to
// surface recoverable errors without taking the user out of context.
// Slides down from above on mount, optionally auto-dismisses after
// 5 s, and offers a "Tekrar Dene" pill when the caller knows how to
// retry. Glass.js's flex-collapse trap is avoided here via the row's
// explicit `minHeight` floor.
//
// Props:
//   title       — bold one-liner ("Sunucu uzak")
//   message     — regular helper text (can wrap)
//   onRetry?    — when provided, shows the retry pill
//   onDismiss?  — when provided, shows the × close button AND enables
//                 the 5-second auto-dismiss timer
//
// The timer resets whenever the title/message changes, so a parent
// can re-issue an error after a failed retry without the new banner
// disappearing on the previous instance's clock.
export default function ErrorBanner({ title, message, onRetry, onDismiss }) {
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // Mount-only entrance animation — slide from -24 px above into
  // place while the panel fades in. SPRING.gentle gives the rose
  // glass a soft settle that matches the rest of the app's motion
  // language.
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(fade,  { ...SPRING.gentle, toValue: 1 }),
    ]).start();
  }, []);

  // Auto-dismiss — resets on prop change so retry → new error gets
  // its own 5 s window.
  useEffect(() => {
    if (!onDismiss) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [title, message, onDismiss]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 0],
  });

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
      <Glass tone="rose" radius={R.expressive} intensity={40} style={styles.banner}>
        <View style={styles.iconWrap}>
          <WarnIcon/>
        </View>

        <View style={styles.textCol}>
          {!!title && <Text style={styles.title} numberOfLines={2}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
        </View>

        <View style={styles.actions}>
          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.85}
              style={styles.retryPill}
              accessibilityRole="button"
              accessibilityLabel="Tekrar dene"
            >
              <Text style={styles.retryTxt}>Tekrar Dene</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity
              onPress={onDismiss}
              hitSlop={10}
              activeOpacity={0.6}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <Text style={styles.closeTxt}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </Glass>
    </Animated.View>
  );
}

function WarnIcon({ color = T.mauveDeep }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 9v4M12 17v.01M5.07 19h13.86a2 2 0 0 0 1.73-3l-6.93-12a2 2 0 0 0-3.46 0l-6.93 12a2 2 0 0 0 1.73 3z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    // minHeight floor — same Glass.js flex:1 content collapse
    // workaround we use on the bottom sheets / dialogs.
    minHeight: 64,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.1,
  },
  message: {
    fontSize: 11,
    fontFamily: F.regular,
    color: S.textSecondary,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  retryTxt: {
    fontSize: 11,
    fontFamily: F.bold,
    color: S.textOnBrand,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: {
    fontSize: 20,
    color: S.textSecondary,
    fontFamily: F.bold,
    lineHeight: 22,
    marginTop: -2,
  },
});
