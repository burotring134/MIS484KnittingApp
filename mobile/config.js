// ─────────────────────────────────────────────────────────────────────────────
// API configuration
//
// Auto-detects the dev machine's LAN IP from whichever native module exposes
// it. expo-constants is the most reliable source (works on Android Expo Go
// where SourceCode.scriptURL is undefined).
//
// If detection ever falls through to the platform fallback (10.0.2.2 on
// Android = emulator only, localhost on iOS), set MANUAL_HOST below to your
// Mac's LAN IP — `ipconfig getifaddr en0`.
// ─────────────────────────────────────────────────────────────────────────────

import { NativeModules, Platform } from 'react-native';

const BACKEND_PORT = 5001;
const MANUAL_HOST  = null; // e.g. '172.20.10.3' to override auto-detect

function tryParseHost(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/^(?:https?:\/\/)?([^:/]+)/);
  return m ? m[1] : null;
}

function detectHost() {
  // 1) expo-constants — most reliable in Expo Go on Android
  try {
    const Constants = require('expo-constants').default;
    const candidates = [
      Constants?.expoConfig?.hostUri,
      Constants?.manifest?.debuggerHost,
      Constants?.manifest2?.extra?.expoClient?.hostUri,
    ];
    for (const c of candidates) {
      const host = tryParseHost(c);
      if (host) return { host, via: 'expo-constants' };
    }
  } catch {}

  // 2) RN built-in (works on iOS, often null on Android Expo Go)
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  const host = tryParseHost(scriptURL);
  if (host) return { host, via: 'SourceCode.scriptURL' };

  // 3) Per-platform fallback
  if (Platform.OS === 'android') return { host: '10.0.2.2', via: 'android-emulator-fallback' };
  return { host: 'localhost', via: 'localhost-fallback' };
}

const detected = MANUAL_HOST
  ? { host: MANUAL_HOST, via: 'MANUAL_HOST' }
  : detectHost();

const HOST = detected.host;
export const API_BASE = `http://${HOST}:${BACKEND_PORT}`;

console.log(`[config] ${detected.via} → ${API_BASE}`);
