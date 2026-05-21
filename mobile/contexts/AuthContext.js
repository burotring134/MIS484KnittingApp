import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import {
  getAuthToken as _bridgeGetToken,
  setAuthToken,
  setUnauthorizedHandler,
} from '../utils/apiAuth';

// Persisted authentication state. We store the JWT and a minimal user
// snapshot so the next launch lands directly on home — the token is
// re-verified implicitly on the first API call (server returns 401 if
// expired, which sends us back to the login screen via the api wrapper).
const K_AUTH_TOKEN = 'threadia.auth.token.v1';
const K_AUTH_USER  = 'threadia.auth.user.v1';

const AuthContext = createContext(null);

// Re-export the bridge accessor so existing call sites that import
// `getAuthToken` from this file continue to work. The actual storage
// lives in utils/apiAuth.js so AuthContext and storage.js can share it
// without a circular import.
export const getAuthToken = _bridgeGetToken;

export function AuthProvider({ children }) {
  // `isReady` flips true once we've finished reading persisted state.
  // App.js holds the splash until then to avoid a flash of LoginScreen
  // before the cached session has had a chance to restore.
  const [isReady, setIsReady] = useState(false);
  const [token, setToken]     = useState(null);
  const [user,  setUser]      = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(K_AUTH_TOKEN),
          AsyncStorage.getItem(K_AUTH_USER),
        ]);
        if (t) {
          setAuthToken(t);
          setToken(t);
        }
        if (u) {
          try { setUser(JSON.parse(u)); } catch {}
        }
      } catch {}
      setIsReady(true);
    })();
  }, []);

  // Exchanges an Apple identity token for our own JWT. `fullName` is
  // sent up as-is — Apple only includes it on the first authorisation,
  // so the caller passes through whatever it has. `claimProjectIds` is
  // the list of device-side anonymous project ids that should land
  // under the new account (auto-claim on the backend).
  const signInWithApple = useCallback(async ({ identityToken, fullName, claimProjectIds }) => {
    const resp = await fetch(`${API_BASE}/api/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken, fullName, claimProjectIds }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Server ${resp.status}`);
    }
    const data = await resp.json();
    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    try {
      await AsyncStorage.multiSet([
        [K_AUTH_TOKEN, data.token],
        [K_AUTH_USER, JSON.stringify(data.user)],
      ]);
    } catch {}
    return data;
  }, []);

  // Dev-only escape hatch wired to the LoginScreen's hidden "skip"
  // affordance. Sets a placeholder token + user so the rest of the app
  // (which gates on token presence, not validity) renders normally.
  // Server calls will 401 against this fake JWT — that's intentional;
  // local-only UI testing in Expo Go is the use case. The button that
  // calls this is guarded by `__DEV__`, so Metro strips it from
  // production bundles.
  const devSkipLogin = useCallback(async () => {
    if (!__DEV__) return;
    const fake = 'dev-bypass';
    const u = { id: 'dev-local', displayName: 'Dev', email: null };
    setAuthToken(fake);
    setToken(fake);
    setUser(u);
    try {
      await AsyncStorage.multiSet([
        [K_AUTH_TOKEN, fake],
        [K_AUTH_USER, JSON.stringify(u)],
      ]);
    } catch {}
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    try {
      await AsyncStorage.multiRemove([K_AUTH_TOKEN, K_AUTH_USER]);
    } catch {}
  }, []);

  // Registered with storage.js so a 401 from any sync call can flip the
  // app back to the LoginScreen without each call site having to wire
  // up the auth context manually.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ isReady, token, user, signInWithApple, signOut, devSkipLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
