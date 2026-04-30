# Mobile (Expo)

React Native + Expo. **Expo Go** uygulamasıyla telefonunda QR kod tarayarak çalışır. Aynı Wi-Fi'de Mac'in LAN IP'sini kullanır.

## Ön gereksinimler

- Node.js 18+
- Telefonda **Expo Go** kurulu (App Store / Play Store)
- Telefon ve Mac aynı Wi-Fi'da olmalı
- Backend çalışıyor olmalı (bkz. [backend.md](backend.md))
- Mac'te `watchman` (macOS Tahoe için zorunlu): `brew install watchman`

## İlk kurulum

```bash
cd ~/Desktop/threadia/mobile
npm install
```

## API_BASE ayarı (her ilk kurulumda + Wi-Fi değişince)

Telefon `localhost`'a ulaşamaz. Mac'in LAN IP'sini öğren:

```bash
ipconfig getifaddr en0     # örn. 192.168.1.33
```

`mobile/config.js` aç:

```js
export const API_BASE = 'http://192.168.1.33:5001';
```

Farklı ağdaysan veya NAT problemi varsa **ngrok**:

```bash
ngrok http 5001
```

Çıkan https URL'ini `API_BASE` olarak yaz.

## Çalıştırma

```bash
cd ~/Desktop/threadia/mobile && npx expo start
```

Cache problemi varsa: `npx expo start -c`

QR kod görünecek. **Expo Go**'yu telefondan aç, kameray ı QR'a tut.
- iOS simulator için terminalde `i`
- Android emulator için `a`

## Doğrulama

1. Expo Go'da Threadia açılmalı
2. **Koleksiyon** sekmesinde 9 hazır şablon görünmeli (yüklenmiyorsa API_BASE yanlış)
3. **Atölye**'de proje yoksa "Henüz proje yok" mesajı çıkmalı
4. Ana ekranda fotoğraf çek → zorluk seç → pattern üret akışı çalışmalı

## Klasör yapısı

```
mobile/
├── App.js                  # ana state machine, ekranlar arası geçiş
├── index.js
├── config.js               # API_BASE — tek konfig noktası
├── app.json                # Expo manifest
├── babel.config.js
├── package.json
├── screens/
│   ├── WelcomeScreen.js
│   ├── HomeScreen.js
│   ├── DifficultyScreen.js
│   ├── LoadingScreen.js
│   ├── ApprovalScreen.js
│   ├── WorkshopScreen.js       # kaydedilmiş projelerin listesi
│   ├── ProjectDetailScreen.js  # proje detayı, takip modu, PDF export
│   └── CollectionScreen.js     # backend'den hazır şablonlar
├── components/
│   ├── ImageUploader.js
│   ├── PatternGrid.js
│   ├── ColorLegend.js
│   └── LoadingSpinner.js
└── utils/
    ├── theme.js            # renkler + DIFFICULTIES preset listesi
    └── storage.js          # AsyncStorage proje CRUD
```

## Sık hatalar

| Belirti | Sebep / Çözüm |
|---------|---------------|
| Koleksiyon yüklenmiyor / "Bağlantı hatası" | `API_BASE` yanlış veya Mac IP değişti. `ipconfig getifaddr en0` ile yeniden bak. `curl <API_BASE>/health` test et |
| "Network request failed" | Telefon farklı Wi-Fi'da. Aynı ağa bağlan veya ngrok kullan |
| `Cannot find module 'babel-preset-expo'` veya benzeri | `node_modules` yarım yüklenmiş. `rm -rf node_modules package-lock.json && npm install`, sonra `npx expo install --fix` |
| Expo "Starting project at..." sonrası takılı | `watchman` yok. `brew install watchman` |
| Expo Go'da app açılmıyor | Telefon Mac'le aynı subnet'te değil. Hotspot/router ayarına bak |
| Pattern üretiminde "fal.ai upload failed" | Backend'in `.env`'sindeki `FALL_API_KEY` geçersiz |
| Atölyeden pattern açınca donuyor | Eski preset'lerle (80×80) kaydedilmiş projeler ağır olabilir. Yeniden üret veya zoom'u küçült |

## Önemli: tracking modu

ProjectDetailScreen'de "Takip modu" açıkken sayfa scroll'u kapanır — hücreye dokunarak işlersin. Tekrar dokunmak işareti kaldırır. Modu kapatınca scroll geri gelir.
