#!/usr/bin/env python3
"""
Threadia template builder. Generates 9 cross-stitch patterns
programmatically with strict left-right symmetry where required,
validates rectangular dimensions, and emits ASCII art that drops
directly into templates.js parse() blocks.

Run:
    python3 build.py            # prints all patterns to stdout
    python3 build.py --check    # only validate (no print)
"""

import sys


def grid(w, h, bg='.'):
    return [[bg] * w for _ in range(h)]


def px(g, x, y, ch):
    h = len(g); w = len(g[0])
    if 0 <= x < w and 0 <= y < h:
        g[y][x] = ch


def hline(g, y, x1, x2, ch):
    if x1 > x2: x1, x2 = x2, x1
    for x in range(x1, x2 + 1):
        px(g, x, y, ch)


def vline(g, x, y1, y2, ch):
    if y1 > y2: y1, y2 = y2, y1
    for y in range(y1, y2 + 1):
        px(g, x, y, ch)


def rect(g, x1, y1, x2, y2, ch):
    for y in range(y1, y2 + 1):
        hline(g, y, x1, x2, ch)


def filled_circle(g, cx, cy, r, ch):
    rr = r * r
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= rr:
                px(g, x, y, ch)


def filled_ellipse(g, cx, cy, rx, ry, ch):
    rx2 = rx * rx
    ry2 = ry * ry
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ry2 * (x - cx) ** 2 + rx2 * (y - cy) ** 2 <= rx2 * ry2:
                px(g, x, y, ch)


def mirror_lr(g):
    """Mirror the right half from the left so symmetry is exact."""
    h = len(g); w = len(g[0])
    for y in range(h):
        for x in range(w // 2):
            g[y][w - 1 - x] = g[y][x]


def to_str(g):
    return '\n'.join(''.join(row) for row in g)


def validate(name, s, *, symmetric=False):
    lines = s.split('\n')
    w = len(lines[0])
    for i, line in enumerate(lines):
        if len(line) != w:
            raise ValueError(f"{name}: line {i} length {len(line)} != {w}: {line!r}")
    h = len(lines)
    if symmetric:
        for y, line in enumerate(lines):
            for x in range(w // 2):
                if line[x] != line[w - 1 - x]:
                    raise ValueError(f"{name}: asymmetry at y={y} x={x} / {w-1-x}")
    return w, h


# ────────────────────────────────────────────────────────────────────────────
# 1. KALP — 32×32, 3 renk (.= linen, D = ana kırmızı, L = light highlight)
# ────────────────────────────────────────────────────────────────────────────
def build_kalp():
    W, H = 32, 32
    g = grid(W, H, '.')
    cx = W // 2  # 16
    # Implicit heart curve mapped to the grid. Parameters tuned so the
    # silhouette occupies rows 4..28 with the dip at row ~7 and the tip
    # at row ~27 — symmetric by construction.
    for y in range(H):
        for x in range(W):
            nx = (x - cx + 0.5) / 11.0
            ny = -((y - 5) - 11.0) / 11.0
            f = (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3
            if f <= 0:
                g[y][x] = 'D'
    # Inner light-red core — slightly smaller, shifted up so the bottom
    # tip stays dark and the upper lobes carry the highlight.
    for y in range(H):
        for x in range(W):
            nx = (x - cx + 0.5) / 9.5
            ny = -((y - 5) - 10.5) / 9.5
            f = (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3
            if f <= 0 and g[y][x] == 'D':
                g[y][x] = 'L'
    # No one-sided specular — user wants strict L/R symmetry. The inner
    # 'L' layer is the highlight; the outer 'D' rim carries the shadow.
    return g, "Kalp", "kalp", "easy", [
        ('.', 'White',           'blanc', '#F8F8F8'),
        ('D', 'Christmas Red',   '321',   '#B50014'),
        ('L', 'Bright Red',      '666',   '#E0001E'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 2. YILDIZ — 32×32, 3 renk (sarı + altın kenar + parlama noktaları)
# ────────────────────────────────────────────────────────────────────────────
def build_yildiz():
    W, H = 32, 32
    g = grid(W, H, '.')
    import math

    def star_pts(cx, cy, r_outer, r_inner, rotation=-math.pi / 2):
        pts = []
        for i in range(10):
            ang = rotation + i * math.pi / 5
            r = r_outer if i % 2 == 0 else r_inner
            pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
        return pts

    def inside_polygon(x, y, pts):
        inside = False
        n = len(pts)
        j = n - 1
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if ((yi > y) != (yj > y)) and \
               (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
                inside = not inside
            j = i
        return inside

    # 4×4 super-sampling — each grid cell is averaged over 16 sub-pixels.
    # Without it the star's points end up frayed (single-pixel bumps on
    # one side of an arm but not the other). With it the silhouette is
    # smooth and the arms are visibly sharp.
    def filled(x, y, pts, threshold=10):
        N = 4
        hits = 0
        for sy in range(N):
            for sx in range(N):
                if inside_polygon(x + (sx + 0.5) / N, y + (sy + 0.5) / N, pts):
                    hits += 1
        return hits >= threshold

    # Centre on a pixel boundary so the polygon is L/R-symmetric by
    # construction (mirror_lr at the end still cleans up any drift).
    cx, cy = W / 2, H / 2 - 1
    outer_pts = star_pts(cx, cy, 14.0, 5.6)
    inner_pts = star_pts(cx, cy, 11.5, 4.2)

    for y in range(H):
        for x in range(W):
            if filled(x, y, outer_pts):
                g[y][x] = 'O'  # gold outer rim
    for y in range(H):
        for x in range(W):
            if g[y][x] == 'O' and filled(x, y, inner_pts):
                g[y][x] = 'Y'  # bright yellow core

    # Sparkles around the star — left-half only, mirror_lr finishes them.
    for sx, sy in [(3, 4), (2, 16), (5, 28), (8, 2)]:
        if g[sy][sx] == '.':
            px(g, sx, sy, 'Y')

    mirror_lr(g)

    return g, "Yıldız", "yildiz", "easy", [
        ('.', 'Off White',         'blanc', '#F8F8F8'),
        ('O', 'Burnt Orange',      '947',   '#FF5C14'),
        ('Y', 'Yellow Medium',     '743',   '#FFCC14'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 3. EV — 32×32, 6 renk (sky, roof, wall, window, brown, green)
# Asymmetric on purpose: chimney on the roof right, tree on the left.
# ────────────────────────────────────────────────────────────────────────────
def build_ev():
    W, H = 32, 32
    g = grid(W, H, '.')

    # ── Çim — alt 6 satır ─────────────────────────────────────────────
    rect(g, 0, 26, W - 1, 31, 'G')

    # ── Ağaç — önce çizilir, evi kapatmasın diye duvar üstüne çizilir ─
    rect(g, 4, 22, 5, 26, 'D')                    # gövde
    filled_circle(g, 4, 19, 3, 'G')               # ana taç
    filled_circle(g, 6, 17, 3, 'G')               # üst kıvrım
    filled_circle(g, 2, 17, 2, 'G')               # sol yumru
    filled_circle(g, 7, 20, 2, 'G')               # sağ alt yumru

    # ── Baca (sağ üstte, çatı tepesine yakın) ─────────────────────────
    rect(g, 22, 4, 23, 10, 'D')
    px(g, 21, 4, 'D'); px(g, 24, 4, 'D')          # üst flange

    # ── Çatı — düz kenarlı üçgen, base 16 wide ────────────────────────
    cx = 16
    for y in range(7, 15):
        span = y - 7
        hline(g, y, cx - span, cx + span + 1, 'R')

    # ── Duvar — y 15..25 ──────────────────────────────────────────────
    rect(g, cx - 7, 15, cx + 7, 25, 'W')
    # Wall outline (koyu kenar)
    hline(g, 15, cx - 7, cx + 7, 'D')
    hline(g, 25, cx - 7, cx + 7, 'D')
    vline(g, cx - 7, 15, 25, 'D')
    vline(g, cx + 7, 15, 25, 'D')

    # ── Pencereler — 2 adet, 3×3 cross divider'lı ─────────────────────
    rect(g, cx - 5, 17, cx - 3, 19, 'B')
    px(g, cx - 4, 17, 'D'); px(g, cx - 4, 19, 'D')
    px(g, cx - 5, 18, 'D'); px(g, cx - 3, 18, 'D')
    rect(g, cx + 3, 17, cx + 5, 19, 'B')
    px(g, cx + 4, 17, 'D'); px(g, cx + 4, 19, 'D')
    px(g, cx + 3, 18, 'D'); px(g, cx + 5, 18, 'D')

    # ── Kapı — orta alt ───────────────────────────────────────────────
    rect(g, cx - 1, 21, cx + 1, 25, 'D')

    return g, "Küçük Ev", "ev", "easy", [
        ('.', 'Sky Blue',           '3325', '#A8CDE8'),
        ('R', 'Christmas Red',      '321',  '#B50014'),
        ('W', 'Tan Very Light',     '738',  '#F0D2A0'),
        ('B', 'Sky Blue',           '519',  '#78B4D2'),
        ('D', 'Brown Light',        '434',  '#B46428'),
        ('G', 'Parrot Green Medium','906',  '#7DB400'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 4. ÇİÇEK — 36×36, 6 renk (gül; katmanlı pembe, merkez sarı, uzun sap+yapraklar)
# Centre on column 18 (odd-width semantics: mirror_lr at the end pins
# symmetry around the boundary between cols 17 and 18).
# ────────────────────────────────────────────────────────────────────────────
def build_cicek():
    W, H = 36, 36
    g = grid(W, H, '.')
    cx, cy = 18, 13   # flower head centre

    # ── Sap (stem) — first, so leaves can paint over it cleanly ───────
    rect(g, cx - 1, 20, cx, 33, 'S')

    # ── Yapraklar — sap'a takılı, sap üstüne gelir ────────────────────
    # Sol yaprak (cx-5 etrafında, oval, sap'a doğru ucu sivri)
    filled_ellipse(g, cx - 5, 25, 4, 2, 'L')
    # Yaprak damar (light line through middle) — same green tone
    # is fine; the petal silhouette already carries the read

    # ── Petal halkası (dark pink, 5 lob) ──────────────────────────────
    # Top lobe
    filled_ellipse(g, cx, cy - 6, 4, 4, 'P')
    # Upper-left lobe
    filled_ellipse(g, cx - 7, cy - 2, 4, 4, 'P')
    # Lower-left lobe
    filled_ellipse(g, cx - 5, cy + 5, 4, 4, 'P')

    # ── Inner petals (light pink) — pulled inward by ~2 px ────────────
    filled_ellipse(g, cx, cy - 5, 2, 2, 'p')
    filled_ellipse(g, cx - 6, cy - 2, 2, 2, 'p')
    filled_ellipse(g, cx - 4, cy + 4, 2, 2, 'p')

    # ── Inner inner — light pink centred around the yellow eye ────────
    filled_ellipse(g, cx - 1, cy, 3, 3, 'p')

    # ── Yellow centre — small bright eye ──────────────────────────────
    filled_ellipse(g, cx - 1, cy, 2, 1, 'Y')
    px(g, cx, cy - 1, 'Y')

    # Mirror — every shape above was drawn on or to the left of cx,
    # so this paints the symmetric right half exactly.
    mirror_lr(g)

    return g, "Çiçek", "cicek", "medium", [
        ('.', 'White',              'blanc', '#F8F8F8'),
        ('P', 'Mauve',              '3687',  '#C06478'),
        ('p', 'Mauve Medium Light', '3688',  '#D28CA0'),
        ('Y', 'Yellow Medium',      '743',   '#FFCC14'),
        ('S', 'Forest Green Dark',  '987',   '#4F7942'),
        ('L', 'Parrot Green Medium','906',   '#7DB400'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 5. KARPUZ — 36×36, 5 renk (yeşil kabuk, beyaz iç kabuk, kırmızı et, çekirdek)
# ────────────────────────────────────────────────────────────────────────────
def build_karpuz():
    W, H = 36, 36
    g = grid(W, H, '.')
    cx = W // 2  # 18
    # Yarım dilim: alt kısmı düz (kesim), üstü kavisli. Center: cx, cy=28.
    cy = 28
    # Outer: dark green rind ellipse, üst yarı
    # Use ellipse: rx=16, ry=18, but only y <= cy
    rx, ry = 16, 18
    for y in range(H):
        for x in range(W):
            if y > cy: continue
            if rx * rx * (y - cy) ** 2 + ry * ry * (x - cx) ** 2 <= rx * rx * ry * ry:
                g[y][x] = 'G'  # dark green outer rind

    # Light green inner rind (1 layer inside)
    rx2, ry2 = 14, 16
    for y in range(H):
        for x in range(W):
            if y > cy: continue
            if rx2 * rx2 * (y - cy) ** 2 + ry2 * ry2 * (x - cx) ** 2 <= rx2 * rx2 * ry2 * ry2:
                g[y][x] = 'g'  # light green
    # White inner rind
    rx3, ry3 = 13, 15
    for y in range(H):
        for x in range(W):
            if y > cy: continue
            if rx3 * rx3 * (y - cy) ** 2 + ry3 * ry3 * (x - cx) ** 2 <= rx3 * rx3 * ry3 * ry3:
                g[y][x] = 'W'  # white rind

    # Red flesh
    rx4, ry4 = 11, 13
    for y in range(H):
        for x in range(W):
            if y > cy: continue
            if rx4 * rx4 * (y - cy) ** 2 + ry4 * ry4 * (x - cx) ** 2 <= rx4 * rx4 * ry4 * ry4:
                g[y][x] = 'R'  # red flesh

    # Seeds — düzenli aralıklı simetrik
    seed_positions = [
        (cx - 7, 20), (cx - 4, 18), (cx, 16), (cx + 4, 18), (cx + 7, 20),
        (cx - 6, 23), (cx - 2, 22), (cx + 2, 22), (cx + 6, 23),
        (cx - 5, 26), (cx, 25), (cx + 5, 26),
    ]
    for (sx, sy) in seed_positions:
        if g[sy][sx] == 'R':
            g[sy][sx] = 'K'

    # Alt kesim çizgisi — düz, koyu yeşil hairline
    hline(g, cy, cx - rx, cx + rx, 'G')

    # Mirror ensures the ellipse + seeds are pixel-perfect symmetric.
    mirror_lr(g)

    return g, "Karpuz", "karpuz", "medium", [
        ('.', 'White',              'blanc', '#F8F8F8'),
        ('G', 'Forest Green Dark',  '987',   '#4F7942'),
        ('g', 'Parrot Green Light', '907',   '#96D200'),
        ('W', 'Snow White',         'B5200', '#FFFFFF'),
        ('R', 'Bright Red',         '666',   '#E0001E'),
        ('K', 'Black',              '310',   '#1A1A1A'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 6. ÇAY FİNCANI — 36×36, 6 renk (fincan + tabak + buhar + çiçek motif)
# ────────────────────────────────────────────────────────────────────────────
def build_cay():
    W, H = 36, 36
    g = grid(W, H, '.')
    cx = W // 2  # 18

    # Buhar — 3 simetrik wavy line, üst kısımda. Her dalga sinüs tabanlı,
    # 2 piksel genlikli; periyot 8 satır → fincanın 10 satırlık üst
    # boşluğunda tam bir S-eğrisi tamamlanır.
    import math
    def steam(g, base_x, top, height, ch):
        for i in range(height):
            x = base_x + int(round(math.sin(i * math.pi / 4) * 1.5))
            px(g, x, top + i, ch)
            px(g, x + 1, top + i, ch)
    steam(g, 11, 2, 9, 'V')
    steam(g, 17, 1, 10, 'V')
    steam(g, 23, 2, 9, 'V')

    # Fincan kenarı (üst halka) — kalın koyu mavi
    # Cup body genişlik: x 8..27 (20 wide), top y=12, bottom y=24
    # Rim — üst 1 satır koyu mavi
    hline(g, 12, 8, 27, 'D')
    # Iç gövde
    rect(g, 9, 13, 26, 24, 'U')  # cup cream/white
    # Yan kenarlar koyu mavi
    vline(g, 8, 13, 24, 'D')
    vline(g, 27, 13, 24, 'D')
    # Alt yuvarlanması — alt kısmı simulate edilmiş
    hline(g, 25, 9, 26, 'D')
    # Kulp — sağ tarafta D-shape
    px(g, 28, 14, 'D'); px(g, 29, 14, 'D')
    px(g, 30, 14, 'D'); px(g, 30, 15, 'D')
    px(g, 31, 15, 'D'); px(g, 31, 16, 'D')
    px(g, 31, 17, 'D'); px(g, 31, 18, 'D')
    px(g, 31, 19, 'D'); px(g, 30, 19, 'D')
    px(g, 30, 20, 'D'); px(g, 28, 20, 'D'); px(g, 29, 20, 'D')

    # Çiçek motifi — fincanın ortasında küçük gül silüeti (tek-tonlu
    # mauve; 6-renk bütçesine sığması için sarı merkez detayını
    # kaldırdık — sade görsel bu ölçekte daha temiz okunuyor).
    for dy, line in enumerate([
        " FFF ",
        "FF FF",
        " FFF ",
    ]):
        for dx, ch in enumerate(line):
            if ch != ' ':
                px(g, cx - 2 + dx, 17 + dy, ch)
    # Yapraklar (yeşil) yanlardan
    px(g, cx - 4, 18, 'L'); px(g, cx - 3, 18, 'L')
    px(g, cx + 3, 18, 'L'); px(g, cx + 4, 18, 'L')

    # Tabak — fincanın altında, geniş elips. Cup ve tabak aynı beyaz
    # tonu paylaşır ('U'), yalnızca koyu mavi rim ('D') ile ayrılır.
    filled_ellipse(g, cx, 27, 14, 2, 'U')
    for x in range(W):
        if g[28][x] == 'U':
            g[28][x] = 'D'

    # Cup is intentionally L/R-asymmetric — the handle lives on the
    # right side only, the way real teacups are drawn. Validation runs
    # without the symmetric flag (see PATTERNS).

    return g, "Çay Fincanı", "cay", "medium", [
        ('.', 'Off White',          '3865',  '#F4F0E8'),
        ('V', 'Pearl Gray',         '415',   '#C8C8C8'),
        ('D', 'Blue Medium',        '826',   '#4878A0'),
        ('U', 'Snow White',         'B5200', '#FFFFFF'),
        ('F', 'Mauve',              '3687',  '#C06478'),
        ('L', 'Parrot Green Medium','906',   '#7DB400'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 7. KEDİ YÜZÜ — 40×40, 8 renk (turuncu kürk, çizgili tabby, badem gözler)
# ────────────────────────────────────────────────────────────────────────────
def build_kedi():
    W, H = 40, 40
    g = grid(W, H, '.')
    cx = W // 2  # 20

    # Kulaklar — gerçek kedi kulağı silüeti: sivri tepe (y=2), geniş
    # taban (y=11). Çizdiğimiz yalnızca sol kulak; sağ kulağı tamamen
    # mirror_lr halleder. Outer slope dik (her satır 1 px), inner slope
    # daha yavaş (her satır 1 px ama yalnızca 8 satır boyunca) — bu da
    # kulağın eğri-uçlu doğal şeklini verir.
    apex_x = cx - 9
    for y in range(2, 12):
        half_left  = min(y - 2, 8)             # outer (dış) yarıçap
        half_right = min(y - 2, 4)             # inner (iç) yarıçap, daha dar
        for x in range(apex_x - half_left, apex_x + half_right + 1):
            px(g, x, y, 'O')

    # Sol kulak iç pembe — kulağın iç kısmı (smaller triangle inside)
    for y in range(5, 11):
        half_left  = min(y - 5, 5)
        half_right = min(y - 5, 2)
        for x in range(apex_x - half_left, apex_x + half_right + 1):
            px(g, x, y, 'P')

    # Yüz — ana oval
    # Center yaklaşık (cx, 22), rx=14, ry=13
    for y in range(H):
        for x in range(W):
            if 14 * 14 * (y - 22) ** 2 + 13 * 13 * (x - cx) ** 2 <= 14 * 14 * 13 * 13:
                # only the lower face area (not in ears)
                if y >= 10:
                    g[y][x] = 'O'

    # Açık göğüs/çene (light fur)
    for y in range(28, 36):
        span = (35 - y) + 6 - (y - 28) // 2  # taper
        x1 = cx - 8 + (y - 28) // 2
        x2 = cx + 8 - (y - 28) // 2
        for x in range(x1, x2 + 1):
            if g[y][x] == 'O':
                g[y][x] = 'C'

    # Tabby çizgileri — alın deseni (alın: y 12..18, simetrik)
    # Orta dik çizgi (forehead M-pattern)
    vline(g, cx, 12, 17, 'B')
    # Yan tabby çizgileri
    for y in range(13, 17):
        px(g, cx - 3, y, 'B')
        px(g, cx + 3, y, 'B')
    for y in range(14, 17):
        px(g, cx - 6, y, 'B')
        px(g, cx + 6, y, 'B')

    # Gözler — badem şeklinde, simetrik
    # Sol göz — almond shape with green iris and a single white highlight.
    # The highlight ('W') shares its thread with the whiskers (same DMC),
    # so the cat stays inside the 8-colour Hard-tier budget.
    rect(g, cx - 8, 20, cx - 4, 22, 'B')   # eye outline
    rect(g, cx - 7, 21, cx - 5, 21, 'E')   # green iris
    px(g, cx - 6, 21, 'K')                 # pupil
    px(g, cx - 7, 20, 'W')                 # highlight

    # Sağ göz
    rect(g, cx + 4, 20, cx + 8, 22, 'B')
    rect(g, cx + 5, 21, cx + 7, 21, 'E')
    px(g, cx + 6, 21, 'K')
    px(g, cx + 5, 20, 'W')

    # Burun — küçük pembe üçgen
    px(g, cx - 1, 25, 'P'); px(g, cx, 25, 'P'); px(g, cx + 1, 25, 'P')
    px(g, cx, 26, 'P')
    # Burun kenarı (siyah)
    px(g, cx - 2, 25, 'K')
    px(g, cx + 2, 25, 'K')

    # Ağız — küçük "Y" şekli (gülen kedi)
    px(g, cx, 27, 'K')
    px(g, cx - 1, 28, 'K')
    px(g, cx + 1, 28, 'K')
    px(g, cx - 2, 29, 'K')
    px(g, cx + 2, 29, 'K')
    px(g, cx - 3, 29, 'K')
    px(g, cx + 3, 29, 'K')

    # Bıyıklar — 3 çift, simetrik
    # Sol bıyıklar
    hline(g, 25, cx - 13, cx - 4, 'W')
    hline(g, 27, cx - 13, cx - 4, 'W')
    hline(g, 29, cx - 12, cx - 5, 'W')
    # Sağ bıyıklar
    hline(g, 25, cx + 4, cx + 13, 'W')
    hline(g, 27, cx + 4, cx + 13, 'W')
    hline(g, 29, cx + 5, cx + 12, 'W')
    # Bıyıkların kediye girdiği yerleri restore et
    for y in [25, 27, 29]:
        for x in range(cx - 4, cx + 5):
            if g[y][x] == 'W':
                g[y][x] = 'O'

    # Final symmetry pass to fix any single-pixel asymmetries introduced
    # by the rect() shortcuts above (eyes were drawn separately L/R).
    mirror_lr(g)

    return g, "Kedi Yüzü", "kedi", "hard", [
        ('.', 'Off White',          '3865',  '#F4F0E8'),
        ('O', 'Burnt Orange',       '947',   '#FF5C14'),
        ('B', 'Brown Light',        '434',   '#B46428'),
        ('C', 'Tan Very Light',     '738',   '#F0D2A0'),
        ('P', 'Salmon Light',       '761',   '#FFC8B4'),
        ('E', 'Parrot Green Light', '907',   '#96D200'),
        ('K', 'Black',              '310',   '#1A1A1A'),
        ('W', 'Snow White',         'B5200', '#FFFFFF'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 8. MANZARA — 40×40, 7 renk (sky, sun, mountain, snow, pine, grass, water)
# Naturally asymmetric: sun bottom-right of horizon, two mountains in
# different positions, two pines, small lake bottom-left.
# ────────────────────────────────────────────────────────────────────────────
def build_manzara():
    W, H = 40, 40
    # Start with sky everywhere, then paint ground over the bottom half.
    g = grid(W, H, 'S')

    HORIZON = 24    # the grass starts here (rows 24..39, 16 rows tall)

    # ── Ground (grass) covers rows 24..39 ─────────────────────────────
    rect(g, 0, HORIZON, W - 1, H - 1, 'G')

    # ── Güneş — ufka yakın, sağ-üst tarafta. Yarım daire ──────────────
    sun_cx, sun_cy = 30, HORIZON - 4   # 30, 20
    for y in range(sun_cy - 3, sun_cy + 4):
        for x in range(sun_cx - 3, sun_cx + 4):
            d2 = (x - sun_cx) ** 2 + (y - sun_cy) ** 2
            if d2 <= 12 and y < HORIZON:
                px(g, x, y, 'Y')

    # ── Dağlar — 2 üçgen arka planda, biri kar tepeli ────────────────
    def mountain(apex_x, apex_y, base_y, ch):
        for y in range(apex_y, base_y + 1):
            span = y - apex_y
            hline(g, y, apex_x - span, apex_x + span, ch)

    # Sol büyük dağ — apex (12, 8), tabanı y=23
    mountain(12, 8, HORIZON - 1, 'M')
    # Sağ orta dağ — apex (24, 14), tabanı y=23
    mountain(24, 14, HORIZON - 1, 'M')

    # Kar tepesi — sol dağın üstünde, küçük pyramid
    for y in range(8, 12):
        span = y - 8
        hline(g, y, 12 - span, 12 + span, 'N')

    # ── Su (göl) — çim içinde, sol alt köşede dar elips ──────────────
    filled_ellipse(g, 8, 33, 7, 2, 'B')

    # ── Çamlar — 2 adet, perspektif farkı için ───────────────────────
    def pine(cx, ground_y):
        # Top tier (3 satır)
        for y in range(ground_y - 9, ground_y - 6):
            span = y - (ground_y - 9)
            hline(g, y, cx - span, cx + span, 'F')
        # Middle (4 satır, 1 overlap)
        for y in range(ground_y - 7, ground_y - 3):
            span = (y - (ground_y - 7)) + 1
            hline(g, y, cx - span, cx + span, 'F')
        # Bottom (3 satır, en geniş)
        for y in range(ground_y - 4, ground_y - 1):
            span = (y - (ground_y - 4)) + 2
            hline(g, y, cx - span, cx + span, 'F')
        # Gövde — koyu yeşil silüet (F ile aynı thread). Ayrı brown
        # trunk eklemek 8 → 7 bütçesini bozardı; siluetin okunması için
        # ucu sivri F yeterli.
        px(g, cx, ground_y - 1, 'F')
        px(g, cx, ground_y, 'F')

    pine(26, 30)   # sol-orta ağaç (su göletinin sağı)
    pine(33, 33)   # sağ ağaç, biraz daha aşağıda (perspektif)

    return g, "Manzara", "manzara", "hard", [
        ('S', 'Baby Blue Light',    '3325',  '#A8CDE8'),
        ('Y', 'Yellow Pale',        '744',   '#FFEE6E'),
        ('M', 'Pewter Gray',        '317',   '#646464'),
        ('N', 'Snow White',         'B5200', '#FFFFFF'),
        ('F', 'Forest Green Dark',  '987',   '#4F7942'),
        ('G', 'Parrot Green Medium','906',   '#7DB400'),
        ('B', 'Blue Medium',        '826',   '#4878A0'),
    ]


# ────────────────────────────────────────────────────────────────────────────
# 9. PASTA — 43×42, 9 renk (3 katlı, mumlar, fırfır, çilek)
# Odd width so the centre candle lands on the symmetry axis.
# ────────────────────────────────────────────────────────────────────────────
def build_pasta():
    W, H = 43, 42
    g = grid(W, H, '.')
    cx = W // 2  # 21

    # Mumlar — 3 adet üstte. Alev tek tonlu sarı (kullanıcının 9 renk
    # bütçesine sığması için ayrı turuncu kontur drop edildi); silüet
    # damla şekilli alev yine de okunuyor.
    candle_xs = [cx - 7, cx, cx + 7]
    for mx in candle_xs:
        # Alev — damla şekli
        px(g, mx, 1, 'Y')
        px(g, mx, 2, 'Y')
        px(g, mx - 1, 2, 'Y'); px(g, mx + 1, 2, 'Y')
        px(g, mx, 3, 'Y')
        # Mum gövdesi (beyaz)
        for y in range(4, 9):
            px(g, mx, y, 'W')
            px(g, mx - 1, y, 'W')

    # ── Üst kat (en küçük) — w 17, y 9..15 ───────────────────────────
    rect(g, cx - 8, 9, cx + 8, 15, 'p')
    # Fırfır (frosting drip) üst kenar
    for x in range(cx - 8, cx + 9):
        px(g, x, 9, 'P')
    # Alt fırfır kıvrımı (top cake)
    for x in range(cx - 8, cx + 9):
        if (x - (cx - 8)) % 2 == 0:
            px(g, x, 16, 'P')
        else:
            px(g, x, 16, 'p')
    # Üst katın çilekleri (symmetric pairs)
    px(g, cx - 5, 11, 'R'); px(g, cx - 4, 11, 'R'); px(g, cx - 5, 12, 'R')
    px(g, cx + 5, 11, 'R'); px(g, cx + 4, 11, 'R'); px(g, cx + 5, 12, 'R')

    # ── Orta kat (w 25, y 17..24) ────────────────────────────────────
    rect(g, cx - 12, 17, cx + 12, 24, 'C')
    # Üst fırfır
    for x in range(cx - 12, cx + 13):
        px(g, x, 17, 'P')
    # Alt fırfır
    for x in range(cx - 12, cx + 13):
        if (x - (cx - 12)) % 2 == 0:
            px(g, x, 25, 'P')
        else:
            px(g, x, 25, 'p')
    # Orta katın deseni — dots (symmetric around cx)
    for dx in [-9, -6, -3, 0, 3, 6, 9]:
        px(g, cx + dx, 20, 'D')
        px(g, cx + dx, 22, 'D')
    # Çilekler orta katta
    px(g, cx - 9, 19, 'R'); px(g, cx - 8, 19, 'R'); px(g, cx - 9, 20, 'R')
    px(g, cx + 9, 19, 'R'); px(g, cx + 8, 19, 'R'); px(g, cx + 9, 20, 'R')

    # ── Alt kat (en büyük, w 33, y 26..34) ───────────────────────────
    rect(g, cx - 16, 26, cx + 16, 34, 'B')
    # Üst fırfır
    for x in range(cx - 16, cx + 17):
        px(g, x, 26, 'P')
    # Alt fırfır
    for x in range(cx - 16, cx + 17):
        if (x - (cx - 16)) % 2 == 0:
            px(g, x, 35, 'P')
        else:
            px(g, x, 35, 'p')
    # Alt katın çiçek deseni — symmetric around cx
    for dx in [-12, -8, -4, 0, 4, 8, 12]:
        x = cx + dx
        px(g, x, 30, 'D')
        px(g, x - 1, 30, 'P')
        px(g, x + 1, 30, 'P')
        px(g, x, 29, 'P')
        px(g, x, 31, 'P')
    # Çilekler — simetrik çiftler
    px(g, cx - 13, 28, 'R'); px(g, cx - 12, 28, 'R'); px(g, cx - 13, 29, 'R')
    px(g, cx + 13, 28, 'R'); px(g, cx + 12, 28, 'R'); px(g, cx + 13, 29, 'R')

    # ── Tabak (en altta) — geniş elips, tek tonlu gri ─────────────────
    filled_ellipse(g, cx, 38, 21, 2, 'T')

    # Final exact-symmetry pass — cleans up any single-pixel drift in
    # the ellipse / odd-width rect drawings.
    mirror_lr(g)

    return g, "Pasta", "pasta", "hard", [
        ('.', 'Off White',          '3865',  '#F4F0E8'),
        ('Y', 'Yellow Medium',      '743',   '#FFCC14'),  # candle flame
        ('W', 'Snow White',         'B5200', '#FFFFFF'),  # candle body
        ('p', 'Salmon Light',       '761',   '#FFC8B4'),  # top tier pink
        ('P', 'Mauve Medium Light', '3688',  '#D28CA0'),  # frosting accents
        ('C', 'Yellow Pale',        '744',   '#FFEE6E'),  # mid tier cream
        ('B', 'Tan Very Light',     '738',   '#F0D2A0'),  # bottom tier tan
        ('D', 'Mauve',              '3687',  '#C06478'),  # dot accents
        ('R', 'Bright Red',         '666',   '#E0001E'),  # strawberries
        ('T', 'Pearl Gray',         '415',   '#C8C8C8'),  # plate
    ]


# ────────────────────────────────────────────────────────────────────────────
# Output formatting
# ────────────────────────────────────────────────────────────────────────────
PATTERNS = [
    (build_kalp,    True),
    (build_yildiz,  True),
    (build_ev,      False),  # baca + ağaç farklı taraflarda
    (build_cicek,   True),
    (build_karpuz,  True),
    (build_cay,     False),  # kulp sağda
    (build_kedi,    True),
    (build_manzara, False),  # doğal asimetri (dağlar, ağaçlar, güneş)
    (build_pasta,   True),
]


def main():
    check_only = '--check' in sys.argv
    out_blocks = []
    for builder, sym in PATTERNS:
        g, name, id_, diff, palette = builder()
        s = to_str(g)
        w, h = validate(name, s, symmetric=sym)
        if not check_only:
            print(f"// === {name} ({id_}, {diff}) — {w}×{h}, {len(palette)} colours ===")
            print(f"const {id_} = parse(")
            print(f"`{s}`,")
            print("  [")
            for ch, n, dmc, hex_ in palette:
                print(f"    {{ ch: {ch!r}, name: {n!r:30s}, dmc: {dmc!r:8s}, hex: {hex_!r} }},")
            print("  ]")
            print(");\n")
    if check_only:
        print("OK — all patterns validated")


if __name__ == '__main__':
    main()
