# Threadia Style Guide (IBM Plex Edition)

Threadia'nın resmi renk paleti, tipografi ve görsel kuralları. Yeni UI işi
yaparken **DESIGN.md** ile birlikte bu dosyayı baz al. DESIGN.md "nasıl
hisseder" anayasası; STYLEGUIDE.md "hangi renk, hangi font, hangi token"
sözlüğüdür.

Aesthetic: **Modern-nostalgic, soft pastel, minimalist** with a
"Professional Tool" feel.

---

## 1. Typography

**Primary Font:** IBM Plex Sans (Google Fonts). Çağdaş, yüksek okunabilirlik,
mühendislik hassasiyetini sıcak bir ton ile dengeler.

| Usage                       | Weight              | Token         |
|----------------------------|---------------------|---------------|
| Headers, primary nav, CTAs | **Bold 700**        | `F.bold`      |
| Mid-emphasis labels        | SemiBold 600        | `F.semibold`  |
| Body text, descriptions    | Regular 400         | `F.regular`   |

**Line-height: 1.6** — kompleks kanaviçe talimatları ve pattern verisi için
maksimum okunabilirlik. Body text'te `lineHeight = fontSize * 1.6` uygula
(örn. 13px text → 21px line-height).

---

## 2. Color Palette

| Role                     | Hex       | Semantic Token       | Kullanım |
|--------------------------|-----------|----------------------|---------|
| **Primary** (Rose Dust)  | `#D4A5A5` | `S.surfaceBrand`     | Primary buttons, active states, brand identity |
| **Secondary** (Soft Petal) | `#EBCBCB` | `S.surfaceAccent` | Card backgrounds, secondary nav, soft dividers |
| **Accent/Success** (Sage Green) | `#A8B5A2` | `S.textSuccess` | Confirmation buttons, success icons, natural contrast |
| **Background** (Linen White) | `#F9F7F5` | `S.surfacePrimary` | Main background — warm, non-glare textile feel |
| **Primary Text** (Deep Umber) | `#4A3F3F` | `S.textPrimary` | All text — IBM Plex Sans, crisp readability |
| **Subtle Text/Icons** (Muted Mauve) | `#9E8484` | `S.textSecondary` | Placeholders, inactive icons, metadata |

**Press / pressed states:** Primary butonlar basılınca daha derin bir tona
geçer — `#B07676` (mauveDeep) overlay ile cross-fade. Soft Petal yüzeyler
basılınca Rose Dust'a geçer.

---

## 3. Layout & Composition

- **60-30-10 distribution:** `#F9F7F5` (Linen White) dominant %60, soft
  accents (Rose Dust + Soft Petal) %30, success / detail %10. Sayfanın çoğu
  arka plan renginde nefes almalı.
- **Rounded corners:** ~12px varsayılan. `R.medium` (14) içerik kartları,
  `R.expressive` (20) feature panel/tile, `R.pill` (9999) butonlar için.
- **Shadows:** Çok yumuşak — `shadowOpacity: 0.04–0.08`, `shadowRadius:
  10–18`, `shadowOffset: { width: 0, height: 4–8 }`. Sert drop-shadow yok.

---

## 4. Contrast & Accessibility

- Deep Umber (`#4A3F3F`) Linen White (`#F9F7F5`) üzerinde 8.5:1 — WCAG AAA.
  Tüm body ve başlık metinleri bu kombo ile yazılmalı.
- Muted Mauve (`#9E8484`) sadece destekleyici text için — kontrast 4.6:1,
  AA Large. Asla 12px altı metinde kullanılmaz.
- Press/hover state'leri görseli yetmez — her interaksiyon scale ve/veya
  renk değişimiyle çift kanaldan iletilmeli.

---

## 5. Token Reference

Bu dosyadaki tüm token isimleri `mobile/utils/theme.js` içinde
yaşar:

```js
import { S, F, R, SPRING } from '../utils/theme';

// Color
backgroundColor: S.surfacePrimary       // linen white
backgroundColor: S.surfaceBrand         // rose dust (primary)
backgroundColor: S.surfaceAccent        // soft petal
color: S.textPrimary                    // deep umber
color: S.textSecondary                  // muted mauve

// Type
fontFamily: F.bold                      // headers / CTAs
fontFamily: F.regular                   // body

// Radius
borderRadius: R.medium                  // 14
borderRadius: R.expressive              // 20
borderRadius: R.pill                    // 9999
```

Asla literal hex veya literal radius yazma — token kullan.
