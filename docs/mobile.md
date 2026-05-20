# Mobile (Expo)

React Native + Expo. **Expo Go** uygulamasıyla telefonunda QR kod tarayarak çalışır. Aynı Wi-Fi'de Mac'in LAN IP'sini kullanır.

## Ön gereksinimler

- Node.js 18+
- Telefonda **Expo Go** kurulu (App Store / Play Store)
- Telefon ve Mac aynı Wi-Fi'da olmalı
- Backend çalışıyor olmalı (bkz. [backend.md](backend.md))
- Mac'te `watchman` (macOS için zorunlu): `brew install watchman`

## İlk kurulum

```bash
cd ~/Desktop/threadia/mobile
npm install
```

## API_BASE ayarı (her ilk kurulumda + Wi-Fi değişince)

Telefon `localhost`'a direkt ulaşamaz. Local test için Mac'inizin LAN IP'sini öğrenin:

```bash
ipconfig getifaddr en0     # örn. 192.168.1.33
```

`mobile/config.js` dosyasını açıp `API_BASE` değerini yerel IP'niz ile değiştirin:

```js
export const API_BASE = 'http://192.168.1.33:5001';
```

Farklı ağlardaysanız veya NAT/Wi-Fi yalıtımı probleminiz varsa **ngrok** kullanarak tünel açabilirsiniz:

```bash
ngrok http 5001
```

Çıkan https URL'ini `API_BASE` olarak yazın.

## Çalıştırma

```bash
cd ~/Desktop/threadia/mobile
npx expo start
```

Cache temizleyerek sıfırdan başlatmak için: `npx expo start -c`

Terminalde QR kod görünecektir. **Expo Go** uygulamasını açıp bu QR kodu tarayarak uygulamayı telefonunuzda test edebilirsiniz:
- iOS simulator için terminalde `i` tuşuna basın.
- Android emulator için terminalde `a` tuşuna basın.

## Doğrulama

1. Expo Go'da Threadia açılmalı.
2. **Koleksiyon** sekmesinde 9 hazır şablon görünmeli (yüklenmiyorsa API_BASE yanlıştır).
3. **Atölye**'de proje yoksa "Atölyen boş" mesajı çıkmalı.
4. Ana ekranda Fotoğraf Çek / Galeriden Seç → zorluk seç → pattern üret akışı çalışmalı.

## Klasör yapısı

```
mobile/
├── App.js                  # Ana state machine, ekranlar arası geçiş ve router
├── index.js
├── config.js               # API_BASE — tek konfig noktası (varsayılan: production API)
├── app.json                # Expo manifest
├── babel.config.js
├── package.json
├── screens/
│   ├── WelcomeScreen.js       # Tanıtım slaytları, haptik deneme kartı
│   ├── HomeScreen.js          # Fotoğraf seçimi, devam eden proje kartı, atölye/koleksiyon yönlendirmesi
│   ├── DifficultyScreen.js    # Easy/Medium/Hard zorluk seçimi ve k-means detay ayarları
│   ├── LoadingScreen.js       # Adım adım AI görsel üretim ve eğlenceli kanaviçe tarihçesi ekranı
│   ├── ApprovalScreen.js      # Üretilen şemanın önizlemesi, onaylama (adlandırma) ve silme işlemleri
│   ├── WorkshopScreen.js       # Atölye, kayıtlı projelerin listesi, sıralama/filtreleme ve proje menüsü
│   ├── ProjectDetailScreen.js  # İnteraktif kanaviçe tuvali, odaklanma modu, takip modu ve PDF ihracatı
│   ├── CollectionScreen.js     # Hazır şablon koleksiyonu ve favorileme işlemleri
│   └── SettingsScreen.js       # Haptik ayarları, veri sıfırlama, JSON dışa aktarma ve hakkında alanı
├── components/
│   ├── ColorLegend.js          # DMC İplik rengi arama, seçme ve detay kartı
│   ├── CompletionCelebration.js# Proje %100 bittiğinde açılan tebrik ve çerçeveleme önerisi ekranı
│   ├── ErrorBanner.js          # API hatalarını şık şekilde gösteren ve yeniden deneme sunan banner
│   ├── Glare.js                # Kartların üzerinde parıldama (sweep) efekti oluşturan AI-native bileşen
│   ├── Glass.js                # Likit Cam estetiği sunan buzlu panel (frosted glass) sarmalayıcısı
│   ├── MilestoneCelebration.js # %25, %50, %75 gibi ara aşamalarda beliren tebrik kartları
│   ├── PermissionPrimer.js     # Gizlilik uyumlu kamera/galeri izin bilgilendirme modalı
│   ├── Shimmer.js              # Yanıp sönen yükleme (düşünme) parıltı efekti
│   └── Snackbar.js             # Alt kısımdan çıkan geçici bilgilendirme kutusu
└── utils/
    ├── theme.js            # IBM Plex Sans tanımları, pastel renk paleti semantik tokenları, spring yay fiziği
    ├── storage.js          # AsyncStorage üzerinde proje CRUD, favoriler ve backend ile otomatik REST senkronizasyonu
    ├── errors.js           # API hatalarını kullanıcı dostu açıklamalara çeviren yardımcı dosya
    ├── haptics.js          # Dokunsal geri bildirim (titreşim) tetikleyicileri
    ├── i18n.js             # İki dilli (TR/EN) tüm metin kayıt defteri
    └── pdf.js              # Mobil üzerinden şemayı DMC listesiyle PDF olarak dışa aktaran motor
```

## Önemli: Takip ve Odaklanma Modları

* **Takip Modu:** `ProjectDetailScreen` üzerinde sürükleyerek (drag-to-mark) çoklu hücreyi işlenmiş olarak işaretlemenizi sağlar. Bu mod açıkken kaydırma (scroll) geçici olarak devre dışı kalır. Hücreye tekrar dokunulduğunda işaret geri alınır.
* **Odaklanma Modu (Focus Mode):** Sadece seçilen DMC iplik renginin hücrelerini aktif kılar, diğer tüm hücreleri kilitleyerek yanlış işaretlemeyi önler. Karmaşık desenlerde renk renk ilerlemek için mükemmeldir.
