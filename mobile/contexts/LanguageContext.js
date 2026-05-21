import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { tr, en, updateCurrentLanguage } from '../utils/i18n';

// Persists across launches. Read once at boot; written through
// switchLanguage when the user picks a language from Settings.
const LANGUAGE_KEY = 'threadia.prefs.language';

// React Context that exposes the live language code, the resolved strings
// dictionary, and a setter. Every screen / component that reads copy
// subscribes via useLanguage() so a language switch re-renders the whole
// tree atomically — no module reload required.
//
// Utility files (utils/errors.js, utils/pdf.js) can't use hooks, so they
// keep their `import { strings, lang } from '../utils/i18n'` lines. The
// module-level `strings` and `lang` exports are mutated by
// `updateCurrentLanguage` (which switchLanguage calls just before the
// state update), and Babel's ESM→CommonJS transform preserves live
// bindings — so each `strings.foo` access in a utility resolves against
// the current value at call time.
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // `null` while we resolve the initial language from disk. We block the
  // tree until then so screens never paint with the wrong locale during
  // the very first frames (a flash of TR on an EN device, or vice
  // versa). The boot path here is fast — one AsyncStorage read — so the
  // blocking window is shorter than the splash dwell already in App.js.
  const [lang, setLang] = useState(null);

  useEffect(() => {
    (async () => {
      let saved = null;
      try {
        saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      } catch {}
      let initial;
      if (saved === 'tr' || saved === 'en') {
        initial = saved;
      } else {
        const device = getLocales()[0]?.languageCode;
        initial = device === 'tr' ? 'tr' : 'en';
      }
      // Push into the module-level state in i18n.js *before* the React
      // state update so any utility that runs in the same render pass
      // (e.g. an error formatter inside a deferred promise) sees the
      // correct dictionary.
      updateCurrentLanguage(initial);
      setLang(initial);
    })();
  }, []);

  const switchLanguage = async (code) => {
    const normalized = code === 'tr' ? 'tr' : 'en';
    if (normalized === lang) return;
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, normalized);
    } catch {}
    updateCurrentLanguage(normalized);
    setLang(normalized);
  };

  if (lang === null) return null;

  const strings = lang === 'tr' ? tr : en;
  return (
    <LanguageContext.Provider value={{ lang, strings, switchLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside a LanguageProvider');
  }
  return ctx;
}
