import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Thin wrappers around expo-haptics. Every call is wrapped in try/catch
// because haptics aren't a critical path — a missing taptic engine or a
// permission quirk shouldn't crash the screen. Expo's Haptics works on
// both iOS and modern Android, so no Platform gating.
//
// Each call is also guarded by an in-memory `_enabled` flag, so the
// user's Settings → "Haptik geri bildirim" toggle silences the whole
// module without an AsyncStorage read on every tap. The flag loads
// once on module init (optimistic default = ON until the disk read
// resolves) and is refreshed via `refreshHapticsPref()` when the user
// flips the toggle.

const PREF_KEY = 'threadia.prefs.haptics';
let _enabled = true;

// Fire-and-forget initial load — first few taps after cold boot may
// fire even if the user disabled them previously, but the window is
// tiny and the trade-off (no disk read per tap) is worth it.
(async () => {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (raw !== null) _enabled = raw === '1';
  } catch {}
})();

// Called by SettingsScreen after writing the new value to AsyncStorage,
// so the cache stays in sync without forcing every consumer to do a
// disk read on each call.
export async function refreshHapticsPref() {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    _enabled = raw === null ? true : raw === '1';
  } catch {}
}

export function tap() {
  if (!_enabled) return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}

export function success() {
  if (!_enabled) return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}

export function warn() {
  if (!_enabled) return;
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
}

export function selection() {
  if (!_enabled) return;
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
