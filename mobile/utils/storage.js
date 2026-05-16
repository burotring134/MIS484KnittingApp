import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

const K_PROJECTS  = 'threadia.projects.v1';
const K_IMAGE     = (id) => `threadia.image.${id}`;
const K_WELCOME   = 'threadia.welcomeSeen.v1';
const K_FAVORITES = 'threadia.favorites.v1';

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

// Read the projects index — metadata + grid + colors + completed. The
// pre-rendered chart PNG is intentionally NOT in this blob (lives in
// per-project keys instead) so AsyncStorage's per-item size cap never
// gets hit even with several hard-mode projects each carrying a
// ~300-500 KB image.
async function readIndex() {
  try {
    const raw = await AsyncStorage.getItem(K_PROJECTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function readImage(id) {
  try {
    return await AsyncStorage.getItem(K_IMAGE(id));
  } catch {
    return null;
  }
}

export async function getProjects() {
  const list = await readIndex();
  // Attach each project's chart image. AsyncStorage on Android dispatches
  // each getItem to a worker thread, so reading N projects in parallel is
  // close to free.
  return Promise.all(list.map(async (p) => ({
    ...p,
    imageDataUri: await readImage(p.id),
  })));
}

export async function saveProject(project) {
  const list = await readIndex();
  const id = project.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // The blob in K_PROJECTS holds metadata, grid, colors, completed —
  // tiny enough that even 10+ projects fit in one AsyncStorage row.
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

  // Image goes to its own key — wrapped in try/catch so a failed write
  // (e.g. AsyncStorage size cap, OOM on a big PNG) doesn't break the
  // project save itself; the workshop entry still appears, just without
  // the pre-rendered chart.
  if (project.imageDataUri) {
    try {
      await AsyncStorage.setItem(K_IMAGE(id), project.imageDataUri);
    } catch (e) {
      console.log(`[storage] writeImage failed for ${id} (${Math.round(project.imageDataUri.length/1024)} KB):`, e?.message);
    }
  }

  syncToBackend('POST', '/projects', next);
  return { ...next, imageDataUri: project.imageDataUri || null };
}

export async function deleteProject(id) {
  const list = await readIndex();
  await AsyncStorage.setItem(K_PROJECTS, JSON.stringify(list.filter((p) => p.id !== id)));
  await AsyncStorage.removeItem(K_IMAGE(id)).catch(() => {});
  syncToBackend('DELETE', `/projects/${encodeURIComponent(id)}`);
}

export async function updateProject(id, patch) {
  const list = await readIndex();
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

// ─── Favorites ────────────────────────────────────────────────────────────
// Stored as a JSON array of template ids (Sets aren't JSON-serialisable),
// hydrated back into a Set so callers can do O(1) membership checks.
export async function getFavorites() {
  try {
    const raw = await AsyncStorage.getItem(K_FAVORITES);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export async function toggleFavorite(id) {
  const current = await getFavorites();
  if (current.has(id)) current.delete(id);
  else current.add(id);
  try {
    await AsyncStorage.setItem(K_FAVORITES, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.log('[storage] toggleFavorite failed:', e?.message);
  }
  return current;
}
