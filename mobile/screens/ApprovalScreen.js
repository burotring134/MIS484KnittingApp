import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert, TextInput, Modal, Pressable,
  Keyboard,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SPRING, TYPO } from '../utils/theme';
import { strings } from '../utils/i18n';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';

function PatternThumb({ pattern, size = 280 }) {
  const cw = size / pattern.width;
  const h  = pattern.height * cw;

  if (pattern.imageDataUri) {
    return (
      <Image
        source={{ uri: pattern.imageDataUri }}
        style={{ width: size, height: h, borderRadius: R.medium }}
        resizeMode="stretch"
      />
    );
  }

  const byColor = new Map();
  for (let r = 0; r < pattern.height; r++) {
    for (let c = 0; c < pattern.width; c++) {
      const cid = pattern.grid[r][c];
      let parts = byColor.get(cid);
      if (!parts) { parts = []; byColor.set(cid, parts); }
      parts.push(`M${c*cw} ${r*cw}h${cw}v${cw}h-${cw}z`);
    }
  }
  const items = [];
  for (const [cid, parts] of byColor) {
    const color = pattern.colors[cid];
    items.push(
      <Path key={`p-${cid}`} d={parts.join('')} fill={color?.dmcHex || '#ffffff'}/>
    );
  }
  if (cw >= 6) {
    for (let i = 1; i < pattern.height; i++) {
      items.push(<Line key={`h${i}`} x1={0} y1={i*cw} x2={size} y2={i*cw} stroke="rgba(74,63,63,0.08)" strokeWidth={0.4}/>);
    }
    for (let i = 1; i < pattern.width; i++) {
      items.push(<Line key={`v${i}`} x1={i*cw} y1={0} x2={i*cw} y2={pattern.height * cw} stroke="rgba(74,63,63,0.08)" strokeWidth={0.4}/>);
    }
  }
  return (
    <Svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
      {items}
    </Svg>
  );
}

// Segmented toggle — Glass-pill body with a brand-coloured thumb that
// slides between tab positions on SPRING.snappy. Two-layer feel: the
// pill is the resting surface, the thumb is the "pressed" layer that
// follows the active tab. Tab text colour flips synchronously with the
// active index (no need to animate colour itself — the slide carries
// the eye).
function SegmentedToggle({ tabs, active, onChange }) {
  const [tabW, setTabW] = useState(0);
  const slide = useRef(new Animated.Value(active)).current;

  useEffect(() => {
    Animated.spring(slide, { ...SPRING.snappy, toValue: active }).start();
  }, [active]);

  const translateX = slide.interpolate({
    inputRange:  [0, Math.max(tabs.length - 1, 1)],
    outputRange: [0, tabW * (tabs.length - 1)],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.segWrap}
      onLayout={(e) => setTabW(e.nativeEvent.layout.width / tabs.length)}
    >
      <Glass tone="light" radius={R.pill} intensity={30} style={styles.segGlass}>
        {tabW > 0 && (
          <Animated.View
            style={[styles.segThumb, { width: tabW, transform: [{ translateX }] }]}
          />
        )}
        {tabs.map((label, i) => (
          <TouchableOpacity
            key={label}
            onPress={() => onChange(i)}
            activeOpacity={0.7}
            style={styles.segTab}
            accessibilityRole="button"
            accessibilityState={{ selected: i === active }}
          >
            <Text style={[styles.segTabTxt, i === active && styles.segTabTxtActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </Glass>
    </View>
  );
}

export default function ApprovalScreen({ pattern, previewUri, onApprove, onDiscard }) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const y    = useRef(new Animated.Value(20)).current;
  const canCompare = !!previewUri;
  // Pattern is the "after" the user is here to approve — show it first.
  // Foto is the comparison tab they can toggle to. Without a photo we
  // hide the toggle entirely (nothing to compare against).
  const [view, setView] = useState('pattern');

  // Save sheet — controlled from this screen so the suggested name is
  // snapshotted at the moment the user taps "Atölyeme Ekle" (otherwise
  // a re-render mid-edit would overwrite their typing with a fresh
  // `new Date()` string).
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [pendingName, setPendingName] = useState('');

  const openSaveSheet = () => {
    haptics.success();
    setPendingName(`Pattern ${new Date().toLocaleDateString('tr-TR')}`);
    setSaveSheetOpen(true);
  };

  const confirmSave = () => {
    const trimmed = pendingName.trim();
    if (!trimmed) return;
    setSaveSheetOpen(false);
    onApprove?.(trimmed);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fade, { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(y,    { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  if (!pattern) return null;

  const photoHeight = 280 * (pattern.height / pattern.width);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <View style={styles.topBar}>
        <Text style={styles.kicker}>{strings.approvalKicker}</Text>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: y }] }}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, 14) + 100 },
          ]}
        >
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{strings.approvalTitle}</Text>
              <Text style={styles.sub}>
                {strings.approvalSub}
              </Text>
            </View>
          </View>

          <Glass tone="light" radius={R.large} intensity={45} style={styles.card}>
            {canCompare && (
              <SegmentedToggle
                tabs={[strings.approvalToggleTabPattern, strings.approvalToggleTabPhoto]}
                active={view === 'pattern' ? 0 : 1}
                onChange={(i) => setView(i === 0 ? 'pattern' : 'photo')}
              />
            )}

            <View style={styles.patternWrap}>
              {view === 'photo' && canCompare ? (
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: 280, height: photoHeight, borderRadius: R.medium }}
                  resizeMode="cover"
                />
              ) : (
                <PatternThumb pattern={pattern}/>
              )}
            </View>

            <View style={styles.stats}>
              {[
                { k: strings.approvalStatsCells,    v: `${pattern.width}×${pattern.height}` },
                { k: strings.approvalStatsStitches, v: (pattern.width * pattern.height).toLocaleString() },
                { k: strings.approvalStatsColors,   v: `${pattern.colors.length}` },
              ].map((s) => (
                <View key={s.k} style={styles.stat}>
                  <Text style={styles.statV}>{s.v}</Text>
                  <Text style={styles.statK}>{s.k}</Text>
                </View>
              ))}
            </View>
          </Glass>
        </ScrollView>
      </Animated.View>

      <View style={[styles.actions, { bottom: Math.max(insets.bottom, 14) + 14 }]}>
        <SpringBtn
          onPress={() => {
            Alert.alert(
              strings.approvalDeleteTitle,
              strings.approvalDeleteBody,
              [
                { text: strings.cancel, style: 'cancel' },
                {
                  text: strings.delete,
                  style: 'destructive',
                  onPress: () => { haptics.warn(); onDiscard?.(); },
                },
              ],
            );
          }}
          variant="ghost"
          label={strings.approvalDeleteBtn}
        />
        <SpringBtn onPress={openSaveSheet} variant="primary" label={strings.approvalAddBtn}/>
      </View>

      <SaveSheet
        visible={saveSheetOpen}
        name={pendingName}
        onChangeName={setPendingName}
        onCancel={() => setSaveSheetOpen(false)}
        onConfirm={confirmSave}
      />
    </View>
  );
}

// Save sheet — bottom-anchored Glass pill where the user names the
// pattern before it lands in the workshop. Controlled by the parent so
// the suggested name is snapshotted on open (see openSaveSheet above);
// internal state would race with parent re-renders that change the
// "today's date" suggestion mid-edit.
//
// Keyboard handling is intentionally manual rather than wrapped in
// KeyboardAvoidingView: on iOS inside a transparent Modal,
// KeyboardAvoidingView regularly mis-measures and leaves the sheet
// trapped behind the keyboard. Listening to Keyboard events and
// applying marginBottom = keyboardHeight to the Glass lifts the
// sheet reliably on both platforms.
//
// Focus also goes through a ref + setTimeout instead of `autoFocus`
// because Modal's fade-in animation often arrives after the input
// mounts, so the autoFocus request lands while the input is still
// off-screen and silently fails on iOS.
//
// Scrim behaviour follows the spec: while the keyboard is up a scrim
// tap only dismisses the keyboard, leaving the in-progress name
// intact. A second tap (keyboard now gone) closes the sheet.
function SaveSheet({ visible, name, onChangeName, onCancel, onConfirm }) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      // Delay slightly so the Modal's fade animation finishes before
      // we request focus — otherwise iOS drops the focus call while
      // the input is still off-screen and the keyboard never opens.
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
    setKeyboardHeight(0);
  }, [visible]);

  const handleScrimPress = () => {
    if (keyboardHeight > 0) {
      Keyboard.dismiss();
    } else {
      onCancel();
    }
  };

  const canSave = name.trim().length > 0;
  // Lift the sheet up by the keyboard height when it's open; otherwise
  // pad bottom with the safe-area inset so the grabber feels balanced.
  const sheetMarginBottom = keyboardHeight;
  const sheetPaddingBottom = keyboardHeight > 0 ? 14 : Math.max(insets.bottom, 14) + 6;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.saveSheetWrap}>
        <Pressable style={styles.saveSheetScrim} onPress={handleScrimPress}/>
        <Glass
          tone="light"
          radius={R.large}
          intensity={70}
          blurTint="light"
          style={[
            styles.saveSheet,
            { paddingBottom: sheetPaddingBottom, marginBottom: sheetMarginBottom },
          ]}
        >
          <View style={styles.saveSheetGrabber}/>
          <View style={styles.saveSheetHead}>
            <Text style={styles.saveSheetTitle}>{strings.approvalSheetTitle}</Text>
          </View>
          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={onChangeName}
            style={styles.saveSheetInput}
            placeholder={strings.approvalSheetPlaceholder}
            placeholderTextColor={T.inkMute}
            maxLength={40}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => { if (canSave) onConfirm(); }}
          />
          <View style={styles.saveSheetActions}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.85}
              style={[styles.saveSheetBtn, styles.saveSheetBtnGhost]}
            >
              <Text style={styles.saveSheetBtnGhostTxt}>{strings.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (canSave) onConfirm(); }}
              disabled={!canSave}
              activeOpacity={0.85}
              style={[styles.saveSheetBtn, styles.saveSheetBtnPrimary, !canSave && { opacity: 0.5 }]}
            >
              <Text style={styles.saveSheetBtnPrimaryTxt}>{strings.approvalSheetSaveBtn}</Text>
            </TouchableOpacity>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

function SpringBtn({ onPress, label, variant }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.96 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {isPrimary ? (
          <View style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnPrimaryTxt}>{label}</Text>
          </View>
        ) : (
          <Glass tone="light" radius={R.pill} intensity={40} style={styles.btn}>
            <Text style={styles.btnGhostTxt}>{label}</Text>
          </Glass>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: S.surfacePrimary,
  },
  topBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  kicker: { ...TYPO.kickerMd, color: S.textBrand },

  // paddingBottom is overridden inline with the actual safe-area inset
  // so the scroll content always clears the floating actions row no
  // matter how big the home-indicator gutter is.
  scroll: { padding: 20, paddingTop: 4 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 22,
  },
  title: { fontSize: 30, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.8, lineHeight: 36 },
  sub:   { fontSize: 14, fontFamily: F.regular, color: S.textSecondary, marginTop: 6, lineHeight: 22 },

  card: {
    padding: 14,
    shadowColor: T.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  // ── Segmented toggle ─────────────────────────────────────────
  segWrap: {
    marginBottom: 12,
  },
  segGlass: {
    flexDirection: 'row',
    height: 38,
    padding: 0,
  },
  // Thumb sits behind the tab labels (rendered first in source order).
  // SPRING.snappy carries it between positions; the active tab's text
  // colour flips on the same frame the user taps so the eye lands on
  // the slide, not the swap.
  segThumb: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    borderRadius: R.pill,
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  segTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segTabTxt: {
    fontSize: 13,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
  segTabTxtActive: {
    color: S.textOnBrand,
    fontFamily: F.bold,
  },
  patternWrap: {
    alignItems: 'center',
    backgroundColor: S.surfaceSunken,
    borderRadius: R.medium,
    padding: 8,
  },
  stats: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statV: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary },
  statK: { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary, letterSpacing: 0.5, marginTop: 2, textTransform: 'uppercase' },

  // `bottom` is overridden inline with `Math.max(insets.bottom, 14) + 14`
  // so the actions row clears the home-indicator gutter on iPhones with
  // a Dynamic Island / no-button chassis.
  actions: {
    position: 'absolute',
    left: 20, right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingVertical: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostTxt: { fontFamily: F.semibold, color: S.textSecondary, fontSize: 15 },
  btnPrimary: {
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  btnPrimaryTxt: { fontFamily: F.bold, color: S.textOnBrand, fontSize: 15, letterSpacing: 0.2 },

  // ── Save sheet ──
  // Sibling-scrim layout matching WorkshopScreen's bottom sheets so
  // touch routing stays consistent across the app: the scrim is its
  // own Pressable above (in flex-end terms) the Glass sheet, never a
  // wrapper around it.
  saveSheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  saveSheetScrim: {
    flex: 1,
    backgroundColor: S.glassOverlay,
  },
  saveSheet: {
    paddingTop: 8,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    // Glass.js's content view has `flex: 1`, which collapses in an
    // unconstrained parent (see DifficultyScreen option style for the
    // same workaround). A definite minHeight passes through Glass.js's
    // outer destructure and gives the content view a real vertical
    // budget so grabber + header + input + actions all render at their
    // intrinsic heights instead of squeezing to ~0.
    minHeight: 240,
  },
  saveSheetGrabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: T.line, alignSelf: 'center', marginBottom: 14,
  },
  saveSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  saveSheetTitle: {
    fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2,
    flexShrink: 1,
  },
  saveSheetInput: {
    fontSize: 16, fontFamily: F.regular, color: S.textPrimary,
    backgroundColor: S.surfaceSunken,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: R.medium,
    borderWidth: 1, borderColor: T.line,
  },
  saveSheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  saveSheetBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSheetBtnGhost: {
    backgroundColor: S.surfaceSunken,
    borderWidth: 1, borderColor: T.line,
  },
  saveSheetBtnGhostTxt: {
    fontSize: 14, fontFamily: F.semibold, color: S.textSecondary,
  },
  saveSheetBtnPrimary: {
    backgroundColor: S.surfaceBrand,
    shadowColor: T.mauveDeep, shadowOpacity: 0.22, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  saveSheetBtnPrimaryTxt: {
    fontSize: 14, fontFamily: F.bold, color: S.textOnBrand, letterSpacing: 0.2,
  },
});
