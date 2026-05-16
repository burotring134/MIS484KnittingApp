# 2026 AI-Native Design & Experience Constitution (Likit Cam & SDD)

Bu dokümanı Threadia'nın tüm UI/UX kararlarının temel anayasası olarak kullan.
Yeni bir bileşen, ekran ya da etkileşim eklerken aşağıdaki beş bölümün
hepsiyle uyumlu olduğundan emin ol.

## 1. Görsel Dil: Likit Cam (Liquid Glass) & Materyal Ekspresyonu
- **Materyal:** Tüm paneller %15 saydamlıkta, arkasındaki içeriği kıran
  (refraction) ve yansıtan buzlu cam (frosted glass) etkisine sahip olmalıdır.
- **Kenarlar:** Yumuşak, hap şeklinde (pill-shaped) köşeler. Border-radius
  için statik değer yerine `--radius-expressive` token'ı kullanılmalı.
- **İkonografi:** Apple iOS 26 standartlarında, çok katmanlı ve ışığa duyarlı
  ikonlar.
- **Navigasyon:** Floating (yüzen) merkezlenmiş sekme çubukları. İçerik
  kaydırıldığında küçülen, dokunulduğunda genişleyen dinamik yapılar.

## 2. AI-Native Etkileşim Paradigmaları
- **Streaming UI:** AI yanıtları asla blok halinde gelmemeli; daktilo efekti
  ile stream edilmeli.
- **Görsel Durumlar:**
  - *Düşünme:* Yanıp sönen imleç yerine, içeriğin geleceği alanı simüle eden
    "Shimmer Animation" (parıltı efekti).
  - *Güven:* Kritik AI çıktılarının yanında `%XX Güven Skoru` etiketi
    (Confidence Indicator).
- **VBI (Voice/Visual/Gesture):** Girdiler sadece metin değil; sürükle-bırak,
  ses ve jest uyumlu multimodal yapıda olmalı.

## 3. UX Psikolojisi ve Yasalar
- **Hick Yasası:** Karar yorgunluğunu önlemek için seçenekleri gruplandır.
- **Tesler Yasası:** Karmaşıklığı AI asistanı üstlenmeli; kullanıcıya sadece
  en yalın çıktı sunulmalı.
- **Fitts Yasası:** Ana CTA (Call to Action) butonları parmak/imleç
  menzilinde, büyük ve yüksek kontrastlı olmalı.
- **Kademeli Açıklama (Progressive Disclosure):** Detaylar sadece ihtiyaç
  anında (on-demand) gösterilmeli.

## 4. Teknik Disiplin (SDD & Vibecoding)
- **Auto-Layout:** Tüm bileşenler %100 esnek ve duyarlı (responsive)
  olmalıdır.
- **Semantik Tokenlar:** Renkler `#hex` yerine `--surface-primary`,
  `--accent-liquid` gibi isimlendirilmelidir.
- **Erişilebilirlik:** WCAG 3.0 standartlarında, yüksek kontrastlı ve ekran
  okuyucu (MX - Machine Experience) uyumlu kod yapısı.

## 5. Hareket Fiziği (Motion Physics)
- Animasyonlar statik "easing" yerine fizik tabanlı (yaylanma, momentum)
  olmalıdır.
- Bir öğe silindiğinde çevresindekiler bu boşluğa doğal bir ivmeyle akmalıdır.
