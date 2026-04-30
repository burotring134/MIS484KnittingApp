# Storage migration plan — MongoDB + S3/MinIO

> **Durum:** plan. Henüz hiçbir şey implement edilmedi. Bu doküman, atölyedeki
> projeleri (grid + renkler + işaretler) ve görselleri (orijinal fotoğraf, AI
> çıktısı, thumbnail) cihaz dışına taşıma yol haritasıdır.

## 1. Neden taşıyoruz?

Şu an mobile'daki **AsyncStorage**'da proje verileri tutuluyor
([`mobile/utils/storage.js`](../mobile/utils/storage.js)). Sınırlamalar:

- **Cihaz başına izole** — telefonu değiştirsen veya app'i silsen tüm proje
  geçmişin gider
- **Cross-device sync yok** — aynı kişi tablet + telefon kullanıyorsa atölye
  birleşmez
- **Görsel saklamıyoruz** — kullanıcının çektiği fotoğraf, fal.ai'ın ürettiği
  stilize görsel, ikisi de pattern üretildikten sonra atılıyor. "Orijinaliyle
  yan yana karşılaştır" gibi bir özellik yapılamıyor
- **AsyncStorage'ın boyut limiti** — Android'de ~6 MB, iOS'ta daha esnek ama
  yine de büyük projeler (55×55 grid + completed map) yığıldıkça yavaşlıyor
- **Backend de hardcoded data servis ediyor** — [`backend/data/templates.js`](../backend/data/templates.js)
  yeni şablon eklemek için redeploy gerektiriyor

Hedef: backend MongoDB'ye proje + template metadata yazsın, görseller S3
benzeri object storage'a gitsin, mobile bu API'leri çağırsın.

## 2. Mimari özet

```
┌──────────────┐                        ┌─────────────────────────┐
│  Mobile      │  HTTPS (auth header)   │   Backend (Express)     │
│  (Expo Go)   ├───────────────────────►│   :5001                 │
│              │                        │                         │
│  /projects   │                        │   ┌──── MongoDB ────┐  │
│  list/CRUD   │◄──── pattern grid      │   │  projects       │  │
│              │      JSON              │   │  templates      │  │
│  /upload     │                        │   │  users          │  │
│  signed URL  │◄──── upload URL        │   └─────────────────┘  │
│              │                        │                         │
│              │  PUT image direct      │   ┌──── S3 / MinIO ─┐  │
│              ├───────────────────────►│   │  originals/     │  │
│              │                        │   │  ai-outputs/    │  │
│              │                        │   │  thumbnails/    │  │
│              │                        │   └─────────────────┘  │
└──────────────┘                        └─────────────────────────┘
```

**Prensipler:**

- MongoDB **sadece metadata + JSON pattern verisi** taşır (~20-40 KB / proje).
  İkili görseller asla MongoDB'ye gitmez.
- Görseller **doğrudan client → object storage** akışı ile yüklenir.
  Backend sadece *signed URL* üretir, byte'lar Mac'in 5001 portundan geçmez
  (önemli — yoksa fal.ai 500'üne benzer şekilde tekrar boyut sorunları olur).
- Object storage **public-read değil**. Mobile'a okuma için signed GET URL
  verilir. Backend yetkiyi kontrol eder.

## 3. Ne nereye gidecek?

| Veri | Nereye | Tipik boyut | Neden |
|------|--------|-------------|-------|
| Proje metadata (id, name, difficulty, createdAt, ownerId) | **MongoDB** | <1 KB | Sorgu, sıralama, filtre lazım |
| Pattern grid (`grid: [[int]]`) + colors (DMC list) | **MongoDB** | 5-25 KB | İlişkili veri, JSON, küçük |
| Completed map (`{"r,c": true}`) | **MongoDB** | 0-30 KB | Sık güncelleniyor (debounced) |
| Hazır şablonlar (templates) | **MongoDB** (`templates` collection) | 5-15 KB her | Admin panel ile eklenebilsin diye |
| Kullanıcının çektiği orijinal fotoğraf | **S3/MinIO** `originals/{userId}/{projectId}.jpg` | 200-500 KB (sharp ile resize sonrası) | Büyük binary |
| fal.ai stilize çıktısı | **S3/MinIO** `ai-outputs/{userId}/{projectId}.jpg` | ~150 KB | Aynı sebep |
| Atölye liste thumbnail'ı (PNG) | **S3/MinIO** `thumbnails/{userId}/{projectId}.png` | <10 KB | UI hızlı yüklensin |
| Kullanıcı (ownerId, oauth claims, vs.) | **MongoDB** (`users` collection) | <1 KB | Auth |

## 4. MongoDB şemaları

Mongoose kullanmıyorum, native MongoDB driver yeterli — şemalar sadece
referans amaçlı. Validation backend katmanında.

### `projects`

```js
{
  _id:          ObjectId,            // MongoDB primary key
  ownerId:      ObjectId,            // → users._id
  name:         String,              // "Pattern 13.04.2026"
  source:       'photo' | 'template',
  templateId:   String?,             // source === 'template' ise
  difficulty:   'easy' | 'medium' | 'hard',
  width:        Number,              // grid columns
  height:       Number,              // grid rows
  grid:         [[Number]],          // grid[row][col] = colorId
  colors:       [{
    id:       Number,
    dmcCode:  String,
    dmcName:  String,
    dmcHex:   String,
    symbol:   String,
    count:    Number,
  }],
  completed:    { [key: 'r,c']: true },  // sparse map
  imageKeys: {                       // S3 object keys (URL'ler signed)
    original:   String?,
    aiOutput:   String?,
    thumbnail:  String?,
  },
  createdAt:    Date,
  updatedAt:    Date,
}
```

İndeksler:
- `{ ownerId: 1, updatedAt: -1 }` → atölye listesi sorgusu
- `{ ownerId: 1, _id: 1 }` → tek proje fetch (zaten _id unique ama owner kontrolü için)

### `templates`

`projects` ile çoğu alan ortak (grid, colors, width/height, difficulty), ama
`ownerId` yok ve `previewImageKey` var.

```js
{
  _id:           ObjectId,
  slug:          String,         // 'kalp', 'kedi' — URL'de kullanılır
  name:          String,         // 'Kalp', 'Kedi Yüzü'
  difficulty:    'easy' | 'medium' | 'hard',
  width: Number, height: Number,
  grid: [[Number]], colors: [...],
  previewImageKey: String?,      // S3'te thumbnail
  publishedAt:   Date,
}
```

İndeksler: `{ slug: 1 }` unique, `{ difficulty: 1, publishedAt: -1 }`.

### `users`

İlk fazda **anonim kullanıcı** desteği (cihaz UUID'si). Auth eklediğimizde
genişletilecek.

```js
{
  _id:        ObjectId,
  deviceId:   String,            // UUID, ilk açılışta üretilip mobile'a saklanır
  authProvider: 'anonymous' | 'apple' | 'google' | 'email',
  email:      String?,
  externalId: String?,           // OAuth subject
  displayName:String?,
  createdAt:  Date,
  lastSeenAt: Date,
}
```

İndeksler: `{ deviceId: 1 }` unique, `{ externalId: 1, authProvider: 1 }`.

## 5. Object storage (S3 / MinIO) düzeni

### Bucket adı

- Dev: `threadia-dev` (MinIO local)
- Prod: `threadia-prod` (AWS S3 veya başka)

### Key prefix'leri

```
originals/{ownerId}/{projectId}.jpg     ← user upload, sharp ile ≤1024px JPEG
ai-outputs/{ownerId}/{projectId}.jpg    ← fal.ai çıktısı
thumbnails/{ownerId}/{projectId}.png    ← atölye liste için ufak preview (~120×120)
templates/{templateSlug}.png            ← hazır şablonların preview'ı
```

`{ownerId}` ile prefix'lenmesi önemli — IAM policy'sinde "kullanıcı sadece
kendi prefix'ine erişsin" kuralı yazılabilir.

### Erişim modeli

- Bucket **public-read DEĞİL**
- Backend `s3:GetObject` ve `s3:PutObject` izinli (signed URL üretebilsin)
- Mobile: backend'den **signed PUT URL** ister → byte'ları doğrudan S3'e yükler
- Mobile: ekranda gösterirken **signed GET URL** ister (15 dk TTL)
- AI output upload'ı da aynı şekilde — backend fal.ai'den indirir, signed
  PUT URL ile S3'e koyar

### Lifecycle

S3 lifecycle rules:
- `originals/` → 90 gün sonra Standard-IA (ucuz katman)
- `ai-outputs/` → 30 gün sonra Standard-IA (kullanıcı zaten patterni
  kaydetti, orijinal AI output'a nadir bakar)
- Hiçbir prefix Glacier'a gitmesin (latency UX'i bozar)

## 6. Yeni backend endpoint'leri

Mevcut: `POST /api/pattern`, `GET /api/templates(/:id)`, `GET /health`,
`GET /api/verify-fal`.

Eklenecek:

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/auth/anonymous` | `{deviceId}` body → user kaydı + token döner. JWT veya session cookie |
| GET  | `/api/me` | Mevcut user'ın bilgisi |
| POST | `/api/uploads/sign` | Body: `{kind: 'original'\|'aiOutput'\|'thumbnail', projectId}`. Response: `{url, key, expiresAt}`. Mobile bu URL'e PUT eder |
| GET  | `/api/projects` | Atölye listesi. Query: `?cursor=...&limit=20`. Imageler için signed GET URL'leri inline döner |
| POST | `/api/projects` | Yeni proje yarat (POST /api/pattern bunu da yapacak — bkz. § 7) |
| GET  | `/api/projects/:id` | Tek proje (signed image URL'leri ile) |
| PATCH | `/api/projects/:id` | Body: `{name?, completed?}` — debounced kaydetme için |
| DELETE | `/api/projects/:id` | Proje sil + S3 objelerini de sil |

**Auth:** her endpoint Authorization header bekler. JWT secret backend env'de.

## 7. Pattern üretim akışı (yeni)

Şu anki akış:
```
mobile → POST /api/pattern (multipart fotoğraf)
       → backend: sharp resize → fal.ai → quantize → JSON dön
       → mobile: AsyncStorage'a kaydet
```

Yeni akış:
```
1. mobile → POST /api/uploads/sign  (kind=original)
            ← {uploadUrl, key}
2. mobile → PUT uploadUrl  (raw JPEG byte'ları, doğrudan S3'e)
3. mobile → POST /api/pattern  body: {originalKey, difficulty}
            backend:
              - S3'ten orijinali indir
              - fal.ai'ya data URI olarak gönder (mevcut)
              - AI çıktısı:
                  a) S3'e signed PUT ile yükle (ai-outputs/...)
                  b) URL üret
              - quantize → JSON
              - thumbnail üret + S3'e yükle (sharp 120×120 PNG)
              - MongoDB projects collection'a kaydet (ownerId, imageKeys, ...)
              - response: {projectId, grid, colors, signed image URLs}
4. mobile → projeyi memory'de tutar (artık AsyncStorage gerekmez)
```

Avantaj: backend şu anki gibi GB'lık multipart upload almaz, sadece S3 key
alır. Network ve memory baskısı azalır.

## 8. Mobile değişiklikleri

[`mobile/utils/storage.js`](../mobile/utils/storage.js) artık **AsyncStorage
wrapper'ı değil, REST client** olacak. API yüzeyi aynen kalsın ki çağıran
ekranlar değişmesin:

```js
// önce (AsyncStorage)
export async function getProjects() { ... }
export async function saveProject(p) { ... }
export async function updateProject(id, patch) { ... }
export async function deleteProject(id) { ... }

// sonra (HTTP)
export async function getProjects() {
  const r = await fetch(`${API_BASE}/api/projects`, { headers: authHeaders() });
  return r.json();
}
// vs.
```

Geçiş süreci için **dual-write geçici dönemi**:
- v1: AsyncStorage'a yaz + HTTP'ye yaz, okurken HTTP'yi tercih et, başarısız
  olursa AsyncStorage'tan oku
- v2: sadece HTTP, AsyncStorage temizle

Auth header için: ilk açılışta `expo-secure-store` ile token kaydet, her
istekle `Authorization: Bearer <token>` gönder.

Yeni paket: `expo-secure-store` (zaten Expo'nun bir parçası, kurulması
şart değil ama bağımlılığı eklenecek).

Image upload için `expo-image-manipulator` ile (zaten var) PUT etmek için
`fetch(uploadUrl, { method: 'PUT', body: blob })` yeterli.

## 9. Auth / kimlik

İlk fazda **anonim cihaz auth** yeterli:
1. Mobile ilk açılışta UUID üretir, secure store'a yazar
2. `POST /api/auth/anonymous` → `{deviceId}` → backend user oluşturur veya
   buluyor → JWT döner
3. Mobile JWT'yi secure store'da saklar, sonraki tüm isteklerde header'da
   gönderir

Sonra (faz 3): Apple/Google Sign-In ile **anonim hesabı upgrade** etmek —
`PATCH /api/me/auth` ile.

## 10. Local dev kurulumu

`docker-compose.yml` (proje köküne eklenecek, henüz yok):

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:7
    container_name: threadia-mongo
    ports: ['27017:27017']
    volumes: ['./.docker/mongo-data:/data/db']

  minio:
    image: minio/minio:latest
    container_name: threadia-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: threadia
      MINIO_ROOT_PASSWORD: threadia-dev-secret
    ports:
      - '9000:9000'   # S3 API
      - '9001:9001'   # web console
    volumes: ['./.docker/minio-data:/data']

  minio-init:
    image: minio/mc
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
      until /usr/bin/mc alias set local http://minio:9000 threadia threadia-dev-secret; do sleep 1; done;
      /usr/bin/mc mb -p local/threadia-dev || true;
      /usr/bin/mc anonymous set none local/threadia-dev;
      "
```

Backend `.env`'ye eklenecekler:

```
MONGO_URL=mongodb://localhost:27017/threadia
S3_ENDPOINT=http://localhost:9000     # AWS prod'da boş bırak
S3_REGION=us-east-1                   # MinIO için herhangi bir değer geçerli
S3_BUCKET=threadia-dev
S3_ACCESS_KEY=threadia
S3_SECRET_KEY=threadia-dev-secret
S3_FORCE_PATH_STYLE=true              # MinIO için zorunlu, AWS'de false
JWT_SECRET=geliştirmede-rastgele-bir-string
```

Backend dependencies (yeni):
- `mongodb` (native driver) ya da `mongoose`
- `@aws-sdk/client-s3` ve `@aws-sdk/s3-request-presigner`
- `jsonwebtoken`
- `nanoid` (deviceId, slug üretimi için)

## 11. Production opsiyonları

| Servis | MongoDB | Object storage |
|--------|---------|---------------|
| **Atlas + AWS S3** | Mongo Atlas free tier (512 MB) → M10 ($57/ay) | AWS S3 standart, ~$0.023/GB |
| **Self-hosted (VPS)** | DigitalOcean Mongo $15/ay | MinIO single-node $5/ay VPS |
| **Hibrit** | Atlas | MinIO self-hosted |
| **Render/Railway** | Render Mongo addon | Cloudflare R2 (S3-compatible, no egress fee) |

Threadia ölçeği için **Atlas free tier + Cloudflare R2** ekonomik:
- R2'nin S3 API'si var, AWS SDK çalışır (`S3_ENDPOINT=https://<acct>.r2.cloudflarestorage.com`)
- Egress ücreti yok (R2'nin avantajı) — mobile'lar görsel indirir, faturayı şişirmez
- Atlas free tier <500 MB için yeterli (1000 kullanıcı × 30 KB proje × 10 proje = 300 MB)

## 12. Faz planı

Tek seferde yapma — kademeli:

### Faz 1 — Backend altyapısı (1-2 gün)
- [ ] docker-compose.yml ekle, MongoDB + MinIO çalıştır
- [ ] `backend/lib/mongo.js` (connection pool)
- [ ] `backend/lib/s3.js` (signed URL helper)
- [ ] `users`, `projects`, `templates` collection'ları için repository fonksiyonları
- [ ] `data/templates.js`'i MongoDB'ye seed eden bir script

### Faz 2 — Auth (yarım gün)
- [ ] `POST /api/auth/anonymous` endpoint
- [ ] JWT verify middleware
- [ ] `GET /api/me`

### Faz 3 — Upload + signed URL (1 gün)
- [ ] `POST /api/uploads/sign`
- [ ] Pattern endpoint'ini yeni akışa geçir (`originalKey` body parametresi)
- [ ] Sharp ile thumbnail üretip S3'e yükleme

### Faz 4 — Project CRUD (1 gün)
- [ ] `GET /api/projects` (cursor pagination)
- [ ] `GET /api/projects/:id`
- [ ] `PATCH /api/projects/:id`
- [ ] `DELETE /api/projects/:id` (S3 cleanup dahil)

### Faz 5 — Mobile geçişi (1-2 gün)
- [ ] `expo-secure-store` ile token saklama
- [ ] `mobile/utils/storage.js` HTTP client'a dönüştür (AsyncStorage fallback ile dual-write)
- [ ] Workshop liste signed GET URL'lerle thumbnail göstersin
- [ ] Pattern üretim akışı: signed PUT → /api/pattern → mongo'ya kayıt
- [ ] AsyncStorage temizleme migration script (v2)

### Faz 6 — Production deploy (1 gün)
- [ ] Atlas cluster (M0 free tier)
- [ ] R2 bucket (veya AWS S3)
- [ ] Backend Render/Railway/Fly.io'ya deploy
- [ ] Mobile config: prod API_BASE'i ekle
- [ ] EAS build ile production binary

## 13. Risk ve dikkat noktaları

- **Veri kaybı**: AsyncStorage'tan HTTP'ye geçişte mevcut projeler taşınmalı.
  Mobile v2'de "bir defalık migration" — tüm AsyncStorage projelerini `POST
  /api/projects` ile servera yolla. Olası tek-seferlik kullanıcı eylemi olabilir
- **Offline mod**: AsyncStorage tamamen kaldırılırsa internet yokken atölye
  açılmaz. Çözüm: ya offline-first stratejiyle (PouchDB benzeri sync),
  ya da v1'de sadece "internet yokken yeni proje üretilemez" der geçeriz
- **fal.ai upload boyutu**: Şu anki `data:` URI yöntemi çalışıyor (~150 KB).
  Yeni akışta orijinali S3'ten indirip yine data URI ile fal.ai'ya yollarsak
  aynı şekilde çalışmaya devam eder. fal.ai'a doğrudan signed S3 URL vermek
  daha temiz — fal `image_url` parametresi public URL'leri kabul ediyor;
  signed URL'in 15 dk TTL'si processing süresinden uzun olmalı (fal generally
  20-60 sn)
- **Maliyet**: Faz 6'ya geçmeden önce kullanıcı sayısı x ortalama proje
  sayısı x 3 görsel = aylık storage tahmini yapılmalı. R2 1 GB ücretsiz,
  S3 ilk GB pratikte ücretsiz değil — küçükken Atlas + R2 idealdir
- **Templates seed**: `backend/data/templates.js` MongoDB'ye seed edildikten
  sonra dosya silinmemeli — versioning amacıyla kalsın, runtime sadece
  Mongo'dan okusun

## 14. İlgili dosyalar

Bu plan implement edilince etkilenecek dosyalar:

- [`backend/server.js`](../backend/server.js) — yeni router'lar mount edilecek
- [`backend/routes/pattern.js`](../backend/routes/pattern.js) — akış değişecek
- [`backend/routes/templates.js`](../backend/routes/templates.js) — Mongo
- [`backend/data/templates.js`](../backend/data/templates.js) → seed script'e taşınacak
- [`mobile/utils/storage.js`](../mobile/utils/storage.js) — komple yeniden yazılacak
- [`mobile/App.js`](../mobile/App.js) — token initialization eklenecek
- `mobile/utils/auth.js` (yeni) — secure-store + token helper
- `backend/lib/mongo.js`, `backend/lib/s3.js`, `backend/lib/auth.js` (yeni)
- `docker-compose.yml` (proje kökü, yeni)
- `.env` — yeni anahtarlar (yukarıdaki § 10)
