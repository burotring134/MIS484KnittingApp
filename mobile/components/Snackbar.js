import { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, R, SPRING } from '../utils/theme';
import Glass from './Glass';

const DEFAULT_DISMISS_MS = 5000;

// Snackbar — bottom-anchored dark-Glass card with a single action.
// Used for undo-able destructive actions (e.g. "Proje silindi · Geri
// Al") and for non-blocking success confirmations. Always mounted;
// opacity + translateY animate against the `visible` prop so
// transitions stay smooth across visibility flips.
//
// Internal timer fires `onDismiss` while visible=true. The timer
// is cleared whenever visible flips back to false (e.g. parent
// committed early, user tapped undo, or another snackbar event
// arrived), so the parent never double-fires the dismissal logic.
//
// Props:
//   visible       — drives slide-up / slide-down + opacity
//   message       — main body text (single line preferred, wraps if needed)
//   actionLabel   — when truthy, renders the outlined action pill
//   onAction      — tap handler for the action pill
//   onDismiss     — fires after `duration` ms while visible. Parent
//                   uses this to commit the destructive action or
//                   simply clear the success toast.
//   duration      — ms before onDismiss fires. Defaults to 5000 (good
//                   for undo windows); pass 4000 or less for transient
//                   success confirmations where no action is required.
export default function Snackbar({ visible, message, actionLabel, onAction, onDismiss, duration = DEFAULT_DISMISS_MS }) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      ...SPRING.gentle,
      toValue: visible ? 1 : 0,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (!visible || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [visible, onDismiss, duration]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          bottom: Math.max(insets.bottom, 14) + 14,
          opacity: slide,
          transform: [{ translateY }],
        },
      ]}
    >
      <Glass
        tone="dark"
        blurTint="dark"
        intensity={60}
        radius={R.expressive}
        style={styles.snackbar}
      >
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        {actionLabel && (
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.7}
            style={styles.actionPill}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text style={styles.actionTxt}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16, right: 16,
  },
  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    // Glass.js flex:1 content collapse safety floor.
    minHeight: 56,
    shadowColor: T.ink,
    shadowOpacity: 0.30,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: F.semibold,
    color: '#FFFFFF',
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  actionPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  actionTxt: {
    fontSize: 12,
    fontFamily: F.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
