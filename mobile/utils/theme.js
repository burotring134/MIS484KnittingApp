// ─── Color tokens (raw palette) ──────────────────────────────────────────────
// Keep raw hex values here only. UI code should prefer the semantic
// surface/text aliases below — `T` is exported for direct color access
// where a swatch needs a literal hex (e.g. DMC thread colors).
export const T = {
  // Surfaces
  cream:      '#F9F7F5',   // Linen White — main background
  creamDeep:  '#F0EBE5',
  paper:      '#FFFFFF',

  // Typography
  ink:        '#4A3F3F',   // Deep Umber — primary text
  inkSoft:    '#9E8484',   // Muted Mauve — secondary text
  inkMute:    '#B09898',   // tertiary

  // Borders / dividers
  line:       '#E8DFDF',
  lineSoft:   '#F0E8E8',

  // Brand palette
  rose:       '#EBCBCB',   // Soft Petal
  mauve:      '#D4A5A5',   // Rose Dust (primary)
  mauveDeep:  '#B07676',

  // Functional
  mint:       '#C8D5C2',
  errorBg:    '#F7DADB',
  errorTx:    '#9B5D5D',
  successTx:  '#A8B5A2',   // Sage Green
};

// ─── Semantic surface tokens ────────────────────────────────────────────────
// Map raw colors to intent. New UI work should use these names, not T.*.
// `glass*` are translucent stacks designed to sit over the cream background
// — combine with <BlurView> for the 2026 Liquid Glass material.
export const S = {
  surfacePrimary:   T.cream,        // dominant 60%
  surfaceElevated:  T.paper,        // opaque card fallback
  surfaceSunken:    T.creamDeep,
  surfaceAccent:    T.rose,
  surfaceBrand:     T.mauve,
  surfaceSuccess:   T.mint,

  // Liquid Glass — 15% translucent tints, combine w/ BlurView intensity 40-60
  glassLight:       'rgba(255,255,255,0.55)',
  glassTint:        'rgba(249,247,245,0.55)',
  glassRose:        'rgba(235,203,203,0.45)',
  glassMauve:       'rgba(212,165,165,0.45)',
  glassSage:        'rgba(200,213,194,0.45)',
  glassOverlay:     'rgba(74,63,63,0.35)',  // modal scrim

  // Strokes for glass — barely-there hairline
  glassStroke:      'rgba(255,255,255,0.6)',
  glassStrokeDark:  'rgba(74,63,63,0.08)',

  // Text intent
  textPrimary:      T.ink,
  textSecondary:    T.inkSoft,
  textTertiary:     T.inkMute,
  textOnBrand:      '#FFFFFF',
  textBrand:        T.mauveDeep,
  textSuccess:      T.successTx,
  textDanger:       T.errorTx,
};

// ─── Font families ──────────────────────────────────────────────────────────
export const F = {
  regular:  'IBMPlexSans_400Regular',
  semibold: 'IBMPlexSans_600SemiBold',
  bold:     'IBMPlexSans_700Bold',
};

// ─── Expressive radii ───────────────────────────────────────────────────────
// Use these — never literal numbers. Pill is the default for actionable
// surfaces; expressive is the default for content containers.
export const R = {
  hairline:   4,
  small:      10,
  medium:     14,
  expressive: 20,
  large:      28,
  pill:       9999,
};

// ─── Spring / motion physics ────────────────────────────────────────────────
// Drop-in configs for Animated.spring. Three speeds — gentle for entrance
// reveals, snappy for tap responses, bouncy for delight moments.
export const SPRING = {
  gentle: { damping: 18, stiffness: 110, mass: 1,   useNativeDriver: true },
  snappy: { damping: 22, stiffness: 260, mass: 0.7, useNativeDriver: true },
  bouncy: { damping: 12, stiffness: 180, mass: 0.8, useNativeDriver: true },
};

// ─── Difficulty presets ─────────────────────────────────────────────────────
// `kicker` is the English equivalent — used as a small uppercase eyebrow
// above the Turkish label so non-Turkish speakers can still place
// themselves on the curve.
export const DIFFICULTIES = [
  { id: 'easy',   label: 'Yeni başlayan', kicker: 'BEGINNER',     desc: 'Hızlı, fotoğrafa sadık',               tint: S.surfaceSuccess, gridSize: 45, numColors: 30 },
  { id: 'medium', label: 'Orta seviye',   kicker: 'INTERMEDIATE', desc: 'Dengeli — daha çok detay',             tint: S.surfaceAccent,  gridSize: 60, numColors: 30 },
  { id: 'hard',   label: 'İleri seviye',  kicker: 'PROFESSIONAL', desc: 'Maksimum detay, sembollü canlı chart', tint: S.surfaceBrand,   gridSize: 70, numColors: 30 },
];
