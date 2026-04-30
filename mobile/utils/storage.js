import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

const K_PROJECTS = 'threadia.projects.v1';
const K_WELCOME  = 'threadia.welcomeSeen.v1';

// Best-effort sync to the backend. AsyncStorage stays the source of truth
// so the app keeps working offline — server failures are logged, not
// surfaced to the user.
function syncToBackend(method, path, body) {
  const url = `${API_BASE}/api${path}`;
  const opts = { method };
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  fetch(url, opts).catch((err) => {
    console.log(`[storage] backend sync ${method} ${path} failed:`, err.message);
  });
}

export async function getProjects() {
  try {
    const raw = await AsyncStorage.getItem(K_PROJECTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveProject(project) {
  const list = await getProjects();
  const id = project.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const next = {
    id,
    createdAt: project.createdAt || Date.now(),
    name:      project.name      || 'Untitled',
    source:    project.source    || 'photo',      // 'photo' | 'template'
    difficulty:project.difficulty || 'medium',
    width:     project.width,
    height:    project.height,
    grid:      project.grid,
    colors:    project.colors,
    completed: project.completed || {},           // { 'r,c': true }
  };
  const updated = [next, ...list.filter((p) => p.id !== id)];
  await AsyncStorage.setItem(K_PROJECTS, JSON.stringify(updated));
  syncToBackend('POST', '/projects', next);
  return next;
}

export async function deleteProject(id) {
  const list = await getProjects();
  await AsyncStorage.setItem(K_PROJECTS, JSON.stringify(list.filter((p) => p.id !== id)));
  syncToBackend('DELETE', `/projects/${encodeURIComponent(id)}`);
}

export async function updateProject(id, patch) {
  const list = await getProjects();
  const next = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await AsyncStorage.setItem(K_PROJECTS, JSON.stringify(next));
  const updated = next.find((p) => p.id === id);
  if (updated) syncToBackend('POST', '/projects', updated);
  return updated;
}

export async function hasSeenWelcome() {
  try {
    return (await AsyncStorage.getItem(K_WELCOME)) === '1';
  } catch {
    return false;
  }
}

export async function markWelcomeSeen() {
  await AsyncStorage.setItem(K_WELCOME, '1');
}
