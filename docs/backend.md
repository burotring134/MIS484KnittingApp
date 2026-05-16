# Backend

Express server on port **5001**. Pattern üretimi (fal.ai üzerinden), DMC iplik eşleştirme, hazır şablon servisi. **MongoDB**'ye bağlı (proje + template metadata için — şu an sadece bağlantı kurulu, veri yazımı henüz aktif değil; bkz. [storage.md](storage.md)).

## Ön gereksinimler

- Node.js 18+ (`node -v`)
- **MongoDB** local'de çalışıyor olmalı:

  ```bash
  brew install mongodb-community         # ilk kez
  brew services start mongodb-community  # her boot'ta otomatik açılır
  brew services list | grep mongo        # durum kontrol
  ```

  Docker tercih edersen: proje kökünde `docker compose up -d mongo`.

- Proje kökünde `.env`:
  ```
  FAL_KEY=fal_ai_anahtarın_buraya
  PORT=5001
  MONGO_URL=mongodb://localhost:27017/threadia
  ```

  fal.ai key olmadan pattern üretimi çalışmaz, templates endpoint'i çalışır.
  Mongo erişilemezse backend boot'ta crash eder (fail-fast).

## İlk kurulum

```bash
cd ~/Desktop/threadia/backend
npm install
```

## Çalıştırma

**Önerilen — port temizleyip başlat:**

```bash
lsof -ti:5001 | xargs kill -9 2>/dev/null; cd ~/Desktop/threadia/backend && npm run dev
```

`npm run dev` nodemon ile çalışır (dosya değişince otomatik restart). Sade `node server.js` istiyorsan: `npm start`.

Başarılı çıktı:

```
🍃  MongoDB connected — db: threadia
🧵  Threadia backend running on port 5001
📋  Templates: 9 loaded (3 easy, 3 medium, 3 hard)
🎨  DMC palette: 141 colours
🌐  Local:   http://localhost:5001
📱  Mobile:  http://YOUR_LOCAL_IP:5001
```

`🍃  MongoDB connected` satırı yoksa veya `❌  MongoDB connection failed` görürsen Mongo kapalı demektir. Yukarıdaki `brew services start` komutunu çalıştır.

## Doğrulama

```bash
curl http://localhost:5001/health
# {"status":"ok","port":"5001","templates":9,"dmcColors":141,"mongo":true,"time":"..."}

# Mongo elle bağlan:
mongosh threadia
> show collections   # şu an boş — faz 1'de seed eklenecek

curl http://localhost:5001/api/verify-fal
```

## Endpoint'ler

| Method | Path | Açıklama |
|--------|------|----------|
| GET  | `/health`              | Sunucu sağlığı + Mongo ping + template/DMC sayısı |
| GET  | `/api/templates`       | 9 hazır şablon (hafif liste, grid yok) |
| GET  | `/api/templates/:id`   | Tek bir şablonun tam pattern verisi |
| POST | `/api/pattern`         | Fotoğraf yükle → AI pattern üret. Body: multipart/form-data {`image`, `gridSize`, `numColors`, `difficulty`} |
| GET  | `/api/verify-fal`      | fal.ai key'in geçerli mi diye test eder |

Faz 1+ ile gelecek endpoint'ler için bkz. [storage.md § 6](storage.md#6-yeni-backend-endpointleri).

## Klasör yapısı

```
backend/
├── server.js             # entry — express setup, mongo bootstrap, listen
├── package.json
├── routes/
│   ├── pattern.js        # POST /api/pattern (fal.ai + quantisation)
│   └── templates.js      # GET /api/templates(/:id)
├── lib/
│   └── mongo.js          # MongoClient pool (lazy connect, single shared)
├── utils/
│   └── colorUtils.js     # k-means, Lab/DeltaE, palette helpers
└── data/
    ├── dmcColors.js      # 141 DMC iplik kataloğu
    └── templates.js      # 9 hazır şablon (ASCII grid + palette)
```

## Sık hatalar

| Belirti | Sebep / Çözüm |
|---------|---------------|
| `EADDRINUSE 5001` | Port dolu. `lsof -ti:5001 \| xargs kill -9` |
| `MongoDB connection failed` boot'ta | Mongo kapalı. `brew services start mongodb-community`. Status: `brew services list \| grep mongo` |
| `MongoServerSelectionError: connect ECONNREFUSED ::1:27017` | Aynı şey — Mongo süreci yok |
| `npm run dev` hiçbir şey basmıyor | Zombie node süreci portu tutmuş. Yukarıdaki tek-komutu çalıştır |
| `Cannot find module './data/templates'` | Dosya taşımadan kalan eski path. `backend/data/` içine bak |
| `fal.ai upload failed: Forbidden` | `.env`'deki `FAL_KEY` geçersiz. https://fal.ai/dashboard/keys |
| `FAL_KEY not set` | Proje **kökünde** `.env` yok. `backend/.env` değil, `~/Desktop/threadia/.env` |
| Templates `[]` dönüyor | `backend/data/templates.js` parse hatasıyla boş döndürmüş; sunucu log'una bak |
