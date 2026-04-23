# Threadia — Başlatma Notu

Projeyi sıfırdan ayağa kaldırmak için adım adım rehber. Her komutu kendi
terminal sekmesinde aç (backend, frontend, mobile her biri ayrı sekme).

---

## 0. Ön gereksinimler (sadece ilk kurulumda)

- Node.js 18+ kurulu olmalı: `node -v`
- Proje kökünde `.env` dosyası şu içerikle olmalı:

  ```
  FALL_API_KEY=fal_ai_anahtarın_buraya
  PORT=5001
  ```

- Bağımlılıkları yükle (sadece bir kez):

  ```bash
  cd ~/Desktop/threadia
  npm run install:all          # backend + frontend
  cd mobile && npm install     # mobile için ayrıca
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
  kill <PID>
  # ya da tek seferde:
  lsof -ti:5001 | xargs kill -9
  ```

---

## 2. Backend'i başlat (Terminal 1)

### Önerilen — tek komut (port temizle + başlat)

```bash
lsof -ti:5001 | xargs kill -9 2>/dev/null; cd ~/Desktop/threadia/backend && npm run dev
```

Bu komut önce port 5001'i tutan ne varsa öldürür, sonra backend'i başlatır.
**Backend "başlamıyor" denilen %95 vakanın sebebi** zombie bir node sürecinin
portu hâlâ tutmasıdır (Ctrl+C ile düzgün kapanmamış, terminal kapanırken
parent kaybolmuş, vb.). Her başlatmadan önce bu komutu kullanırsan o sorunu
hiç yaşamazsın.

### Kalıcı alias önerisi

`~/.zshrc` dosyasına ekle (sonra `source ~/.zshrc`):

```bash
alias threadia-back='lsof -ti:5001 | xargs kill -9 2>/dev/null; cd ~/Desktop/threadia/backend && npm run dev'
alias threadia-front='cd ~/Desktop/threadia/frontend && npm run dev'
```

Sonra her terminalde sadece `threadia-back` veya `threadia-front` yazman yeterli.

### Klasik yol

```bash
cd ~/Desktop/threadia/backend
npm run dev      # nodemon ile otomatik yeniden başlatma
# veya
npm start        # düz node, otomatik restart yok
```

Başarılı çıktı:

```
Threadia backend running on port 5001
Local:   http://localhost:5001
Mobile:  http://YOUR_LOCAL_IP:5001
```

Doğrulama (yeni bir sekmede):

```bash
curl http://localhost:5001/health
# {"status":"ok","port":"5001",...}
```

### "Hiçbir çıktı yok, takıldı" gibi görünüyorsa

Süreç ayakta ama port 5001'i alamadığı için sessizce bekliyor demektir.
`Ctrl+C` ile durdur, yukarıdaki tek-komutu çalıştır. Sorun biter.

Hangi süreçlerin port 5001'i tuttuğunu görmek için:

```bash
lsof -nP -iTCP:5001
```

---

## 3. Web frontend'i başlat (Terminal 2)

```bash
cd ~/Desktop/threadia/frontend
npm run dev
```

**Önemli:** `> vite` satırından sonra **5–10 saniye bekle** — donmadı,
ısınıyor. Hazır olunca şu mesaj çıkar:

```
VITE v5.4.21  ready in XXXX ms
Local:   http://localhost:3000/
```

Sonra tarayıcıdan aç: <http://localhost:3000>

`/api/*` istekleri otomatik olarak backend'e (5001) yönlendiriliyor
(vite proxy üzerinden), ekstra ayar gerekmez.

İlk açılışta vite hâlâ takılıyorsa cache'i temizle:

```bash
rm -rf node_modules/.vite
npm run dev
```

---

## 4. Mobil uygulamayı başlat (Terminal 3 — opsiyonel)

### a) Önce backend adresini ayarla

`mobile/config.js` dosyasını aç. Telefon `localhost`'a ulaşamaz, bu yüzden:

- **Aynı Wi-Fi'daysan:** Mac'in LAN IP'sini öğren ve yaz:

  ```bash
  ipconfig getifaddr en0    # örn. 192.168.1.33
  ```

  ```js
  export const API_BASE = 'http://192.168.1.33:5001';
  ```

- **Farklı ağdaysan / NAT problemi varsa:** ngrok tüneli kullan:

  ```bash
  ngrok http 5001
  ```

  Sonra çıkan https URL'i `API_BASE` olarak yaz.

### b) Expo'yu başlat

```bash
cd ~/Desktop/threadia/mobile
npx expo start
# cache problemi varsa:
npx expo start -c
```

Terminalde QR kod görünecek. **Expo Go** uygulamasını telefondan aç,
QR'ı tara. iOS simulator için `i`, Android emulator için `a` tuşuna bas.

---

## 5. Hepsini durdurmak

Her terminalde `Ctrl+C`. Eğer arka planda kalan bir şey olursa:

```bash
lsof -ti:5001,3000,8081,19000,19001 | xargs kill -9
```

---

## Hızlı tek-komut başlatma (sadece web)

Backend + frontend'i birlikte başlatmak için (proje kökünden):

```bash
cd ~/Desktop/threadia
npm run dev
```

Bu hem backend'i hem frontend'i `concurrently` ile aynı anda çalıştırır.

---

## Sık karşılaşılan hatalar

| Hata | Çözüm |
|------|-------|
| Backend `npm run dev` hiçbir şey basmıyor / takılı | Zombie süreç port 5001'i tutuyor. Adım 2'deki tek-komutu çalıştır |
| `EADDRINUSE: 0.0.0.0:5001` | Aynısı: `lsof -ti:5001 \| xargs kill -9` sonra tekrar başlat |
| Vite `> vite` satırında duruyor gibi | Donmadı, 5–10 sn bekle. Hâlâ takılıysa `rm -rf node_modules/.vite` |
| Vite `EADDRINUSE` 3000 | Eski vite süreci açık: `lsof -ti:3000 \| xargs kill -9` |
| `Cannot find module '/.../node_modules/X/...'` (debug, dotenv-expand vb.) | npm yarım kurmuş. `cd mobile && rm -rf node_modules package-lock.json && npm install` |
| `Cannot find module 'babel-preset-expo'` | Aynı çözüm — node_modules sıfırla, sonra `npx expo install --fix` |
| Mobil "Bağlantı hatası" / "Network request failed" | `mobile/config.js` içindeki `API_BASE` yanlış veya ngrok URL'i ölmüş. Mac LAN IP'sini yaz |
| Mobil "server error 404" pattern oluştururken | Aynı sebep: `API_BASE` ulaşılamıyor. `curl <API_BASE>/health` ile test et |
| Mobil "fal.ai upload failed: Forbidden" | `.env`'deki `FALL_API_KEY` geçersiz. Yeni key al: https://fal.ai/dashboard/keys |
| `FALL_API_KEY not set` | Proje kökünde `.env` dosyası eksik veya yanlış isim |
| Expo "Something went wrong" | `npx expo start -c` ile metro cache'i temizle |
| Expo "Starting project at..." sonrası takılı | macOS Tahoe'da watchman yoksa olur. `brew install watchman` |
| `expo` kök dizinden çağrılınca `ConfigError: module 'expo' not installed` | `npx expo start`'ı **mobile/** klasörü içinden çalıştır, projenin kökünden değil |
