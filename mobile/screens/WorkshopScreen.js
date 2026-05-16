import { useState, useMemo, useRef, useEffect, memo } from 'react';
import {
  View, Text, Image, ScrollView, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Modal, TextInput, Pressable, Animated, LayoutAnimation,
  Platform, UIManager, RefreshControl, Keyboard,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, F, S, R, SPRING } from '../utils/theme';
import { deleteProject, updateProject } from '../utils/storage';
import * as haptics from '../utils/haptics';
import Glass from '../components/Glass';
import Snackbar from '../components/Snackbar';

// Enable LayoutAnimation on Android — used so neighbouring cards flow
// naturally into the space left by a deleted project (motion-physics
// section 5).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DIFF_TINTS = {
  easy:   { label: 'Kolay', tone: 'sage',  fg: S.textSuccess },
  medium: { label: 'Orta',  tone: 'mauve', fg: S.textBrand },
  hard:   { label: 'Zor',   tone: 'rose',  fg: S.textBrand },
};

const cellCount      = (p) => p.width * p.height;
const completedCount = (p) => (p.completed ? Object.keys(p.completed).length : 0);

// ─────────────────────────────────────────────────────────────────────────────
const Mini = memo(function Mini({ pattern, size = 84 }) {
  if (pattern.imageDataUri) {
    return (
      <Image
        source={{ uri: pattern.imageDataUri }}
        style={{ width: size, height: size }}
        resizeMode="stretch"
      />
    );
  }
  const cw = size / Math.max(pattern.width, pattern.height);
  const byColor = new Map();
  for (let r = 0; r < pattern.height; r++) {
    for (let c = 0; c < pattern.width; c++) {
      const cid = pattern.grid[r][c];
      let parts = byColor.get(cid);
      if (!parts) { parts = []; byColor.set(cid, parts); }
      parts.push(`M${c * cw} ${r * cw}h${cw}v${cw}h-${cw}z`);
    }
  }
  const items = [];
  for (const [cid, parts] of byColor) {
    const color = pattern.colors[cid];
    items.push(
      <Path key={`mp-${cid}`} d={parts.join('')} fill={color?.dmcHex || '#fff'}/>
    );
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {items}
    </Svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ProjectCard — glass surface, scales on press, fades + drops on delete.
// The deleting prop drives a leaving spring; once it lands, the card is
// unmounted by the parent and LayoutAnimation flows neighbours in.
function ProjectCard({ project, onOpen, onMenu, deleting }) {
  const done  = completedCount(project);
  const total = cellCount(project);
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const diff  = DIFF_TINTS[project.difficulty] || DIFF_TINTS.medium;

  const scale = useRef(new Animated.Value(1)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fade,   { ...SPRING.gentle, toValue: 1 }),
      Animated.spring(enterY, { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!deleting) return;
    Animated.parallel([
      Animated.spring(scale, { ...SPRING.snappy, toValue: 0.86 }),
      Animated.spring(fade,  { ...SPRING.gentle, toValue: 0 }),
    ]).start();
  }, [deleting]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ scale }, { translateY: enterY }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onOpen}
        onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.98 }).start()}
        onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
      >
        <Glass tone="light" radius={R.expressive} intensity={45} style={styles.card}>
          <View style={styles.thumbWrap}>
            <Mini pattern={project}/>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHead}>
              <Text style={styles.cardName} numberOfLines={1}>{project.name}</Text>
            </View>

            <View style={styles.cardMetaRow}>
              <Glass tone={diff.tone} radius={R.pill} intensity={35} style={styles.diffPill}>
                <Text style={[styles.diffPillTxt, { color: diff.fg }]}>{diff.label}</Text>
              </Glass>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {project.width}×{project.height} · {total.toLocaleString('tr-TR')} stitch
              </Text>
            </View>

            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%` }, pct >= 100 && styles.barFillDone]}/>
            </View>
            <View style={styles.cardFootRow}>
              <Text style={styles.cardPct}>{pct}%</Text>
              <Text style={styles.cardDate}>{new Date(project.createdAt).toLocaleDateString('tr-TR')}</Text>
            </View>
          </View>
        </Glass>
      </TouchableOpacity>

      {/* Menu button — sibling of the card's TouchableOpacity, not a
          child. Nesting a touchable inside another touchable was eating
          the tap: parent's onPressIn fired and held the card scaled
          while the inner onPress never made it through the responder. */}
      <TouchableOpacity
        onPress={onMenu}
        hitSlop={14}
        activeOpacity={0.6}
        style={styles.menuBtn}
        accessibilityRole="button"
        accessibilityLabel="Seçenekler"
      >
        <DotsIcon/>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ActionSheet({ visible, project, onClose, onRename, onReset, onDelete }) {
  const insets = useSafeAreaInsets();
  if (!project) return null;

  // Sibling scrim + sheet, not nested. Earlier the sheet was wrapped in
  // a no-op Pressable inside the backdrop Pressable — that combination
  // (plus BlurView under the sheet) ate taps on the inner buttons on
  // iOS, leaving the sheet stuck at the bottom. Putting the scrim and
  // the sheet side-by-side fixes touch routing: the scrim is the only
  // thing in the area above the sheet, the sheet's buttons own their
  // own area, no ambiguity.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetBackdropWrap}>
        <Pressable style={styles.sheetScrim} onPress={onClose}/>
        <Glass
          tone="light"
          radius={R.large}
          intensity={70}
          blurTint="light"
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}
        >
          <View style={styles.sheetGrabber}/>
          <Text style={styles.sheetTitle} numberOfLines={1}>{project.name}</Text>

          <View style={styles.sheetDivider}/>

          <SheetAction icon={<PencilIcon color={T.ink}/>} label="Yeniden adlandır" onPress={onRename}/>
          <SheetAction icon={<RefreshIcon color={T.ink}/>} label="İlerlemeyi sıfırla"
            sub="İşaretli hücreler temizlenir, pattern kalır" onPress={onReset}/>
          <SheetAction icon={<TrashIcon color={T.errorTx}/>} label="Sil"
            sub="Bu işlem geri alınamaz" danger onPress={onDelete}/>

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelTxt}>İptal</Text>
          </TouchableOpacity>
        </Glass>
      </View>
    </Modal>
  );
}

function SheetAction({ icon, label, sub, danger, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.sheetRow}>
      <View style={[styles.sheetIcon, danger && styles.sheetIconDanger]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sheetRowLabel, danger && styles.sheetRowLabelDanger]}>{label}</Text>
        {sub && <Text style={styles.sheetRowSub}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SortSheet — bottom sheet listing three sort options. Reuses the same
// scrim-as-sibling layout as ActionSheet so the touch routing matches.
const SORT_OPTS = [
  { id: 'recent',   label: 'Yeni',      sub: 'En son eklenen önce' },
  { id: 'progress', label: 'İlerleme',  sub: 'Tamamlanma yüzdesi' },
  { id: 'name',     label: 'İsim',      sub: 'A-Z alfabetik' },
];

function SortSheet({ visible, value, onClose, onPick }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetBackdropWrap}>
        <Pressable style={styles.sheetScrim} onPress={onClose}/>
        <Glass
          tone="light"
          radius={R.large}
          intensity={70}
          blurTint="light"
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}
        >
          <View style={styles.sheetGrabber}/>
          <Text style={styles.sheetTitle}>Sırala</Text>
          <View style={styles.sheetDivider}/>
          {SORT_OPTS.map((opt) => {
            const active = opt.id === value;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => onPick(opt.id)}
                activeOpacity={0.7}
                style={styles.sheetRow}
              >
                <View style={[styles.sortBullet, active && styles.sortBulletActive]}>
                  {active && <View style={styles.sortBulletDot}/>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetRowLabel, active && { color: S.textBrand }]}>{opt.label}</Text>
                  <Text style={styles.sheetRowSub}>{opt.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelTxt}>Kapat</Text>
          </TouchableOpacity>
        </Glass>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterBar — search input + sort chip. Search filters by name, the chip
// opens SortSheet for ordering. Both controls are Glass pills to read as
// one filter unit.
function FilterBar({ query, onQueryChange, sort, onSortPress }) {
  const sortLabel = SORT_OPTS.find((o) => o.id === sort)?.label || 'Yeni';
  return (
    <View style={styles.filterBar}>
      <Glass tone="light" radius={R.pill} intensity={35} style={styles.searchGlass}>
        <SearchIcon/>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Ara…"
          placeholderTextColor={T.inkMute}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {!!query && (
          <TouchableOpacity onPress={() => onQueryChange('')} hitSlop={10} activeOpacity={0.6} style={styles.clearBtn}>
            <Text style={styles.clearBtnTxt}>×</Text>
          </TouchableOpacity>
        )}
      </Glass>

      <TouchableOpacity onPress={onSortPress} activeOpacity={0.7}>
        <Glass tone="light" radius={R.pill} intensity={35} style={styles.sortChip}>
          <Text style={styles.sortChipTxt}>{sortLabel}</Text>
          <ChevronDownIcon/>
        </Glass>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DifficultyFilter — four pill chips. Active uses solid brand, passives
// stay glass so the active state pops without colour-on-colour noise.
const DIFF_OPTS = [
  { id: 'all',    label: 'Hepsi' },
  { id: 'easy',   label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard',   label: 'Zor' },
];

function DifficultyFilter({ value, onChange }) {
  return (
    <View style={styles.diffRow}>
      {DIFF_OPTS.map((opt) => {
        const active = opt.id === value;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.7}
          >
            {active ? (
              <View style={[styles.diffChip, styles.diffChipActive]}>
                <Text style={[styles.diffChipTxt, styles.diffChipTxtActive]}>{opt.label}</Text>
              </View>
            ) : (
              <Glass tone="light" radius={R.pill} intensity={30} style={styles.diffChip}>
                <Text style={styles.diffChipTxt}>{opt.label}</Text>
              </Glass>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyDecoration — three mock "future project" cards stacked diagonally
// behind the empty-state CTA. Pure decoration, non-interactive. Uses the
// same swatch-row recipe as CollectionScreen cards so it reads as
// "templates waiting for you" rather than random shapes.
const MOCK_PATTERNS = [
  { name: 'Lavanta Bahçesi', size: '45×45', swatches: [T.mauve, T.rose, T.mint, T.creamDeep, T.mauveDeep] },
  { name: 'Akşam Pembesi',   size: '60×60', swatches: [T.rose, T.mauve, T.paper, T.mint, T.mauveDeep] },
  { name: 'Sage & Cream',    size: '50×50', swatches: [T.mint, T.successTx, T.creamDeep, T.paper, T.rose] },
];

function EmptyDecoration() {
  return (
    <View style={styles.emptyMockRow} pointerEvents="none">
      {MOCK_PATTERNS.map((tpl, i) => (
        <Glass
          key={i}
          tone="light"
          radius={R.expressive}
          intensity={35}
          style={[
            styles.emptyMockCard,
            { transform: [{ rotate: `${(i - 1) * 4}deg` }, { translateY: i === 1 ? -6 : 0 }] },
          ]}
        >
          <View style={styles.emptyMockSwatchRow}>
            {tpl.swatches.map((hex, j) => (
              <View key={j} style={[styles.emptyMockSwatch, { backgroundColor: hex }]}/>
            ))}
          </View>
          <Text style={styles.emptyMockName} numberOfLines={1}>{tpl.name}</Text>
          <Text style={styles.emptyMockMeta}>{tpl.size}</Text>
        </Glass>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function RenameDialog({ visible, currentName, onCancel, onConfirm }) {
  const [value, setValue] = useState(currentName || '');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { if (visible) setValue(currentName || ''); }, [visible, currentName]);

  // Track keyboard height so we can shrink the centring area by the
  // keyboard's space when it's up. Otherwise the dialog stays centred
  // on the full screen and its bottom half hides behind the keyboard.
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

  // Programmatic focus — autoFocus drops on iOS when the input mounts
  // mid-Modal-fade. A short delay lets the animation settle before we
  // request focus so the keyboard reliably opens.
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
    setKeyboardHeight(0);
  }, [visible]);

  // Sibling-scrim pattern: absoluteFill Pressable covers the whole
  // modal area, Glass dialog renders on top. paddingBottom shrinks
  // the centred area by keyboardHeight so the dialog re-centres above
  // the keyboard when it's up.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.dialogBackdropWrap, { paddingBottom: keyboardHeight }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onCancel}/>
        <Glass tone="light" radius={R.large} intensity={70} blurTint="light" style={styles.dialog}>
          <Text style={styles.dialogTitle}>Yeniden adlandır</Text>
          <Text style={styles.dialogSub}>Pattern için yeni bir isim gir.</Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={setValue}
            style={styles.dialogInput}
            placeholder="Pattern adı"
            placeholderTextColor={T.inkMute}
            selectTextOnFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => value.trim() && onConfirm(value.trim())}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.85} style={[styles.dialogBtn, styles.dialogBtnGhost]}>
              <Text style={styles.dialogBtnGhostTxt}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => value.trim() && onConfirm(value.trim())}
              disabled={!value.trim()}
              activeOpacity={0.85}
              style={[styles.dialogBtn, styles.dialogBtnPrimary, !value.trim() && { opacity: 0.5 }]}
            >
              <Text style={styles.dialogBtnPrimaryTxt}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
function ChevronLeftIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function ChevronDownIcon({ color = T.inkSoft }) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function SearchIcon({ color = T.inkSoft }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path d="M11 19a8 8 0 1 1 5.293-14.293A8 8 0 0 1 11 19zm9 1l-4.35-4.35"
        stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function PlusIcon({ color = T.mauveDeep }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
    </Svg>
  );
}
function DotsIcon() {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path d="M12 6.5v.01M12 12v.01M12 17.5v.01" stroke={T.inkSoft} strokeWidth="3" strokeLinecap="round"/>
    </Svg>
  );
}
function PencilIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function RefreshIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path d="M3 12a9 9 0 0 1 15.5-6.3M21 12a9 9 0 0 1-15.5 6.3M21 4v5h-5M3 20v-5h5"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function TrashIcon({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

function SpringIconBtn({ children, onPress, primary }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { ...SPRING.snappy, toValue: 0.92 }).start()}
      onPressOut={() => Animated.spring(scale, { ...SPRING.bouncy, toValue: 1 }).start()}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {primary ? (
          <View style={[styles.iconBtn, styles.iconBtnPrimary]}>{children}</View>
        ) : (
          <Glass tone="light" radius={R.medium} intensity={40} style={styles.iconBtn}>
            {children}
          </Glass>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WorkshopScreen({ projects, onBack, onOpen, onRefresh, onNew, onCollection }) {
  const insets = useSafeAreaInsets();
  const [menuFor, setMenuFor]     = useState(null);
  const [renameFor, setRenameFor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Optimistic-delete undo window. `pendingDelete` drives both the
  // Snackbar's visibility and the filter that hides the soon-to-be-
  // deleted project from the list. The ref mirror is for callbacks
  // that need the current value without re-running on every state
  // change.
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingDeleteRef = useRef(null);
  // Keep a ref to the latest onRefresh so the unmount-cleanup path
  // (which runs with stale closures by definition) can still notify
  // the parent after a silent commit.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; });

  const setPending = (next) => {
    pendingDeleteRef.current = next;
    setPendingDelete(next);
  };

  // Persists the pending delete to storage + backend and notifies the
  // parent. Used by the Snackbar's 5 s auto-dismiss, by "new delete
  // commits previous" inside handleDelete, and by the unmount
  // cleanup. Safe to call when no pending — early-returns.
  const commitPending = async () => {
    const target = pendingDeleteRef.current;
    if (!target) return;
    setPending(null);
    try {
      await deleteProject(target.id);
      haptics.success();
      onRefresh?.();
    } catch (err) {
      console.log('[workshop] commitPending failed:', err.message);
    }
  };

  // User tapped "Geri Al" — bring the card back. Storage was never
  // touched, so the parent's `projects` still has the entry; clearing
  // pendingDelete simply un-filters it.
  const undoPending = () => {
    if (!pendingDeleteRef.current) return;
    haptics.tap();
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.7 },
    });
    setPending(null);
  };

  // On unmount, commit any in-flight pending delete — the user
  // implicitly accepted it by navigating away. Notifies the parent
  // via the ref so the stale-closure trap doesn't bite.
  useEffect(() => {
    return () => {
      const target = pendingDeleteRef.current;
      if (target) {
        pendingDeleteRef.current = null;
        deleteProject(target.id)
          .then(() => onRefreshRef.current?.())
          .catch(() => {});
      }
    };
  }, []);

  // Pull-to-refresh — asks App.js to force a server sync, then waits
  // for the parent re-fetch to finish before relaxing the spinner.
  // try/finally guarantees the spinner clears even on a network error.
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.({ forceServerSync: true });
    } finally {
      setRefreshing(false);
    }
  };

  // Filter / sort state — local only, resets on remount.
  const [query, setQuery]               = useState('');
  const [difficulty, setDifficulty]     = useState('all');
  const [sort, setSort]                 = useState('recent');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const hasFilter = query.trim() !== '' || difficulty !== 'all';
  const resetFilters = () => { setQuery(''); setDifficulty('all'); };

  const filtered = useMemo(() => {
    let list = projects;
    // Hide the soon-to-be-deleted project while the undo window is
    // open. Storage hasn't been touched yet, so this is a purely
    // visual filter.
    if (pendingDelete) {
      list = list.filter((p) => p.id !== pendingDelete.id);
    }
    if (query.trim()) {
      const q = query.trim().toLocaleLowerCase('tr');
      list = list.filter((p) => p.name.toLocaleLowerCase('tr').includes(q));
    }
    if (difficulty !== 'all') {
      list = list.filter((p) => (p.difficulty || 'medium') === difficulty);
    }
    const ranked = [...list];
    if (sort === 'progress') {
      ranked.sort((a, b) => {
        const pa = cellCount(a) > 0 ? completedCount(a) / cellCount(a) : 0;
        const pb = cellCount(b) > 0 ? completedCount(b) / cellCount(b) : 0;
        return pb - pa;
      });
    } else if (sort === 'name') {
      ranked.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    } else {
      ranked.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return ranked;
  }, [projects, pendingDelete, query, difficulty, sort]);

  const closeMenu = () => setMenuFor(null);

  const handleRename = () => {
    const p = menuFor;
    closeMenu();
    setTimeout(() => setRenameFor(p), 200);
  };

  const handleReset = () => {
    const p = menuFor;
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        'İlerlemeyi sıfırla',
        `"${p.name}" için tüm işaretler temizlenecek. Pattern silinmiyor.`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Sıfırla',
            onPress: async () => {
              await updateProject(p.id, { completed: {} });
              onRefresh?.();
            },
          },
        ]
      );
    }, 220);
  };

  // Optimistic delete — no confirm dialog. The card animates out, the
  // project is hidden from the list, and a Snackbar offers "Geri Al"
  // for 5 seconds. After the window, the commit fires (deleteProject
  // + onRefresh). If the user kicks off another delete inside the
  // window, the previous one commits immediately so undo windows
  // don't stack.
  const handleDelete = () => {
    const p = menuFor;
    closeMenu();

    if (pendingDeleteRef.current) commitPending();

    setTimeout(() => {
      haptics.warn();
      // Spring-out the card first, then LayoutAnimation so neighbours
      // flow into the freed space rather than snapping.
      setDeletingId(p.id);
      setTimeout(() => {
        LayoutAnimation.configureNext({
          duration: 320,
          create: { type: 'easeInEaseOut', property: 'opacity' },
          update: { type: 'spring', springDamping: 0.7 },
          delete: { type: 'easeInEaseOut', property: 'opacity' },
        });
        setDeletingId(null);
        setPending({ id: p.id, name: p.name });
      }, 240);
    }, 220);
  };

  const submitRename = async (newName) => {
    const p = renameFor;
    setRenameFor(null);
    await updateProject(p.id, { name: newName });
    onRefresh?.();
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={S.surfacePrimary}/>

      <View style={styles.topBar}>
        <SpringIconBtn onPress={onBack}><ChevronLeftIcon/></SpringIconBtn>
        <View style={styles.titleWrap}>
          <Text style={styles.topTitle}>Atölyem</Text>
          <Text style={styles.topSub}>
            {projects.length === 0 ? 'Henüz proje yok' : `${projects.length} proje`}
          </Text>
        </View>
        <SpringIconBtn onPress={onNew} primary><PlusIcon color="#fff"/></SpringIconBtn>
      </View>

      {projects.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.emptyScroll, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Atölyen boş</Text>
            <Text style={styles.emptyDesc}>
              Yeni bir pattern üret ya da koleksiyondan hazır bir desen ekle —
              burası senin işleme alanın olur.
            </Text>
            <View style={styles.emptyCtaRow}>
              <TouchableOpacity
                style={styles.emptyCtaSlot}
                onPress={onNew}
                activeOpacity={0.85}
              >
                <View style={[styles.emptyCtaBtn, styles.emptyCtaPrimary]}>
                  <Text style={styles.emptyCtaPrimaryTxt}>Fotoğraftan Yeni</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyCtaSlot}
                onPress={onCollection}
                activeOpacity={0.85}
              >
                <Glass tone="light" radius={R.pill} intensity={40} style={styles.emptyCtaBtn}>
                  <Text style={styles.emptyCtaSecondaryTxt}>Koleksiyondan Seç</Text>
                </Glass>
              </TouchableOpacity>
            </View>
          </View>
          <EmptyDecoration/>
          <Glass tone="tint" radius={R.expressive} intensity={45} style={styles.emptyInfoCard}>
            <Text style={styles.emptyInfoTxt}>
              Atölyene eklediğin projeler bu sayfada gözükür. İlerlemeni adım adım kaydederiz.
            </Text>
          </Glass>
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          renderItem={({ item: p }) => (
            <View style={styles.cardOuter}>
              <ProjectCard
                project={p}
                onOpen={() => onOpen(p.id)}
                onMenu={() => setMenuFor(p)}
                deleting={deletingId === p.id}
              />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.cardGap}/>}
          ListHeaderComponent={
            <>
              <FilterBar
                query={query}
                onQueryChange={setQuery}
                sort={sort}
                onSortPress={() => setSortSheetOpen(true)}
              />
              <DifficultyFilter value={difficulty} onChange={setDifficulty}/>
            </>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={styles.noResultsTitle}>Sonuç bulunamadı</Text>
              <Text style={styles.noResultsSub}>Aramayı veya filtreyi değiştir.</Text>
              <TouchableOpacity onPress={resetFilters} activeOpacity={0.85} style={styles.noResultsBtn}>
                <Text style={styles.noResultsBtnTxt}>Filtreyi temizle</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={T.mauve}
              colors={[T.mauve]}
            />
          }
        />
      )}

      <ActionSheet
        visible={!!menuFor}
        project={menuFor}
        onClose={closeMenu}
        onRename={handleRename}
        onReset={handleReset}
        onDelete={handleDelete}
      />
      <SortSheet
        visible={sortSheetOpen}
        value={sort}
        onClose={() => setSortSheetOpen(false)}
        onPick={(id) => { setSort(id); setSortSheetOpen(false); }}
      />
      <RenameDialog
        visible={!!renameFor}
        currentName={renameFor?.name}
        onCancel={() => setRenameFor(null)}
        onConfirm={submitRename}
      />

      {/* Undo snackbar for the optimistic delete. visible drives both
          slide animation + the internal 5 s commit timer. */}
      <Snackbar
        visible={!!pendingDelete}
        message="Proje silindi"
        actionLabel="Geri Al"
        onAction={undoPending}
        onDismiss={commitPending}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.surfacePrimary },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10,
  },
  iconBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnPrimary: {
    backgroundColor: S.surfaceBrand,
    borderRadius: R.medium,
    shadowColor: T.mauveDeep, shadowOpacity: 0.25,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.3 },
  topSub:   { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary, marginTop: 2, letterSpacing: 0.3 },

  scroll: { paddingTop: 4 },
  cardOuter: { paddingHorizontal: 14 },
  cardGap: { height: 12 },

  card: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    padding: 14,
    shadowColor: T.ink, shadowOpacity: 0.04, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  thumbWrap: {
    width: 84, height: 84, borderRadius: R.medium, overflow: 'hidden',
    backgroundColor: S.surfaceSunken, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 6 },
  cardHead: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 28,
    // Reserve space for the floating menu button so long names ellipsise
    // before they slide under it.
    paddingRight: 36,
  },
  cardName: { flex: 1, fontSize: 15, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.1 },
  menuBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28, height: 28, borderRadius: R.small,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: S.surfaceSunken,
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diffPill: {
    paddingHorizontal: 9, paddingVertical: 3,
  },
  diffPillTxt: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.3 },
  cardMeta: { flex: 1, fontSize: 11, fontFamily: F.semibold, color: S.textTertiary },

  barTrack: {
    height: 4, borderRadius: 4,
    backgroundColor: T.lineSoft, overflow: 'hidden', marginTop: 4,
  },
  barFill:    { height: '100%', backgroundColor: T.mauve, borderRadius: 4 },
  barFillDone:{ backgroundColor: T.successTx },

  cardFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPct:  { fontSize: 11, fontFamily: F.bold, color: S.textBrand },
  cardDate: { fontSize: 11, fontFamily: F.semibold, color: S.textTertiary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyTitle: { fontSize: 22, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.3 },
  emptyDesc:  { fontSize: 14, fontFamily: F.regular, color: S.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  // Two-CTA row: primary + secondary, equal width. alignSelf stretch
  // makes the row span the .empty container's content area (its 40 px
  // horizontal padding gives the buttons room to breathe).
  emptyCtaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    alignSelf: 'stretch',
  },
  emptyCtaSlot: { flex: 1 },
  // minHeight is the Glass.js flex-collapse safety; without it the
  // secondary button squashes when Glass's content view fails to
  // measure intrinsic height in this unconstrained context.
  emptyCtaBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  emptyCtaPrimary: {
    backgroundColor: S.surfaceBrand,
    borderRadius: R.pill,
    shadowColor: T.mauveDeep, shadowOpacity: 0.22,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  emptyCtaPrimaryTxt: {
    fontFamily: F.bold, color: S.textOnBrand, fontSize: 14, letterSpacing: 0.2,
  },
  emptyCtaSecondaryTxt: {
    fontFamily: F.bold, color: S.textBrand, fontSize: 14, letterSpacing: 0.2,
  },

  // Below the mock-row, a soft tint card that explains what the
  // workshop is for. Reassures the user that the empty state isn't an
  // error — it's just "you haven't added anything yet".
  emptyInfoCard: {
    marginTop: 24,
    padding: 16,
  },
  emptyInfoTxt: {
    fontSize: 12,
    fontFamily: F.regular,
    color: S.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },

  // sibling-scrim sheet layout: wrap is a column flex, scrim takes the
  // space above, the Glass sheet anchors at the bottom.
  sheetBackdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: S.glassOverlay,
  },
  sheet: {
    paddingTop: 8, paddingHorizontal: 14,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    // Glass.js's content view has `flex: 1`, which collapses in an
    // unconstrained parent (see DifficultyScreen option for the same
    // workaround). minHeight propagates through Glass.js's outer
    // destructure and lets grabber/title/divider/rows/cancel render
    // at their intrinsic heights instead of squeezing to ~0.
    minHeight: 340,
  },
  sheetGrabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: T.line, alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 14, fontFamily: F.bold, color: S.textPrimary,
    paddingHorizontal: 6, marginBottom: 12,
  },
  sheetDivider: { height: 1, backgroundColor: T.lineSoft, marginBottom: 6 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 6,
  },
  sheetIcon: {
    width: 38, height: 38, borderRadius: R.medium,
    backgroundColor: S.surfaceSunken,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetIconDanger: { backgroundColor: T.errorBg },
  sheetRowLabel: { fontSize: 15, fontFamily: F.semibold, color: S.textPrimary },
  sheetRowLabelDanger: { color: S.textDanger },
  sheetRowSub:   { fontSize: 11, fontFamily: F.regular, color: S.textTertiary, marginTop: 2, lineHeight: 16 },
  sheetCancel: {
    marginTop: 8, paddingVertical: 14, alignItems: 'center',
    backgroundColor: S.surfaceSunken, borderRadius: R.medium,
  },
  sheetCancelTxt: { fontSize: 14, fontFamily: F.bold, color: S.textSecondary },

  dialogBackdropWrap: {
    flex: 1,
    backgroundColor: S.glassOverlay,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    padding: 20,
    shadowColor: T.ink, shadowOpacity: 0.15, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 8,
    // Same Glass flex:1 collapse workaround as `sheet` above —
    // without minHeight, the dialog squeezes to a thin strip because
    // Glass.js's content view has flex:1 in an unconstrained parent.
    minHeight: 220,
  },
  dialogTitle: { fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2 },
  dialogSub:   { fontSize: 12, fontFamily: F.regular, color: S.textSecondary, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  dialogInput: {
    fontSize: 16, fontFamily: F.regular, color: S.textPrimary,
    backgroundColor: S.surfaceSunken,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: R.medium, borderWidth: 1, borderColor: T.line,
  },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  dialogBtn: {
    flex: 1, paddingVertical: 12, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  dialogBtnGhost: {
    backgroundColor: S.surfaceSunken, borderWidth: 1, borderColor: T.line,
  },
  dialogBtnGhostTxt: { fontSize: 14, fontFamily: F.semibold, color: S.textSecondary },
  dialogBtnPrimary: { backgroundColor: S.surfaceBrand },
  dialogBtnPrimaryTxt: { fontSize: 14, fontFamily: F.bold, color: S.textOnBrand },

  // ── Filter bar ────────────────────────────────────────────────
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 8,
  },
  searchGlass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 0,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: F.regular,
    color: S.textPrimary,
    padding: 0,
  },
  clearBtn: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: S.surfaceSunken,
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtnTxt: {
    fontSize: 14, fontFamily: F.bold, color: S.textSecondary,
    lineHeight: 16, marginTop: -2,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
  },
  sortChipTxt: {
    fontSize: 13, fontFamily: F.bold,
    color: S.textPrimary, letterSpacing: 0.1,
  },

  // ── Difficulty chips ──────────────────────────────────────────
  diffRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  diffChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  diffChipActive: {
    backgroundColor: S.surfaceBrand,
    borderRadius: R.pill,
    shadowColor: T.mauveDeep,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  diffChipTxt: {
    fontSize: 12, fontFamily: F.semibold,
    color: S.textSecondary, letterSpacing: 0.2,
  },
  diffChipTxtActive: {
    color: S.textOnBrand, fontFamily: F.bold,
  },

  // ── Sort sheet bullet ────────────────────────────────────────
  sortBullet: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: T.line,
    backgroundColor: S.surfaceSunken,
    alignItems: 'center', justifyContent: 'center',
  },
  sortBulletActive: {
    borderColor: T.mauve,
    backgroundColor: 'rgba(212,165,165,0.12)',
  },
  sortBulletDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: T.mauve,
  },

  // ── No-results state ─────────────────────────────────────────
  noResults: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  noResultsTitle: {
    fontSize: 17, fontFamily: F.bold, color: S.textPrimary, letterSpacing: -0.2,
  },
  noResultsSub: {
    fontSize: 13, fontFamily: F.regular, color: S.textSecondary,
    textAlign: 'center', marginTop: 6, lineHeight: 20,
  },
  noResultsBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: S.surfaceElevated,
  },
  noResultsBtnTxt: {
    fontSize: 13, fontFamily: F.bold, color: S.textBrand, letterSpacing: 0.2,
  },

  // ── Empty state — decorative mock pattern row ────────────────
  emptyScroll: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  emptyMockRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 36,
    paddingHorizontal: 8,
  },
  emptyMockCard: {
    width: 108,
    padding: 12,
    gap: 8,
    opacity: 0.7,
    shadowColor: T.ink,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  emptyMockSwatchRow: {
    flexDirection: 'row',
    gap: 4,
  },
  emptyMockSwatch: {
    width: 14, height: 14, borderRadius: 3,
    borderWidth: 1, borderColor: T.lineSoft,
  },
  emptyMockName: {
    fontSize: 11, fontFamily: F.bold,
    color: S.textPrimary, letterSpacing: -0.1,
  },
  emptyMockMeta: {
    fontSize: 10, fontFamily: F.semibold,
    color: S.textTertiary, letterSpacing: 0.2,
  },
});
