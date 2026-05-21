import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
  Switch, Alert, Linking, Animated, Modal, Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SPRING } from '../utils/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';
import appJson from '../app.json';

const APP_VERSION = appJson?.expo?.version || '1.0.0';
const HAPTICS_PREF_KEY = 'threadia.prefs.haptics';
const FEEDBACK_EMAIL = 'threadiaapp@gmail.com';

export default function SettingsScreen({ onBack }) {
  const { lang, strings, switchLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  // Initial fallback while the user record loads from AsyncStorage on
  // cold launch — keeps the row from flashing "Guest" between mount
  // and the context's first paint.
  const accountName = user?.displayName || user?.email || strings.settingsGuestName;
  const accountInitial = (accountName?.trim?.()[0] || 'T').toUpperCase();
  const accountSub = user?.email
    ? strings.accountLinkedSubAppleEmail(user.email)
    : strings.accountLinkedSubAppleNoMail;

  const confirmSignOut = () => {
    Alert.alert(
      strings.signOutConfirmTitle,
      strings.signOutConfirmBody,
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.signOutConfirmAction,
          style: 'destructive',
          onPress: () => { signOut(); onBack?.(); },
        },
      ],
    );
  };
  const insets = useSafeAreaInsets();
  const [hapticsOn, setHapticsOn] = useState(true);
  // Custom in-app picker for language — system Alert was iOS-styled
  // (looked alien against the Liquid Glass surface). The sheet matches
  // the SortSheet / ActionSheet pattern already used elsewhere.
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(HAPTICS_PREF_KEY);
      if (raw !== null) setHapticsOn(raw === '1');
    })();
  }, []);

  const toggleHaptics = async (next) => {
    setHapticsOn(next);
    try {
      await AsyncStorage.setItem(HAPTICS_PREF_KEY, next ? '1' : '0');
      await haptics.refreshHapticsPref();
      // Give a tap so the user feels the toggle "land" — only fires
      // when turning ON, since OFF should be silent.
      if (next) haptics.tap();
    } catch (e) {
      console.log('[settings] toggleHaptics failed:', e?.message);
    }
  };

  // Two-choice picker — surfaces the custom LanguageSheet (Glass bottom
  // sheet, matches SortSheet pattern) instead of an OS Alert. The sheet
  // calls switchLanguage when the user taps a row, which handles
  // persistence + module-level i18n mutation; the React Context
  // re-render then flips every screen at once.
  const openLanguage = () => setLangSheetOpen(true);
  const openTheme = () => Alert.alert(strings.settingsAlertThemeTitle, strings.settingsAlertThemeMsg);
  const openPrivacy = () => Alert.alert(strings.settingsAlertPrivacyTitle, strings.settingsAlertPrivacyMsg);

  const openFeedback = async () => {
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(strings.settingsFeedbackSubject)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) Linking.openURL(url);
      else Alert.alert(strings.settingsAlertEmailTitle, strings.settingsAlertEmailMsg(FEEDBACK_EMAIL));
    } catch {
      Alert.alert(strings.settingsAlertEmailTitle, strings.settingsAlertEmailMsg(FEEDBACK_EMAIL));
    }
  };

  // Double-confirm destructive wipe. First Alert frames the scope,
  // second confirms intent — matches the iOS "delete account"
  // convention so the user can't muscle-memory their way through it.
  const wipeAllData = () => {
    Alert.alert(
      strings.settingsWipeTitle,
      strings.settingsWipeBody,
      [
        { text: strings.cancel, style: 'cancel' },
        {
          text: strings.settingsWipeContinue,
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              strings.settingsWipeConfirmTitle,
              strings.settingsWipeConfirmBody,
              [
                { text: strings.cancel, style: 'cancel' },
                {
                  text: strings.delete,
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      haptics.warn();
                      await AsyncStorage.clear();
                      Alert.alert(strings.settingsWipedTitle, strings.settingsWipedBody, [
                        { text: strings.ok, onPress: () => onBack?.() },
                      ]);
                    } catch (err) {
                      Alert.alert(strings.settingsWipeFailedTitle, err?.message || strings.unknownError);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <View style={styles.topBar}>
        <SpringIconBtn onPress={onBack}><ChevronLeftIcon/></SpringIconBtn>
        <Text style={styles.topTitle}>{strings.settingsTitle}</Text>
        <View style={styles.topBarSpacer}/>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 18) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account ──────────────────────────────────────────────── */}
        <Section title={strings.settingsSectionAccount}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{accountInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName} numberOfLines={1}>{accountName}</Text>
              <Text style={styles.accountSub} numberOfLines={1}>{accountSub}</Text>
            </View>
          </View>
          <RowDivider/>
          <Row
            label={strings.settingsSignOutLabel}
            sub={strings.settingsSignOutSub}
            chevron
            danger
            onPress={confirmSignOut}
          />
        </Section>

        {/* ── Preferences ──────────────────────────────────────────── */}
        <Section title={strings.settingsSectionPrefs}>
          <Row
            label={strings.settingsHaptics}
            sub={strings.settingsHapticsSub}
            right={
              <Switch
                value={hapticsOn}
                onValueChange={toggleHaptics}
                trackColor={{ false: T.line, true: T.mauve }}
                thumbColor="#fff"
                ios_backgroundColor={T.line}
              />
            }
          />
          <RowDivider/>
          <Row
            label={strings.settingsLanguage}
            value={lang === 'tr' ? strings.settingsLanguageValueTr : strings.settingsLanguageValueEn}
            chevron
            onPress={openLanguage}
          />
          <RowDivider/>
          <Row
            label={strings.settingsTheme}
            value={strings.settingsThemeValue}
            chevron
            onPress={openTheme}
          />
        </Section>

        {/* ── Data ─────────────────────────────────────────────────── */}
        <Section title={strings.settingsSectionData}>
          <Row
            label={strings.settingsWipeLabel}
            sub={strings.settingsWipeSub}
            chevron
            danger
            onPress={wipeAllData}
          />
        </Section>

        {/* ── About ────────────────────────────────────────────────── */}
        <Section title={strings.settingsSectionAbout}>
          <Row label={strings.settingsVersionLabel} value={APP_VERSION}/>
          <RowDivider/>
          <Row
            label={strings.settingsFeedbackLabel}
            sub={FEEDBACK_EMAIL}
            chevron
            onPress={openFeedback}
          />
          <RowDivider/>
          <Row
            label={strings.settingsPrivacyLabel}
            chevron
            onPress={openPrivacy}
          />
        </Section>

        <Text style={styles.footnote}>
          Threadia · {APP_VERSION}
        </Text>
      </ScrollView>

      <LanguageSheet
        visible={langSheetOpen}
        lang={lang}
        onPick={(code) => { setLangSheetOpen(false); switchLanguage(code); }}
        onClose={() => setLangSheetOpen(false)}
      />
    </View>
  );
}

// ─── LanguageSheet ───────────────────────────────────────────────────────────
// In-app language picker — Glass bottom sheet with two rows + radio
// bullet for the active option. Mirrors SortSheet's structure
// (sibling scrim, Glass intensity 70, sheet rows with bullet) so it
// reads as part of the same sheet family. Row labels are the language
// endonyms ("Türkçe" / "English") — those are universal regardless of
// the currently selected app language, so they aren't routed through
// i18n strings.
function LanguageSheet({ visible, lang, onPick, onClose }) {
  const { strings } = useLanguage();
  const insets = useSafeAreaInsets();
  const OPTS = [
    { code: 'tr', label: 'Türkçe' },
    { code: 'en', label: 'English' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={sheetStyles.wrap}>
        <Pressable style={sheetStyles.scrim} onPress={onClose}/>
        <Glass
          tone="light"
          radius={R.large}
          intensity={70}
          blurTint="light"
          style={[sheetStyles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}
        >
          <View style={sheetStyles.grabber}/>
          <Text style={sheetStyles.title}>{strings.settingsLanguagePickTitle}</Text>
          <View style={sheetStyles.divider}/>
          {OPTS.map((opt) => {
            const active = opt.code === lang;
            return (
              <TouchableOpacity
                key={opt.code}
                onPress={() => onPick(opt.code)}
                activeOpacity={0.7}
                style={sheetStyles.row}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={opt.label}
              >
                <View style={[sheetStyles.bullet, active && sheetStyles.bulletActive]}>
                  {active && <View style={sheetStyles.bulletDot}/>}
                </View>
                <Text style={[sheetStyles.rowLabel, active && { color: S.textBrand, fontFamily: F.bold }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={sheetStyles.cancel}>
            <Text style={sheetStyles.cancelTxt}>{strings.cancel}</Text>
          </TouchableOpacity>
        </Glass>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    flex: 1,
    backgroundColor: S.glassOverlay,
  },
  // minHeight load-bearing — Glass.js's content view has flex:1, which
  // collapses to 0 in an unconstrained-height parent. With a definite
  // floor here the grabber + title + rows render at intrinsic height.
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 240,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: T.line,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: T.lineSoft,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  bullet: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  bulletActive: {
    borderColor: T.mauve,
  },
  bulletDot: {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: T.mauve,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: F.semibold,
    color: S.textPrimary,
    letterSpacing: -0.1,
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: R.pill,
    alignItems: 'center',
    backgroundColor: S.surfaceSunken,
    borderWidth: 1,
    borderColor: T.line,
  },
  cancelTxt: {
    fontSize: 14,
    fontFamily: F.semibold,
    color: S.textSecondary,
    letterSpacing: 0.2,
  },
});

// ─── Section + Row helpers ───────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Glass tone="light" radius={R.large} intensity={40} style={styles.sectionCard}>
        {children}
      </Glass>
    </View>
  );
}

function Row({ label, sub, value, chevron, danger, loading, onPress, right }) {
  const content = (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right ? (
        right
      ) : (
        <View style={styles.rowRight}>
          {value && <Text style={styles.rowValue}>{value}</Text>}
          {chevron && !loading && <ChevronRightIcon/>}
          {loading && <Text style={styles.rowValue}>...</Text>}
        </View>
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.65}>
      {content}
    </TouchableOpacity>
  );
}

function RowDivider() {
  return <View style={styles.divider}/>;
}

// ─── Icons ───────────────────────────────────────────────────────────────────
function ChevronLeftIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={T.inkMute} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function SpringIconBtn({ children, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.92 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Glass tone="light" radius={R.medium} intensity={40} style={styles.iconBtn}>
          {children}
        </Glass>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.surfacePrimary },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  topBarSpacer: { width: 40 },

  scroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 16,
  },

  // ── Section ──
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: F.bold,
    color: S.textTertiary,
    letterSpacing: 1.6,
    paddingHorizontal: 6,
  },
  sectionCard: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: T.ink,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: F.semibold,
    color: S.textPrimary,
    letterSpacing: -0.1,
  },
  rowLabelDanger: { color: S.textDanger },
  rowSub: {
    fontSize: 12,
    fontFamily: F.regular,
    color: S.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: F.semibold,
    color: S.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: T.lineSoft,
    marginLeft: 0,
  },

  // ── Account ──
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: S.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.20,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatarTxt: {
    fontSize: 20,
    fontFamily: F.bold,
    color: S.textOnBrand,
    letterSpacing: 0.2,
  },
  accountName: {
    fontSize: 16,
    fontFamily: F.bold,
    color: S.textPrimary,
    letterSpacing: -0.2,
  },
  accountSub: {
    fontSize: 12,
    fontFamily: F.regular,
    color: S.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  footnote: {
    fontSize: 11,
    fontFamily: F.semibold,
    color: S.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 16,
    opacity: 0.7,
  },
});
