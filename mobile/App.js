import { useEffect, useState, useRef } from 'react';
import { View, Image, Alert, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFonts, IBMPlexSans_400Regular, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';

import { API_BASE }     from './config';
import { T, DIFFICULTIES } from './utils/theme';
import {
  hasSeenWelcome, markWelcomeSeen,
  getProjects, saveProject,
} from './utils/storage';

import WelcomeScreen       from './screens/WelcomeScreen';
import HomeScreen          from './screens/HomeScreen';
import DifficultyScreen    from './screens/DifficultyScreen';
import LoadingScreen       from './screens/LoadingScreen';
import ApprovalScreen      from './screens/ApprovalScreen';
import WorkshopScreen      from './screens/WorkshopScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import CollectionScreen    from './screens/CollectionScreen';

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
// true the whole view fades to 0 over 320 ms. AppInner sits underneath
// the entire time, so the fade reveals an already-rendered screen.
function SplashView({ exit }) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity      = useRef(new Animated.Value(0)).current;
  const logoScale        = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1100,
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
      duration: 320,
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
        source={require('./assets/logo.png')}
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

  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  // Content is "ready to reveal" once both fonts and the minimum dwell
  // have landed. The splash starts its fade-out the same frame this
  // flips true; we wait the fade duration before unmounting so the
  // animation actually finishes on screen.
  const contentReady = fontsLoaded && minDelayDone;

  useEffect(() => {
    if (!contentReady) return;
    const t = setTimeout(() => setShowSplash(false), 320);
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

  // Boot: load welcome flag and projects, then jump to home or welcome
  useEffect(() => {
    (async () => {
      const seen = await hasSeenWelcome();
      const list = await getProjects();
      setProjects(list);
      setScreen(seen ? 'home' : 'welcome');
    })();
  }, []);

  const refreshProjects = async () => {
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
      console.log('[generate] FAILED:', err.message);
      setError(err.message || 'Bağlantı hatası');
      Alert.alert('Pattern oluşturulamadı', err.message);
      setGenReady(false);
      setScreen('difficulty');
    }
  };

  // ── Approval (save or discard) ───────────────────────────────────────────
  const approveAndSave = async () => {
    if (!pattern) return;
    const name = `Pattern ${new Date().toLocaleDateString('tr-TR')}`;
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
      />
    );
  }

  if (screen === 'difficulty') {
    // Today: fixed 'medium' suggestion — the user gets a sane default
    // without us pretending to have analysed the photo. Future-friendly:
    // swap this for a heuristic on imageAsset.width/height (e.g. crops
    // with lots of pixel detail → 'hard') or a real model call.
    return (
      <DifficultyScreen
        previewUri={previewUri}
        suggested="medium"
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
        onNew={() => setScreen('home')}
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
