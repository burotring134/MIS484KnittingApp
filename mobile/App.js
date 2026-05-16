import { useEffect, useState, useRef } from 'react';
import {
  View, Image, Alert, ActivityIndicator, StyleSheet, Animated, Easing,
  Platform, UIManager,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, IBMPlexSans_400Regular, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';

import { API_BASE }     from './config';
import { T, DIFFICULTIES } from './utils/theme';
import {
  hasSeenWelcome, markWelcomeSeen,
  getProjects, saveProject, fetchProjectsFromServer,
} from './utils/storage';
import { friendlyError } from './utils/errors';

import WelcomeScreen       from './screens/WelcomeScreen';
import HomeScreen          from './screens/HomeScreen';
import DifficultyScreen    from './screens/DifficultyScreen';
import LoadingScreen       from './screens/LoadingScreen';
import ApprovalScreen      from './screens/ApprovalScreen';
import WorkshopScreen      from './screens/WorkshopScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import CollectionScreen    from './screens/CollectionScreen';
import SettingsScreen      from './screens/SettingsScreen';

// Difficulty heuristic — runs on the picked image's intrinsic dimensions
// (set by expo-image-picker after the user's optional crop). The output
// drives both the highlighted tile on DifficultyScreen and the reason
// string we show next to its badge, so the suggestion is auditable
// instead of being a static "medium" claim. Thresholds:
//   square (0.9–1.1) AND > 2 MP → 'hard'    (lots of fine detail likely)
//   very wide (>1.67) or very tall (<0.6)  → 'easy'  (sparse composition)
//   anything else                          → 'medium' (balanced default)
// Returns { id, reason }; reason is null only when dimensions are
// unavailable, in which case the badge falls back to no explanation.
function suggestDifficulty(imageAsset) {
  if (!imageAsset?.width || !imageAsset?.height) {
    return { id: 'medium', reason: null };
  }
  const w = imageAsset.width;
  const h = imageAsset.height;
  const aspect = w / h;
  const totalPixels = w * h;

  if (aspect >= 0.9 && aspect <= 1.1 && totalPixels > 2_000_000) {
    return { id: 'hard', reason: 'Karesel ve yüksek çözünürlüklü' };
  }
  if (aspect > 1.67) {
    return { id: 'easy', reason: 'Geniş kadraj, sade kompozisyon' };
  }
  if (aspect < 0.6) {
    return { id: 'easy', reason: 'Dikey kadraj, sade kompozisyon' };
  }
  return { id: 'medium', reason: 'Standart kompozisyon' };
}

// Screens — single string state machine
//   'boot' → 'welcome' (first launch) | 'home' (returning)
//   'home' → 'difficulty' (after photo picked) | 'workshop' | 'collection'
//   'difficulty' → 'loading' (after pick) | back to 'home'
//   'loading' → 'approval' (success) | 'home' (failure with alert)
//   'approval' → 'home' (after save or discard)
//   'workshop' → 'project-detail' | 'home'
//   'project-detail' → 'workshop'
//   'collection' → 'home' | 'workshop' (after add)

// Top-level wrapper just installs SafeAreaProvider so any screen can read
// real device insets via useSafeAreaInsets(). All routing/state lives in
// AppInner.
// Splash overlay — logo springs in on its own clock; when `exit` flips
// true the whole view fades to 0 over 280 ms. AppInner sits underneath
// the entire time, so the fade reveals an already-rendered screen.
function SplashView({ exit }) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity      = useRef(new Animated.Value(0)).current;
  const logoScale        = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!exit) return;
    // Plain timing on exit — splash is leaving, not settling, so a
    // spring would overshoot the 0 endpoint and feel sloppy.
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [exit]);

  return (
    <Animated.View
      style={[styles.splash, StyleSheet.absoluteFillObject, { opacity: containerOpacity }]}
      pointerEvents="auto"
    >
      <Animated.Image
        source={require('./assets/favicon_logo.png')}
        style={[styles.splashLogo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [showSplash, setShowSplash]     = useState(true);

  // Android needs an opt-in for the (still-experimental) LayoutAnimation
  // API used by WorkshopScreen for project deletes. Flipping it once at
  // root mount, instead of inside the screen file, keeps the feature
  // toggle in a single discoverable place — the next time we touch
  // motion infra (e.g. migrating to react-native-reanimated layout
  // transitions) the call to remove is here, not buried in a screen.
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), 900);
    return () => clearTimeout(t);
  }, []);

  // Content is "ready to reveal" once both fonts and the minimum dwell
  // have landed. The splash starts its fade-out the same frame this
  // flips true; we wait the fade duration before unmounting so the
  // animation actually finishes on screen.
  const contentReady = fontsLoaded && minDelayDone;

  useEffect(() => {
    if (!contentReady) return;
    const t = setTimeout(() => setShowSplash(false), 280);
    return () => clearTimeout(t);
  }, [contentReady]);

  // AppInner is mounted from the start, even before fonts/minDelay are
  // ready. It boots (AsyncStorage reads, etc.) under the splash so by
  // the time the splash fades, home/welcome is already painted —
  // cross-dissolve, not "splash → blank → screen".
  return (
    <View style={styles.appRoot}>
      <SafeAreaProvider>
        <AppInner/>
      </SafeAreaProvider>
      {showSplash && <SplashView exit={contentReady}/>}
    </View>
  );
}

function AppInner() {
  const [screen,      setScreen]      = useState('boot');
  const [imageAsset,  setImageAsset]  = useState(null);
  const [previewUri,  setPreviewUri]  = useState(null);
  const [pattern,     setPattern]     = useState(null);
  const [error,       setError]       = useState(null);
  const [projects,    setProjects]    = useState([]);
  const [openProject, setOpenProject] = useState(null);
  // `genReady` is the handshake with LoadingScreen — backend has finished
  // and the pattern is stored; the loading screen will flip to onComplete
  // once it's marched through every visual step. This guarantees the
  // user always sees the full progression, regardless of network speed.
  const [genReady,    setGenReady]    = useState(false);
  // Monotonic counter we bump whenever the user lands on home from
  // workshop's "+" button. HomeScreen passes this down to Glare so the
  // photo / gallery HeroCards do a short burst sweep on arrival,
  // signalling "this is where you start" without nagging the user
  // with a permanent shimmer.
  const [glareSeq,    setGlareSeq]    = useState(0);

  // Boot: load welcome flag and projects, then jump to home or welcome
  useEffect(() => {
    (async () => {
      const seen = await hasSeenWelcome();
      const list = await getProjects();
      setProjects(list);
      setScreen(seen ? 'home' : 'welcome');
    })();
  }, []);

  // Re-read projects from disk. With `forceServerSync: true` the backend
  // is hit first and the response merged into AsyncStorage so edits made
  // on another device land in the UI — this is what pull-to-refresh
  // wires up to. Server failure is best-effort: it's logged and we fall
  // through to the cached list so the user always lands on something
  // (offline-friendly by design).
  const refreshProjects = async ({ forceServerSync = false } = {}) => {
    if (forceServerSync) {
      try {
        await fetchProjectsFromServer();
      } catch (err) {
        console.log('[refreshProjects] server sync failed:', err.message);
      }
    }
    setProjects(await getProjects());
  };

  // ── Photo capture / gallery ─────────────────────────────────────────────
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Ayarlardan kamera erişimine izin ver.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 });
    if (!result.canceled && result.assets?.[0]) {
      setImageAsset(result.assets[0]);
      setPreviewUri(result.assets[0].uri);
      setScreen('difficulty');
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Ayarlardan fotoğraf erişimine izin ver.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageAsset(result.assets[0]);
      setPreviewUri(result.assets[0].uri);
      setScreen('difficulty');
    }
  };

  // ── AI generation ────────────────────────────────────────────────────────
  const generate = async (difficultyId) => {
    if (!imageAsset) {
      setScreen('home');
      return;
    }
    const preset = DIFFICULTIES.find((d) => d.id === difficultyId);
    if (!preset) return;

    setError(null);
    setPattern(null);
    setGenReady(false);
    setScreen('loading');

    const fd = new FormData();
    fd.append('image', {
      uri:  imageAsset.uri,
      type: imageAsset.mimeType || 'image/jpeg',
      name: imageAsset.fileName  || 'photo.jpg',
    });
    fd.append('gridSize',   String(preset.gridSize));
    fd.append('numColors',  String(preset.numColors));
    fd.append('difficulty', difficultyId);

    const url = `${API_BASE}/api/pattern`;
    console.log('[generate] POST', url);
    console.log('[generate] image uri:', imageAsset.uri, 'mime:', imageAsset.mimeType);
    console.log('[generate] difficulty:', difficultyId, 'gridSize:', preset.gridSize, 'numColors:', preset.numColors);

    try {
      // Quick reachability check first — gives a clearer error than the
      // "Network request failed" you get when fetch() blows up mid-multipart.
      const ping = await fetch(`${API_BASE}/health`).catch((e) => {
        throw new Error(`Sunucuya ulaşılamıyor (${API_BASE}). Mac ve telefon aynı ağda mı? ${e.message}`);
      });
      if (!ping.ok) throw new Error(`Sunucu sağlık kontrolü başarısız (${ping.status})`);

      // Don't manually set Content-Type for multipart — RN/fetch must inject
      // the boundary string. Setting "multipart/form-data" without boundary
      // makes multer fail to parse and the fetch bails as "Network request
      // failed". Letting fetch set the header automatically fixes it.
      const resp = await fetch(url, {
        method: 'POST',
        body: fd,
      });

      console.log('[generate] response status:', resp.status);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      console.log('[generate] success — grid', data.width, 'x', data.height, 'colors', data.colors?.length);
      setPattern({ ...data, difficulty: difficultyId, name: 'Yeni Pattern' });
      // Hand off to LoadingScreen — it'll finish its timeline then ping
      // back through onComplete (see render switch below).
      setGenReady(true);
    } catch (err) {
      // Full message goes to console for debugging; only the friendly
      // pair shows up on screen via the DifficultyScreen ErrorBanner.
      console.log('[generate] FAILED:', err.message);
      const friendly = friendlyError(err);
      setError({
        ...friendly,
        retry: () => generate(difficultyId),
      });
      setGenReady(false);
      setScreen('difficulty');
    }
  };

  // ── Approval (save or discard) ───────────────────────────────────────────
  // `customName` comes from the save sheet; when absent we fall back
  // to the auto date-stamped name so any caller that doesn't ship a
  // sheet still works.
  const approveAndSave = async (customName) => {
    if (!pattern) return;
    const name = (customName && customName.trim()) || `Pattern ${new Date().toLocaleDateString('tr-TR')}`;
    try {
      await saveProject({
        name,
        source:       'photo',
        difficulty:   pattern.difficulty || 'medium',
        width:        pattern.width,
        height:       pattern.height,
        grid:         pattern.grid,
        colors:       pattern.colors,
        imageDataUri: pattern.imageDataUri,
      });
      setPattern(null);
      setImageAsset(null);
      setPreviewUri(null);
      await refreshProjects();
      Alert.alert('Atölyeye eklendi', `"${name}" kaydedildi.`, [
        { text: 'Tamam', onPress: () => setScreen('workshop') },
      ]);
    } catch (err) {
      console.log('[approveAndSave] FAILED:', err?.message);
      Alert.alert('Kaydedilemedi', `Hata: ${err?.message || 'bilinmeyen'}`);
    }
  };

  const discardPattern = () => {
    setPattern(null);
    setImageAsset(null);
    setPreviewUri(null);
    setScreen('home');
  };

  // ── Workshop / project ──────────────────────────────────────────────────
  const openProjectById = (id) => {
    const p = projects.find((x) => x.id === id);
    if (p) {
      setOpenProject(p);
      setScreen('project-detail');
    }
  };

  const handleWelcomeContinue = async () => {
    await markWelcomeSeen();
    setScreen('home');
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (screen === 'boot') {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={T.mauve} size="large"/>
      </View>
    );
  }

  if (screen === 'welcome') {
    return <WelcomeScreen onContinue={handleWelcomeContinue}/>;
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        projectCount={projects.length}
        projects={projects}
        onTakePhoto={pickFromCamera}
        onGallery={pickFromGallery}
        onWorkshop={() => setScreen('workshop')}
        onCollection={() => setScreen('collection')}
        onOpen={openProjectById}
        onSettings={() => setScreen('settings')}
        glareTrigger={glareSeq}
      />
    );
  }

  if (screen === 'settings') {
    return <SettingsScreen onBack={() => setScreen('home')}/>;
  }

  if (screen === 'difficulty') {
    // Heuristic suggestion derived from the picked image's dimensions
    // — see suggestDifficulty() above for thresholds. The reason string
    // is rendered alongside the suggestion badge so the user can audit
    // the recommendation.
    const suggestion = suggestDifficulty(imageAsset);
    return (
      <DifficultyScreen
        previewUri={previewUri}
        suggested={suggestion.id}
        suggestedReason={suggestion.reason}
        error={error}
        onDismissError={() => setError(null)}
        onBack={() => setScreen('home')}
        onPick={generate}
      />
    );
  }

  if (screen === 'loading') {
    return (
      <LoadingScreen
        done={genReady}
        onComplete={() => {
          setGenReady(false);
          setScreen('approval');
        }}
      />
    );
  }

  if (screen === 'approval') {
    return (
      <ApprovalScreen
        pattern={pattern}
        previewUri={previewUri}
        onApprove={approveAndSave}
        onDiscard={discardPattern}
      />
    );
  }

  if (screen === 'workshop') {
    return (
      <WorkshopScreen
        projects={projects}
        onBack={() => setScreen('home')}
        onOpen={openProjectById}
        onRefresh={refreshProjects}
        // "+" lands the user back on home; bump glareSeq so the photo
        // / gallery cards do a short burst sweep when home mounts.
        // The setTimeout reset clears the trigger after the in-flight
        // animation has captured it, so a later return to home from
        // another path (collection → home, etc.) doesn't refire the
        // burst — only an actual workshop "+" tap does.
        onNew={() => {
          setGlareSeq((s) => s + 1);
          setScreen('home');
          setTimeout(() => setGlareSeq(0), 100);
        }}
        onCollection={() => setScreen('collection')}
      />
    );
  }

  if (screen === 'project-detail' && openProject) {
    return (
      <ProjectDetailScreen
        project={openProject}
        onBack={() => { setOpenProject(null); setScreen('workshop'); }}
        onChange={async () => {
          await refreshProjects();
          // reload openProject so its `completed` reflects persisted state
          const fresh = (await getProjects()).find((x) => x.id === openProject.id);
          if (fresh) setOpenProject(fresh);
        }}
      />
    );
  }

  if (screen === 'collection') {
    return (
      <CollectionScreen
        onBack={() => setScreen('home')}
        onAdded={async () => {
          await refreshProjects();
          setScreen('workshop');
        }}
      />
    );
  }

  // Fallback
  return (
    <View style={styles.boot}>
      <ActivityIndicator color={T.mauve} size="large"/>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: T.cream,
  },
  boot: {
    flex: 1,
    backgroundColor: T.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splash: {
    flex: 1,
    backgroundColor: T.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 240,
    height: 240,
  },
});
