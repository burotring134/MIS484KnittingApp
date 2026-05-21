// Shared completion-percentage logic.
//
// A cross-stitcher leaves the fabric's own colour bare wherever the
// pattern wants pure white background — those DMC codes never get
// stitched. So our progress maths excludes "locked" background cells
// from both the numerator (done) and the denominator (total). Without
// this, a fully-stitched pattern with a white sky in the background
// would top out at, say, 67% and never reach 100% — exactly the bug
// the Workshop card was hitting before this helper landed.
//
// Keep the source of truth here. ProjectDetailScreen, WorkshopScreen,
// HomeScreen and any future surface that paints a % bar should call
// computeProgress(project) instead of dividing Object.keys(completed)
// by width * height directly.

export const BACKGROUND_DMC_CODES = new Set(['B5200', 'blanc', '3865']);

export function isBackgroundColor(color) {
  return !!color && BACKGROUND_DMC_CODES.has(color.dmcCode);
}

// Set of color ids in `project.colors` that map to background DMC codes.
// Returns an empty Set when project.colors is missing so callers can use
// the result without null-checking.
export function lockedColorIdsFor(project) {
  const set = new Set();
  if (!project?.colors) return set;
  for (const c of project.colors) {
    if (isBackgroundColor(c)) set.add(c.id);
  }
  return set;
}

// Counts cells in the grid whose color is in `lockedIds`.
function countLockedCells(project, lockedIds) {
  if (lockedIds.size === 0) return 0;
  if (!project?.grid || !project.height || !project.width) return 0;
  let n = 0;
  for (let r = 0; r < project.height; r++) {
    const row = project.grid[r];
    if (!row) continue;
    for (let c = 0; c < project.width; c++) {
      if (lockedIds.has(row[c])) n++;
    }
  }
  return n;
}

// Counts entries in project.completed whose grid cell is NOT a locked
// background. Mirrors ProjectDetailScreen's inline calc so legacy
// projects with accidentally-marked background cells don't inflate the
// "done" count.
function countDoneStitchable(project, lockedIds) {
  const completed = project?.completed;
  if (!completed) return 0;
  if (lockedIds.size === 0) return Object.keys(completed).length;
  if (!project?.grid) return 0;
  let n = 0;
  for (const key of Object.keys(completed)) {
    const [r, c] = key.split(',').map(Number);
    if (!lockedIds.has(project.grid[r]?.[c])) n++;
  }
  return n;
}

// Single entry point for any UI that needs to show completion. Returns
// { totalCells, lockedCells, stitchableCells, doneCount, pct }.
export function computeProgress(project) {
  if (!project) {
    return { totalCells: 0, lockedCells: 0, stitchableCells: 0, doneCount: 0, pct: 0 };
  }
  const lockedIds = lockedColorIdsFor(project);
  const totalCells = (project.width || 0) * (project.height || 0);
  const lockedCells = countLockedCells(project, lockedIds);
  const stitchableCells = Math.max(0, totalCells - lockedCells);
  const doneCount = countDoneStitchable(project, lockedIds);
  const pct = stitchableCells > 0
    ? Math.round((doneCount / stitchableCells) * 100)
    : 0;
  return { totalCells, lockedCells, stitchableCells, doneCount, pct };
}
