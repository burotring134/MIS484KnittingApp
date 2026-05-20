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

  // Achievement — muted warm gold for the completion badge. Tuned for
  // the cream/mauve palette: more brass than yellow so it doesn't fight
  // the soft pinks, still reads as "gold" against the cream root.
  gold:       '#C9A961',
  goldDeep:   '#A8884A',
  goldSoft:   'rgba(201,169,97,0.18)',  // tint behind the pill
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

// ─── Spacing scale ──────────────────────────────────────────────────────────
// Use SP.* instead of literal pixel values for paddings, margins and
// gaps so the rhythm stays consistent across the app. xs–xxl is the
// standard 4-px doubling ladder; the two named values cover the most
// common screen-level spaces (between sections, and the side gutter on
// content scrolls).
export const SP = {
  xs:         4,
  sm:         8,
  md:         12,
  lg:         16,
  xl:         22,
  xxl:        32,
  sectionGap: 28,
  contentPad: 20,
};

// ─── Typography presets ─────────────────────────────────────────────────────
// Pre-composed text styles — spread these into a Text's style array so
// font-family + size + letter-spacing + line-height stay in lockstep.
// Caller adds `color` (and any one-off marginTop / textAlign) on top.
//
// kicker* — uppercase pill labels above sections / inside cards. The
// scale tracks the surface size: kickerSm sits inside compact tiles,
// kickerMd labels regular sections, kickerLg leads full-screen titles.
//
// body* — running text. Each size has a 1.5–1.6× line-height per the
// style guide's readability rule.
//
// h1 / h2 / h3 — screen titles, section titles, dialog titles.
export const TYPO = {
  kickerSm: { fontSize: 10, fontFamily: F.bold, letterSpacing: 1.8, textTransform: 'uppercase' },
  kickerMd: { fontSize: 11, fontFamily: F.bold, letterSpacing: 2.0, textTransform: 'uppercase' },
  kickerLg: { fontSize: 11, fontFamily: F.bold, letterSpacing: 2.4, textTransform: 'uppercase' },

  bodyXs:   { fontSize: 11, fontFamily: F.regular, lineHeight: 16 },
  bodySm:   { fontSize: 12, fontFamily: F.regular, lineHeight: 18 },
  bodyMd:   { fontSize: 14, fontFamily: F.regular, lineHeight: 22 },
  bodyLg:   { fontSize: 16, fontFamily: F.regular, lineHeight: 26 },

  h1:       { fontSize: 32, fontFamily: F.bold, letterSpacing: -1,   lineHeight: 40 },
  h2:       { fontSize: 22, fontFamily: F.bold, letterSpacing: -0.4, lineHeight: 30 },
  h3:       { fontSize: 17, fontFamily: F.bold, letterSpacing: -0.2, lineHeight: 24 },
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
// above the localised label so non-native speakers can still place
// themselves on the curve. Label/desc/lockedNote come from i18n; the
// list is evaluated at module load with whatever language was selected
// at boot, which matches the rest of the i18n surface.
import { strings as i18n } from './i18n';

export const DIFFICULTIES = [
  { id: 'easy',   label: i18n.diffEasyLabel,   kicker: 'BEGINNER',     desc: i18n.diffEasyDesc,   tint: S.surfaceSuccess, gridSize: 45, numColors: 30 },
  { id: 'medium', label: i18n.diffMediumLabel, kicker: 'INTERMEDIATE', desc: i18n.diffMediumDesc, tint: S.surfaceAccent,  gridSize: 60, numColors: 30 },
  { id: 'hard',   label: i18n.diffHardLabel,   kicker: 'PROFESSIONAL', desc: i18n.diffHardDesc,   tint: S.surfaceBrand,   gridSize: 70, numColors: 30, disabled: true, lockedNote: i18n.comingSoon },
];
