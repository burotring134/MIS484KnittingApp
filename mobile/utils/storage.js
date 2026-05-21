import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';
import { getAuthToken, triggerUnauthorized } from './apiAuth';

// Re-export so other modules that import from AuthContext don't need to
// know about the apiAuth bridge module.
export { setUnauthorizedHandler } from './apiAuth';

const K_PROJECTS       = 'threadia.projects.v1';
const K_IMAGE          = (id) => `threadia.image.${id}`;
const K_WELCOME        = 'threadia.welcomeSeen.v1';
const K_FAVORITES      = 'threadia.favorites.v1';
const K_TOUR_WORKSHOP  = 'threadia.tour.workshop_seen';
const K_MILESTONE      = (projectId, threshold) => `threadia.milestones.${projectId}.${threshold}`;
const K_COACH_TRACKING = 'threadia.coach.trackingFirstUse';
const K_COACH_FOCUS    = 'threadia.coach.focusFirstUse';

// Best-effort sync to the backend. AsyncStorage stays the source of truth
// so the app keeps working offline — server failures are logged, not
// surfaced to the user. Skips silently if there is no auth token yet
// (project routes require it on the backend, so calls without one
// would just 401).
function syncToBackend(method, path, body) {
  const token = getAuthToken();
  if (!token) return;
  const url = `${API_BASE}/api${path}`;
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
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

// Returns the ids of every locally-stored project. LoginScreen passes
// this list to the backend on first authentication so anonymously-saved
// projects get claimed under the new account in a single round trip.
export async function getProjectIdsForClaim() {
  const list = await readIndex();
  return list.map((p) => p.id).filter(Boolean);
}

// Pull the canonical project list from the backend and merge it into
// AsyncStorage so cross-device edits (or another client's changes) show
// up on pull-to-refresh. Caller should follow with getProjects() — this
// function only touches the metadata index, the per-project chart
// images stay where they are.
//
// Merge policy: server wins on any id present in both lists (server has
// the freshest `completed`, `name`, etc.), but local-only entries are
// preserved so an offline-created project that hasn't been POSTed yet
// isn't dropped on refresh. Errors propagate — the caller (pull-to-
// refresh handler) decides whether to surface or swallow them.
export async function fetchProjectsFromServer() {
  const token = getAuthToken();
  if (!token) return;
  const url = `${API_BASE}/api/projects`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 401) {
    // Expired / revoked token — kick the user back to LoginScreen.
    triggerUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!resp.ok) throw new Error(`Sunucu hatası ${resp.status}`);
  const serverList = await resp.json();
  if (!Array.isArray(serverList)) throw new Error('Geçersiz sunucu yanıtı');

  const local = await readIndex();
  const localById = new Map(local.map((p) => [p.id, p]));
  const serverIds = new Set(serverList.map((p) => p.id));

  const merged = [
    ...serverList.map((s) => ({ ...(localById.get(s.id) || {}), ...s })),
    ...local.filter((p) => !serverIds.has(p.id)),
  ];
  // Match backend's sort so the local list stays consistent with the
  // wire order.
  merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  await AsyncStorage.setItem(K_PROJECTS, JSON.stringify(merged));
}

export async function saveProject(project) {
  const list = await readIndex();
  const id = project.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // The blob in K_PROJECTS holds metadata, grid, colors, completed —
  // tiny enough that even 10+ projects fit in one AsyncStorage row.
  // `updatedAt` tracks the most recent edit (cell toggle, rename, save)
  // so HomeScreen's greeting can decide between "last activity was today"
  // and the 7-day / 30-day re-engagement copy.
  const now = Date.now();
  const next = {
    id,
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || now,
    name:      project.name      || 'Untitled',
    source:    project.source    || 'photo',      // 'photo' | 'template'
    difficulty:project.difficulty || 'medium',
    width:     project.width,
    height:    project.height,
    grid:      project.grid,
    colors:    project.colors,
    completed: project.completed || {},           // { 'r,c': true }
    // Most recent colour the user touched on the canvas — used by
    // HomeScreen's ContinuingCard to surface "DMC X işliyorsun".
    // null on a fresh save; ProjectDetailScreen stamps it via
    // updateProject as the user paints / toggles cells.
    lastEditedColorId: project.lastEditedColorId ?? null,
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
  // Stamp updatedAt on every edit so the greeting can age-out
  // accurately. Caller-supplied updatedAt in the patch wins — useful if
  // the server hands back its own canonical timestamp.
  const stamp = patch.updatedAt || Date.now();
  const next = list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: stamp } : p));
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

// ─── Workshop guided tour ────────────────────────────────────────────────
// First-run coach marks for the Atölye screen. The flag is set once the
// user finishes (or skips) the three-step bubble walkthrough on their
// first visit with at least one saved project; subsequent visits skip
// the tour silently.
export async function hasSeenWorkshopTour() {
  try {
    return (await AsyncStorage.getItem(K_TOUR_WORKSHOP)) === '1';
  } catch {
    return false;
  }
}

export async function markWorkshopTourSeen() {
  try {
    await AsyncStorage.setItem(K_TOUR_WORKSHOP, '1');
  } catch {}
}

// ─── Milestone celebrations ──────────────────────────────────────────────
// Tracks which percentage milestones (25/50/75/100) the user has already
// celebrated on a given project. The flag is set the first time the
// project crosses a threshold so the celebration sheet doesn't replay on
// every subsequent edit (e.g. uncheck-then-recheck flickering across
// 50%). One key per (project, threshold) — granular so a project that
// hits 25% and 50% but is later partially undone still has the 75% card
// waiting to be earned.
export async function hasSeenMilestone(projectId, threshold) {
  try {
    return (await AsyncStorage.getItem(K_MILESTONE(projectId, threshold))) === '1';
  } catch {
    return false;
  }
}

export async function markMilestoneSeen(projectId, threshold) {
  try {
    await AsyncStorage.setItem(K_MILESTONE(projectId, threshold), '1');
  } catch {}
}

// ─── Coach marks (ProjectDetail first-use tooltips) ──────────────────────
// Educational one-shot tooltips that fire the first time the user
// activates each mode inside the canvas. The flag is set the first
// time we surface the tip; subsequent activations are silent — the
// mode chip's own label is the ongoing affordance, so re-explaining
// would just feel patronising.
//
// `kind` is 'tracking' or 'focus'. Two separate flags so users who
// learn one mode early aren't denied the second tip later.
function coachKey(kind) {
  return kind === 'tracking' ? K_COACH_TRACKING : K_COACH_FOCUS;
}

export async function hasSeenCoach(kind) {
  try {
    return (await AsyncStorage.getItem(coachKey(kind))) === '1';
  } catch {
    return false;
  }
}

export async function markCoachSeen(kind) {
  try {
    await AsyncStorage.setItem(coachKey(kind), '1');
  } catch {}
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
