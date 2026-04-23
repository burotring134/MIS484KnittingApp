import { useEffect, useState } from 'react';
import { View, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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

export default function App() {
  const [screen,      setScreen]      = useState('boot');
  const [imageAsset,  setImageAsset]  = useState(null);
  const [previewUri,  setPreviewUri]  = useState(null);
  const [pattern,     setPattern]     = useState(null);
  const [error,       setError]       = useState(null);
  const [projects,    setProjects]    = useState([]);
  const [openProject, setOpenProject] = useState(null);

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

    try {
      const resp = await fetch(`${API_BASE}/api/pattern`, {
        method:  'POST',
        body:    fd,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      setPattern({ ...data, difficulty: difficultyId, name: 'Yeni Pattern' });
      setScreen('approval');
    } catch (err) {
      setError(err.message || 'Bağlantı hatası');
      Alert.alert('Pattern oluşturulamadı', err.message);
      setScreen('difficulty');
    }
  };

  // ── Approval (save or discard) ───────────────────────────────────────────
  const approveAndSave = async () => {
    if (!pattern) return;
    const name = `Pattern ${new Date().toLocaleDateString('tr-TR')}`;
    await saveProject({
      name,
      source:     'photo',
      difficulty: pattern.difficulty || 'medium',
      width:      pattern.width,
      height:     pattern.height,
      grid:       pattern.grid,
      colors:     pattern.colors,
    });
    setPattern(null);
    setImageAsset(null);
    setPreviewUri(null);
    await refreshProjects();
    Alert.alert('Atölyeye eklendi', `"${name}" kaydedildi.`, [
      { text: 'Tamam', onPress: () => setScreen('workshop') },
    ]);
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
        onTakePhoto={pickFromCamera}
        onGallery={pickFromGallery}
        onWorkshop={() => setScreen('workshop')}
        onCollection={() => setScreen('collection')}
      />
    );
  }

  if (screen === 'difficulty') {
    return (
      <DifficultyScreen
        previewUri={previewUri}
        onBack={() => setScreen('home')}
        onPick={generate}
      />
    );
  }

  if (screen === 'loading') {
    return <LoadingScreen/>;
  }

  if (screen === 'approval') {
    return (
      <ApprovalScreen
        pattern={pattern}
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
  boot: {
    flex: 1,
    backgroundColor: T.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
