import * as Haptics from 'expo-haptics';

// Thin wrappers around expo-haptics. Every call is wrapped in try/catch
// because haptics aren't a critical path — a missing taptic engine or a
// permission quirk shouldn't crash the screen. Expo's Haptics works on
// both iOS and modern Android, so no Platform gating.

export function tap() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}

export function success() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}

export function warn() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
}

export function selection() {
  try { Haptics.selectionAsync(); } catch {}
}

// Throttled tap for drag interactions — without this, painting a row of
// 50 cells in one drag would fire 50 taptics, which feels like a stuck
// vibration. 80 ms is the sweet spot: still snappy, but discrete.
const THROTTLE_MS = 80;
let lastTapAt = 0;

export function tapThrottled() {
  const now = Date.now();
  if (now - lastTapAt < THROTTLE_MS) return;
  lastTapAt = now;
  tap();
}
