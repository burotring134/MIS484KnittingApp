# Threadia — Docs

AI cross-stitch pattern generator. İki parça (web frontend kaldırıldı):

| Parça | Konum | Doc |
|-------|-------|-----|
| **Backend** | [backend/](../backend/) | [backend.md](backend.md) |
| **Mobile (Expo)** | [mobile/](../mobile/) | [mobile.md](mobile.md) |

## Roadmap

| Konu | Durum | Doc |
|------|-------|-----|
| MongoDB local kurulumu | **Kuruldu ve Aktif ✓** | [storage.md](storage.md) |
| Cloud project sync (MongoDB) | **Kuruldu ve Aktif ✓** | [storage.md](storage.md) |
| S3/MinIO object storage | **Plan** — henüz implement edilmedi | [storage.md § 5](storage.md#5-object-storage-s3--minio-düzeni) |
| User Auth altyapısı | **Plan** | [storage.md § 8-9](storage.md#8-mobile-değişiklikleri) |

## Hızlı başlangıç

İlk kez çalıştırıyorsan **[../BASLATMA.md](../BASLATMA.md)** her şeyi tek dosyada anlatıyor (kurulum + sık hatalar).

Geliştirme sırasında her parçayı ayrı bir terminalde başlat:

```bash
# Önce — MongoDB ayakta mı? (brew ile kuruluysa)
brew services list | grep mongodb-community

# Terminal 1 — backend (Mongo'ye de bağlanır)
cd ~/Desktop/threadia/backend && npm run dev

# Terminal 2 — mobile
cd ~/Desktop/threadia/mobile && npx expo start
```

## Mimari

```
┌──────────────┐         ┌──────────────────────────┐
`│  Mobile      │         │    Backend (Express)     │
│  (Expo Go)   │ /api/*  │    :5001                 │
│              ├────────►│  ┌────────────────────┐  │
│              │         │  │ POST /api/pattern  │──┼─►  fal.ai
│              │         │  │ GET  /api/templates│  │
│              │         │  │ CRUD /api/projects │──┼─┐
│              │         │  │ GET  /health       │  │ │
│              │         │  └────────────────────┘  │ │
└──────────────┘         │                          │ │
                         │   data/                  │ │
                         │     dmcColors.js (141)   │ │
                         │     templates.js (9)     │ │
                         │                          │ │
                         │   lib/mongo.js ──────────┼─┼─► MongoDB :27017
                         └──────────────────────────┘     (threadia db)
```

Web frontend (Vite + React) kaldırıldı — proje yalnızca mobile üzerinden çalışıyor. Mobil cihazın Mac'in LAN IP'sine ulaşması gerekir; bkz. [mobile.md](mobile.md).

MongoDB local'de brew ile çalışıyor. Docker tercih ediyorsanız proje kökündeki [`docker-compose.yml`](../docker-compose.yml) hazır. Object storage için MinIO orada commented durur, faz 3'te açılacaktır ([storage.md](storage.md)).
