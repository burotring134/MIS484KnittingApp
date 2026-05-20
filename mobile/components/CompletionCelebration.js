import { useEffect, useRef } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity, Animated, Pressable,
} from 'react-native';
import Svg, { Circle, Path, G, Line } from 'react-native-svg';
import { T, F, S, R, SP, SPRING, TYPO } from '../utils/theme';
import { strings, lang } from '../utils/i18n';
import Glass from './Glass';
import * as haptics from '../utils/haptics';

// Average hand-stitching pace for cross-stitch — ~350 stitches per hour
// is a midpoint between beginner (~200) and experienced (~500). Used to
// derive a rough hour estimate for the celebration body. Whole-hour
// rounding keeps the copy human ("12 saat" reads better than "11.7 saat").
const STITCHES_PER_HOUR = 350;

function estimateHours(stitchCount) {
  return Math.max(1, Math.round(stitchCount / STITCHES_PER_HOUR));
}

// ─── Component ───────────────────────────────────────────────────────────
// First-tap-on-a-completed-card celebration sheet. WorkshopScreen owns
// the trigger logic + flag persistence; this component just renders the
// surface and routes the two CTAs back to the parent.
//
// `project` is null when hidden, set to the project payload when shown.
// `onPdf` should kick off the export from the parent (using utils/pdf's
// buildPdfHtml + expo-print). `onClose` clears the modal and returns
// the user to the workshop list.
export default function CompletionCelebration({ project, onPdf, onClose }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.92)).current;
  const lift    = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!project) return;
    opacity.setValue(0);
    scale.setValue(0.92);
    lift.setValue(20);
    haptics.success();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: false }),
      Animated.spring(scale,   { ...SPRING.bouncy, toValue: 1 }),
      Animated.spring(lift,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, [project?.id]);

  if (!project) return null;

  const totalStitches = project.width * project.height;
  const hours = estimateHours(totalStitches);

  return (
    <Modal
      visible={!!project}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View
          style={[styles.cardWrap, { transform: [{ scale }, { translateY: lift }] }]}
          pointerEvents="box-none"
        >
          <Glass tone="light" radius={R.large} intensity={70} style={styles.card}>
            {/* Gold rosette illustration — same palette family as the
                badge on the card, so the celebration reads as the
                "earned" companion to that pill. */}
            <View style={styles.rosetteWrap}>
              <Rosette />
            </View>

            <Text style={styles.kicker}>{strings.completionKicker}</Text>
            {/* Title allows up to 3 lines for long project names —
                h2 was eating the right edge on anything longer than
                ~14 chars. */}
            <Text style={styles.title} numberOfLines={3}>
              {strings.completionTitle(project.name)}
            </Text>
            <Text style={styles.body}>
              {strings.completionBody(
                totalStitches.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US'),
                hours,
              )}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onPdf}
                activeOpacity={0.85}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel={strings.completionPdfBtn}
              >
                <PdfIcon />
                <Text style={styles.primaryTxt}>{strings.completionPdfBtn}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.85}
                style={styles.ghostBtn}
                accessibilityRole="button"
                accessibilityLabel={strings.completionBackBtn}
              >
                <Text style={styles.ghostTxt}>{strings.completionBackBtn}</Text>
              </TouchableOpacity>
            </View>
          </Glass>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Illustration ────────────────────────────────────────────────────────
// 8-pointed rosette in gold/mauve — evokes an embroidered medal without
// committing to a single visual metaphor. Star burst + filled center
// disc + check mark, sized 132×132 to match the milestone celebration's
// illustration footprint for a consistent feel across the two surfaces.
function Rosette() {
  return (
    <Svg width="132" height="132" viewBox="0 0 132 132" fill="none">
      {/* Outer halo */}
      <Circle cx="66" cy="66" r="60" stroke={T.gold} strokeWidth="1.5" opacity={0.45} fill="none" />

      {/* 8-point rosette rays */}
      <G stroke={T.gold} strokeWidth="2.5" strokeLinecap="round" opacity={0.85}>
        <Line x1="66" y1="6" x2="66" y2="18" />
        <Line x1="66" y1="114" x2="66" y2="126" />
        <Line x1="6" y1="66" x2="18" y2="66" />
        <Line x1="114" y1="66" x2="126" y2="66" />
        <Line x1="22" y1="22" x2="30" y2="30" />
        <Line x1="102" y1="102" x2="110" y2="110" />
        <Line x1="22" y1="110" x2="30" y2="102" />
        <Line x1="102" y1="30" x2="110" y2="22" />
      </G>

      {/* Mauve ring backdrop for the gold disc */}
      <Circle cx="66" cy="66" r="44" fill={T.rose} opacity={0.55} />

      {/* Gold disc */}
      <Circle cx="66" cy="66" r="38" fill={T.gold} />
      <Circle cx="66" cy="66" r="38" stroke={T.goldDeep} strokeWidth="2" fill="none" />

      {/* Inner stitched ring — dashed circle for the cross-stitch nod */}
      <Circle
        cx="66" cy="66" r="30"
        stroke={T.goldDeep}
        strokeWidth="1.2"
        strokeDasharray="3 3"
        opacity={0.55}
        fill="none"
      />

      {/* Centered checkmark */}
      <Path
        d="M50 66 L62 78 L86 52"
        stroke={T.paper}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function PdfIcon() {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: S.glassOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  cardWrap: {
    width: '100%',
    // Bumped from 360 → 380 so multi-word project names + "bitti."
    // have more horizontal room. Still leaves a 14 pt gutter on a
    // 393 pt iPhone screen with the 28 pt scrim padding.
    maxWidth: 380,
  },
  // Glass's `content: flex:1` clamps the outer wrap to whatever
  // minHeight we set — it never grows past it, and removing the
  // floor collapses the card. So we set minHeight to a value tuned
  // to our natural content height: rosette (144) + kicker (21) +
  // title (32) + body (60) + actions (101) + paddings (44) ≈ 402.
  // 420 gives a small breathing buffer below "Atölyeye dön" without
  // leaving dead space. Long names that push the title to 2 lines
  // add ~24 — those will tap the floor, RN will silently let the
  // ghost text bottom-shave a few px in that edge case.
  card: {
    paddingHorizontal: SP.lg,
    paddingTop: SP.xl,
    paddingBottom: SP.xl,
    alignItems: 'center',
    minHeight: 420,
    shadowColor: T.ink,
    shadowOpacity: 0.24,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  rosetteWrap: {
    marginBottom: SP.md,
    alignItems: 'center', justifyContent: 'center',
  },
  kicker: {
    ...TYPO.kickerMd,
    color: T.goldDeep,
    marginBottom: SP.sm,
  },
  // h3 instead of h2 — h2 (22 pt) was wrapping ugly on names like
  // "Çay Fincanı bitti." Drop one notch to h3 (17 pt) so the
  // headline stays single-line for most names and only wraps on
  // truly long ones.
  title: {
    ...TYPO.h3,
    color: S.textPrimary,
    textAlign: 'center',
    marginBottom: SP.sm,
  },
  body: {
    ...TYPO.bodyMd,
    color: S.textSecondary,
    textAlign: 'center',
    marginBottom: SP.lg,
  },
  // Generous gap so the primary CTA and the ghost dismiss don't blur
  // into one tap target.
  actions: {
    width: '100%',
    gap: SP.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: R.pill,
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryTxt: {
    fontSize: 14,
    fontFamily: F.bold,
    color: S.textOnBrand,
    letterSpacing: 0.3,
  },
  // Bumped vertical padding so the dismiss feels like a real button
  // (24+ pt tap target) and the text sits visually centered within
  // its own breathing room rather than crashing into the card edge.
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: R.pill,
  },
  ghostTxt: {
    fontSize: 13,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
});
