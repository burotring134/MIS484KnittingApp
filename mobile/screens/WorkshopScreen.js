import { useState, useMemo, memo } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, Modal, TextInput, Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../utils/theme';
import { deleteProject, updateProject } from '../utils/storage';

const DIFF_TINTS = {
  easy:   { label: 'Kolay', bg: T.mint,     fg: T.successTx },
  medium: { label: 'Orta',  bg: T.lavender, fg: T.mauveDeep },
  hard:   { label: 'Zor',   bg: T.rose,     fg: T.mauveDeep },
};

const cellCount      = (p) => p.width * p.height;
const completedCount = (p) => (p.completed ? Object.keys(p.completed).length : 0);

// ─────────────────────────────────────────────────────────────────────────────
// Mini — workshop list thumbnail. Uses the pre-rendered chart PNG when
// the project has one (everything saved post-PNG-pipeline does); falls
// back to a path-batched SVG (one Path per colour) for legacy projects
// so the workshop list never blocks on W*H individual rects.
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
// Project list item
// ─────────────────────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onMenu }) {
  const done  = completedCount(project);
  const total = cellCount(project);
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const diff  = DIFF_TINTS[project.difficulty] || DIFF_TINTS.medium;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onOpen}
    >
      <View style={styles.thumbWrap}>
        <Mini pattern={project}/>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.cardName} numberOfLines={1}>{project.name}</Text>
          <TouchableOpacity
            onPress={onMenu}
            hitSlop={10}
            activeOpacity={0.6}
            style={styles.menuBtn}
          >
            <DotsIcon/>
          </TouchableOpacity>
        </View>

        <View style={styles.cardMetaRow}>
          <View style={[styles.diffPill, { backgroundColor: diff.bg }]}>
            <Text style={[styles.diffPillTxt, { color: diff.fg }]}>{diff.label}</Text>
          </View>
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
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionSheet — bottom modal with project actions
// ─────────────────────────────────────────────────────────────────────────────
function ActionSheet({ visible, project, onClose, onRename, onReset, onDelete }) {
  const insets = useSafeAreaInsets();

  if (!project) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        {/* Inner Pressable absorbs taps — without it any tap inside the sheet
            would also dismiss it via the backdrop's onPress. */}
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}
        >
          <View style={styles.sheetGrabber}/>
          <Text style={styles.sheetTitle} numberOfLines={1}>{project.name}</Text>

          <View style={styles.sheetDivider}/>

          <SheetAction
            icon={<PencilIcon color={T.ink}/>}
            label="Yeniden adlandır"
            onPress={onRename}
          />
          <SheetAction
            icon={<RefreshIcon color={T.ink}/>}
            label="İlerlemeyi sıfırla"
            sub="İşaretli hücreler temizlenir, pattern kalır"
            onPress={onReset}
          />
          <SheetAction
            icon={<TrashIcon color={T.errorTx}/>}
            label="Sil"
            sub="Bu işlem geri alınamaz"
            danger
            onPress={onDelete}
          />

          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.sheetCancel}>
            <Text style={styles.sheetCancelTxt}>İptal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
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
// RenameDialog — center modal with TextInput
// ─────────────────────────────────────────────────────────────────────────────
function RenameDialog({ visible, currentName, onCancel, onConfirm }) {
  const [value, setValue] = useState(currentName || '');

  // Reset value whenever the dialog opens with a new project.
  useMemo(() => { if (visible) setValue(currentName || ''); }, [visible, currentName]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
        <Pressable onPress={() => {}} style={styles.dialog}>
          <Text style={styles.dialogTitle}>Yeniden adlandır</Text>
          <Text style={styles.dialogSub}>Pattern için yeni bir isim gir.</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            style={styles.dialogInput}
            placeholder="Pattern adı"
            placeholderTextColor={T.inkMute}
            autoFocus
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline icons
// ─────────────────────────────────────────────────────────────────────────────
function ChevronLeftIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
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

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function WorkshopScreen({ projects, onBack, onOpen, onRefresh, onNew }) {
  const insets = useSafeAreaInsets();
  const [menuFor, setMenuFor]     = useState(null); // project being acted on
  const [renameFor, setRenameFor] = useState(null); // project being renamed

  const openMenu  = (p)     => setMenuFor(p);
  const closeMenu = ()      => setMenuFor(null);

  const handleRename = () => {
    const p = menuFor;
    closeMenu();
    setTimeout(() => setRenameFor(p), 200); // wait for sheet close anim
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

  const handleDelete = () => {
    const p = menuFor;
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        'Projeyi sil',
        `"${p.name}" kalıcı olarak silinecek.`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              await deleteProject(p.id);
              onRefresh?.();
            },
          },
        ]
      );
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
      <StatusBar barStyle="dark-content" backgroundColor={T.cream}/>

      {/* ─── Top bar ────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
          <ChevronLeftIcon/>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.topTitle}>Atölyem</Text>
          <Text style={styles.topSub}>
            {projects.length === 0 ? 'Henüz proje yok' : `${projects.length} proje`}
          </Text>
        </View>
        <TouchableOpacity style={[styles.iconBtn, styles.iconBtnPrimary]} onPress={onNew} activeOpacity={0.85}>
          <PlusIcon color="#fff"/>
        </TouchableOpacity>
      </View>

      {/* ─── List ──────────────────────────────────────────────────── */}
      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Atölyen boş</Text>
          <Text style={styles.emptyDesc}>
            Yeni bir pattern üret ya da koleksiyondan hazır bir desen ekle —
            burası senin işleme alanın olur.
          </Text>
          <TouchableOpacity style={styles.emptyCta} onPress={onNew} activeOpacity={0.85}>
            <Text style={styles.emptyCtaTxt}>+ Yeni Pattern</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
          showsVerticalScrollIndicator={false}
        >
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpen(p.id)}
              onMenu={() => openMenu(p)}
            />
          ))}
        </ScrollView>
      )}

      {/* ─── Action sheet & rename dialog ──────────────────────────── */}
      <ActionSheet
        visible={!!menuFor}
        project={menuFor}
        onClose={closeMenu}
        onRename={handleRename}
        onReset={handleReset}
        onDelete={handleDelete}
      />
      <RenameDialog
        visible={!!renameFor}
        currentName={renameFor?.name}
        onCancel={() => setRenameFor(null)}
        onConfirm={submitRename}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.cream },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.paper,
    borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnPrimary: {
    backgroundColor: T.mauve, borderColor: T.mauve,
    shadowColor: T.mauveDeep, shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  titleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 17, fontWeight: '900', color: T.ink, letterSpacing: -0.4 },
  topSub:   { fontSize: 11, fontWeight: '600', color: T.inkMute, marginTop: 2, letterSpacing: 0.4 },

  // List
  scroll: { paddingHorizontal: 14, paddingTop: 4, gap: 12 },

  card: {
    flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: T.paper, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: T.line,
    shadowColor: T.ink, shadowOpacity: 0.04, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  thumbWrap: {
    width: 84, height: 84, borderRadius: 14, overflow: 'hidden',
    backgroundColor: T.creamDeep, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 6 },
  cardHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  cardName: { flex: 1, fontSize: 15, fontWeight: '800', color: T.ink, letterSpacing: -0.2 },
  menuBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.creamDeep,
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diffPill: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9999,
  },
  diffPillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  cardMeta: { flex: 1, fontSize: 11, color: T.inkMute, fontWeight: '600' },

  barTrack: {
    height: 5, borderRadius: 5,
    backgroundColor: T.lineSoft, overflow: 'hidden', marginTop: 4,
  },
  barFill:    { height: '100%', backgroundColor: T.mauve, borderRadius: 5 },
  barFillDone:{ backgroundColor: T.successTx },

  cardFootRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPct:  { fontSize: 11, fontWeight: '900', color: T.mauveDeep },
  cardDate: { fontSize: 11, color: T.inkMute, fontWeight: '600' },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyTitle: { fontSize: 22, fontWeight: '900', color: T.ink, letterSpacing: -0.4 },
  emptyDesc:  { fontSize: 14, color: T.inkSoft, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  emptyCta: {
    marginTop: 22, backgroundColor: T.mauve,
    paddingHorizontal: 26, paddingVertical: 14, borderRadius: 9999,
    shadowColor: T.mauveDeep, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  emptyCtaTxt: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },

  // Action sheet
  sheetBackdrop: {
    flex: 1, backgroundColor: 'rgba(35,30,28,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.paper,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingHorizontal: 14,
  },
  sheetGrabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: T.line, alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 14, fontWeight: '800', color: T.ink,
    paddingHorizontal: 6, marginBottom: 12,
  },
  sheetDivider: { height: 1, backgroundColor: T.lineSoft, marginBottom: 6 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 6,
  },
  sheetIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: T.creamDeep,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetIconDanger: { backgroundColor: T.errorBg },
  sheetRowLabel: { fontSize: 15, fontWeight: '700', color: T.ink },
  sheetRowLabelDanger: { color: T.errorTx },
  sheetRowSub:   { fontSize: 11, color: T.inkMute, fontWeight: '600', marginTop: 2 },
  sheetCancel: {
    marginTop: 8, paddingVertical: 14, alignItems: 'center',
    backgroundColor: T.creamDeep, borderRadius: 14,
  },
  sheetCancelTxt: { fontSize: 14, fontWeight: '800', color: T.inkSoft },

  // Rename dialog
  dialogBackdrop: {
    flex: 1, backgroundColor: 'rgba(35,30,28,0.45)',
    justifyContent: 'center', paddingHorizontal: 28,
  },
  dialog: {
    backgroundColor: T.paper, borderRadius: 22, padding: 20,
    shadowColor: T.ink, shadowOpacity: 0.18, shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 }, elevation: 8,
  },
  dialogTitle: { fontSize: 17, fontWeight: '900', color: T.ink, letterSpacing: -0.3 },
  dialogSub:   { fontSize: 12, color: T.inkSoft, marginTop: 4, marginBottom: 16 },
  dialogInput: {
    fontSize: 16, color: T.ink, fontWeight: '600',
    backgroundColor: T.creamDeep,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: T.line,
  },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  dialogBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 9999,
    alignItems: 'center', justifyContent: 'center',
  },
  dialogBtnGhost: {
    backgroundColor: T.creamDeep, borderWidth: 1, borderColor: T.line,
  },
  dialogBtnGhostTxt: { fontSize: 14, fontWeight: '700', color: T.inkSoft },
  dialogBtnPrimary: { backgroundColor: T.mauve },
  dialogBtnPrimaryTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
