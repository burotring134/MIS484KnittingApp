# Threadia — Başlatma Notu

Projeyi sıfırdan ayağa kaldırmak için adım adım rehber. Her komutu kendi
terminal sekmesinde aç. Web frontend kaldırıldı — proje artık **backend +
mobile**'dan ibaret. Backend MongoDB'ye bağlı.

---

## 0. Ön gereksinimler (sadece ilk kurulumda)

- Node.js 18+ (`node -v`)
- **MongoDB** (brew ile macOS'ta):

  ```bash
  brew install mongodb-community
  brew services start mongodb-community
  brew services list | grep mongo    # status: started
  ```

  Docker tercih edersen: proje kökünde `docker compose up -d mongo`.
  Brew yoksa Atlas free tier'dan bir cluster oluşturup `MONGO_URL`'i
  ona çevirebilirsin.

- Watchman (Expo için, macOS Tahoe'da zorunlu):

  ```bash
  brew install watchman
  ```

- Proje kökünde `.env` dosyası şu içerikle olmalı:

  ```
  FALL_API_KEY=fal_ai_anahtarın_buraya
  PORT=5001
  MONGO_URL=mongodb://localhost:27017/threadia
  ```

- Bağımlılıkları yükle (sadece bir kez):

  ```bash
  cd ~/Desktop/threadia
  npm run install:all          # backend + mobile
  ```

---

## 1. Port 5001 boş mu kontrol et (her başlatmadan önce)

Eski/zombie bir backend süreci portu tutuyor olabilir.

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
```

- Çıktı boşsa port temiz, devam.
- Çıktıda bir `node` PID'i görünüyorsa onu kapat:

  ```bash
  lsof -ti:5001 | xargs kill -9
  ```

---

## 2. Backend'i başlat (Terminal 1)

### Önerilen — tek komut (port temizle + başlat)

```bash
lsof -ti:5001 | xargs kill -9 2>/dev/null; cd ~/Desktop/threadia/backend && npm run dev
```

Bu komut önce port 5001'i tutan ne varsa öldürür, sonra backend'i başlatır.
Backend boot'ta MongoDB'ye bağlanır — bağlanamazsa fail-fast crash eder ve
neden ettiğini söyler.

### Kalıcı alias önerisi

`~/.zshrc` dosyasına ekle:

```bash
alias threadia-back='lsof -ti:5001 | xargs kill -9 2>/dev/null; cd ~/Desktop/threadia/backend && npm run dev'
alias threadia-mobile='cd ~/Desktop/threadia/mobile && npx expo start'
```

### Klasik yol

```bash
cd ~/Desktop/threadia/backend
npm run dev      # nodemon ile otomatik yeniden başlatma
# veya
npm start        # düz node, otomatik restart yok
```

Başarılı çıktı:

```
🍃  MongoDB connected — db: threadia
🧵  Threadia backend running on port 5001
📋  Templates: 9 loaded (3 easy, 3 medium, 3 hard)
🎨  DMC palette: 141 colours
🌐  Local:   http://localhost:5001
📱  Mobile:  http://YOUR_LOCAL_IP:5001
```

`🍃  MongoDB connected` yoksa Mongo kapalı:
`brew services start mongodb-community`.

Doğrulama (yeni bir sekmede):

```bash
curl http://localhost:5001/health
# {"status":"ok","port":"5001","mongo":true,...}
```

---

## 3. Mobil uygulamayı başlat (Terminal 2)

### a) `mobile/config.js` artık otomatik

`expo-constants` Metro host'unu yakalayıp `API_BASE`'i otomatik kuruyor.
Wi-Fi/hotspot değişince Expo'yu reload etmen yeter, dosyayı düzenlemen
gerekmez. Otomatik tespit başarısız olursa `MANUAL_HOST` override'ı için
[mobile.md](docs/mobile.md)'a bak.

### b) Expo'yu başlat

```bash
cd ~/Desktop/threadia/mobile
npx expo start
# cache problemi varsa:
npx expo start -c
```

Terminalde QR kod görünecek. **Expo Go** uygulamasını telefondan aç,
QR'ı tara. iOS simulator için `i`, Android emulator için `a`.

---

## 4. Hepsini durdurmak

Her terminalde `Ctrl+C`. Backend SIGINT'te Mongo connection'ını kapatıp
çıkar (loglar konsolda).

Arka planda zombie kalırsa:

```bash
lsof -ti:5001,8081,19000,19001 | xargs kill -9
```

---

## Sık karşılaşılan hatalar

| Hata | Çözüm |
|------|-------|
| Backend `MongoDB connection failed` | Mongo kapalı. `brew services start mongodb-community`. Status: `brew services list \| grep mongo` |
| Backend `MongoServerSelectionError ECONNREFUSED 27017` | Aynısı — Mongo süreci yok |
| Backend `npm run dev` hiçbir şey basmıyor | Zombie süreç port 5001'i tutuyor. Adım 2'deki tek-komutu çalıştır |
| `EADDRINUSE: 0.0.0.0:5001` | `lsof -ti:5001 \| xargs kill -9` sonra tekrar başlat |
| `zsh: killed npm run dev` | macOS OOM killer. Browser tab'larını + ağır uygulamaları kapat, tekrar dene |
| Disk %90+ dolu, npm install dosya kayboruyor | macOS purgeable storage node_modules'tan dosya siliyor. `sudo tmutil deletelocalsnapshots /`, `~/Library/Caches` temizle, Trash boşalt. Hedef %20+ boş |
| `Cannot find module 'babel-preset-expo'` | `cd mobile && rm -rf node_modules package-lock.json && npm install`, sonra `npx expo install --fix` |
| Mobil "Network request failed" | Genelde IP eşleşmiyor. Expo terminalindeki `[config] expo-constants → http://X.X.X.X:5001` ile Mac'in `ipconfig getifaddr en0` çıktısını karşılaştır. iPhone hotspot kullanıyorsan client isolation olabilir; ngrok dene (`ngrok http 5001`) |
| Mobil pattern üretiminde "fal.ai upload failed: Forbidden" | `.env`'deki `FALL_API_KEY` geçersiz. https://fal.ai/dashboard/keys |
| `FALL_API_KEY not set` | Proje kökünde `.env` eksik veya yanlış isim |
| Expo "Starting project at..." sonrası takılı | `brew install watchman` |
| `expo` kökten çağrılınca `ConfigError: module 'expo' not installed` | `npx expo start`'ı **mobile/** içinden çalıştır |
