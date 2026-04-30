# Threadia — Docs

AI cross-stitch pattern generator. İki parça (web frontend kaldırıldı):

| Parça | Konum | Doc |
|-------|-------|-----|
| **Backend** | [backend/](../backend/) | [backend.md](backend.md) |
| **Mobile (Expo)** | [mobile/](../mobile/) | [mobile.md](mobile.md) |

## Roadmap

| Konu | Durum | Doc |
|------|-------|-----|
| MongoDB local kurulumu | **kuruldu (faz 1 başladı)** | [storage.md](storage.md) |
| S3/MinIO object storage | **plan** — henüz implement edilmedi | [storage.md § 5](storage.md#5-object-storage-s3--minio-düzeni) |
| Auth + cloud project sync | **plan** | [storage.md § 8-9](storage.md#8-mobile-değişiklikleri) |

## Hızlı başlangıç

İlk kez çalıştırıyorsan **[../BASLATMA.md](../BASLATMA.md)** her şeyi tek dosyada anlatıyor (kurulum + sık hatalar).

Geliştirme sırasında her parçayı ayrı bir terminalde başlat:

```bash
# Önce — MongoDB ayakta mı? (brew ile kuruluysa)
brew services list | grep mongodb-community

# Terminal 1 — backend (Mongo'ya da bağlanır)
cd ~/Desktop/threadia/backend && npm run dev

# Terminal 2 — mobile
cd ~/Desktop/threadia/mobile && npx expo start
```

## Mimari

```
┌──────────────┐         ┌──────────────────────────┐
│  Mobile      │         │    Backend (Express)     │
│  (Expo Go)   │ /api/*  │    :5001                 │
│              ├────────►│  ┌────────────────────┐  │
│              │         │  │ POST /api/pattern  │──┼─►  fal.ai
│              │         │  │ GET  /api/templates│  │
│              │         │  │ GET  /health       │  │
│              │         │  └────────────────────┘  │
└──────────────┘         │                          │
                         │   data/                  │
                         │     dmcColors.js (141)   │
                         │     templates.js (9)     │
                         │                          │
                         │   lib/mongo.js ──────────┼─► MongoDB :27017
                         └──────────────────────────┘     (threadia db)
```

Web frontend (Vite + React) kaldırıldı — proje yalnızca mobile üzerinden çalışıyor. Mobile telefonun Mac'in LAN IP'sine ulaşması gerekir; bkz. [mobile.md](mobile.md).

MongoDB local'de brew ile çalışıyor. Docker tercih ediyorsan proje kökündeki [`docker-compose.yml`](../docker-compose.yml) hazır. Object storage için MinIO orada commented dur, faz 3'te açılacak ([storage.md](storage.md)).
