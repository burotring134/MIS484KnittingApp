# Backend

Express server on port **5001**. Pattern üretimi (fal.ai üzerinden), DMC iplik eşleştirme, hazır şablon servisi ve MongoDB entegrasyonu ile mobil projelerin senkronizasyonu sağlanır.

## Ön gereksinimler

- Node.js 18+ (`node -v`)
- **MongoDB** local'de çalışıyor olmalı:

  ```bash
  brew install mongodb-community         # ilk kez
  brew services start mongodb-community  # her boot'ta otomatik açılır
  brew services list | grep mongo        # durum kontrol
  ```

  Docker tercih ederseniz: proje kökünde `docker compose up -d mongo` ile çalıştırabilirsiniz.

- Proje kökündeki `.env` içeriği:
  ```
  FAL_KEY=fal_ai_anahtarın_buraya
  PORT=5001
  MONGO_URL=mongodb://localhost:27017/threadia
  ```

  fal.ai key olmadan pattern üretimi çalışmaz (k-means fallback uygulanır), templates ve projects endpoint'leri çalışır.
  Mongo bağlantısı kurulamazsa backend boot'ta fail-fast crash eder.

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

`npm run dev` nodemon ile çalışır (dosya değişince otomatik restart). Sade `node server.js` istiyorsanız: `npm start`.

Başarılı çıktı:

```
🍃  MongoDB connected — db: threadia
🧵  Threadia backend running on port 5001
📋  Templates: 9 loaded (3 easy, 3 medium, 3 hard)
🎨  DMC palette: 141 colours
🌐  Local:   http://localhost:5001
📱  Mobile:  http://YOUR_LOCAL_IP:5001
```

`🍃  MongoDB connected` satırı yoksa veya `❌  MongoDB connection failed` görürseniz Mongo kapalı demektir. Yukarıdaki `brew services start` komutuyla Mongo servisini başlatın.

## Doğrulama

```bash
curl http://localhost:5001/health
# {"status":"ok","port":"5001","templates":9,"dmcColors":141,"mongo":true,"time":"..."}

# Mongo veritabanına doğrudan bağlanmak için:
mongosh threadia
> show collections   # 'projects' koleksiyonunu göreceksiniz
```

## Endpoint'ler

| Method | Path | Açıklama |
|--------|------|----------|
| GET    | `/health`              | Sunucu sağlığı + Mongo ping + template/DMC sayısı |
| GET    | `/api/templates`       | 9 hazır şablon (hafif liste, grid yok) |
| GET    | `/api/templates/:id`   | Tek bir şablonun tam pattern verisi |
| POST   | `/api/pattern`         | Fotoğraf yükle → AI pattern üret. Body: multipart/form-data {`image`, `gridSize`, `numColors`, `difficulty`} |
| GET    | `/api/projects`        | MongoDB'ye senkronize edilmiş tüm projelerin listesi (en son eklenen ilk sırada) |
| GET    | `/api/projects/:id`    | ID'sine göre tek bir projenin tam senkronizasyon verisi |
| POST   | `/api/projects`        | Yeni proje kaydetme veya mevcut projeyi güncelleme (upsert) |
| DELETE | `/api/projects/:id`    | Projeyi senkronizasyon veritabanından kalıcı olarak silme |

## Klasör yapısı

```
backend/
├── server.js             # Entry — express setup, mongo bootstrap, cors ve rotalar
├── package.json
├── routes/
│   ├── pattern.js        # POST /api/pattern (fal.ai + sharp + weighted k-means ve DMC eşleme)
│   ├── templates.js      # GET /api/templates(/:id) (Hazır şablon API'ları)
│   └── projects.js       # GET/POST/DELETE /api/projects (MongoDB senkronizasyon CRUD işlemleri)
├── lib/
│   └── mongo.js          # MongoClient bağlantı havuzu (lazy connect, single shared client)
├── utils/
│   ├── colorUtils.js     # k-means, CIE L*a*b* dönüşümü, DeltaE 2000 renk mesafe algoritmaları
│   └── patternImage.js   # Zorluk seviyesine göre (easy, medium, hard) şema PNG render motoru
└── data/
    ├── dmcColors.js      # 141 DMC iplik kataloğu hex ve adları
    └── templates.js      # 9 hazır şablon (easy, medium, hard ASCII grid verisi)
```

## Sık karşılaşılan hatalar

| Belirti | Sebep / Çözüm |
|---------|---------------|
| `EADDRINUSE 5001` | Port dolu. `lsof -ti:5001 \| xargs kill -9` ile temizleyin. |
| `MongoDB connection failed` boot'ta | Mongo kapalı. `brew services start mongodb-community` yapın. |
| `MongoServerSelectionError: connect ECONNREFUSED` | Aynı şekilde, MongoDB sunucu süreci arka planda çalışmıyor demektir. |
| `npm run dev` hiçbir şey basmıyor | Zombie node süreci portu tutmuş. Yukarıdaki tek komutla portu boşaltın. |
| `Cannot find module './data/templates'` | Dosya taşımadan kalan eski path. `backend/data/` içine bakıp dosyanın orada olduğundan emin olun. |
| `fal.ai upload failed: Forbidden` | `.env`'deki `FAL_KEY` geçersiz. https://fal.ai/dashboard/keys adresinden yeni key alın. |
| `FAL_KEY not set` | Proje **kökünde** `.env` yok. `backend/.env` değil, `MIS484KnittingApp/.env` (proje ana dizini) olmalıdır. |
