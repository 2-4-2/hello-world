# Profesyonel Discord Müzik Botu (Node.js)

`discord.js v14`, slash komutları, YouTube arama/çalma ve stabil kuyruk yönetimi ile hazırlanmış profesyonel müzik botu.

## Özellikler

- `discord.js v14` + `@discordjs/voice`
- Tam Türkçe slash komut desteği (`/cal`, `/gec`, `/durdur`, `/beklet`, `/devam`, `/kuyruk`)
- Kullanıcı komut verdiğinde otomatik ses kanalına bağlanma
- YouTube URL + şarkı adı ile çalma
- `yt-search` ile YouTube araması
- `play-dl` ile stabil stream alma
- Çoklu şarkı kuyruğu (queue)
- Reconnect mantığı (bağlantı koparsa tekrar bağlanma denemeleri)
- Güçlü hata yönetimi (`try/catch`, `uncaughtException`, `unhandledRejection`)
- Düşük kaynak tüketimi ve büyük sunucular için optimize yapı
- Railway / Render / VPS üzerinde çalıştırmaya uygun
- `.env` + `config.json` desteği

## Dosya Yapısı

```bash
.
├── commands/
│   ├── beklet (pause.js)
│   ├── cal (play.js)
│   ├── kuyruk (queue.js)
│   ├── devam (resume.js)
│   ├── gec (skip.js)
│   └── durdur (stop.js)
├── events/
│   ├── interactionCreate.js
│   └── ready.js
├── utils/
│   ├── logger.js
│   └── musicManager.js
├── config.json
├── .env.example
├── railway.json
├── index.js
└── package.json
```

## Kurulum

1. Dosyaları projeye koy.
2. Paketleri yükle:

```bash
npm install
```

3. `.env.example` dosyasını `.env` olarak kopyala:

```bash
cp .env.example .env
```

4. `.env` içine değerleri gir:

```env
DISCORD_TOKEN=bot_token
CLIENT_ID=discord_application_client_id
GUILD_ID=test_sunucu_id
DEFAULT_VOLUME=0.5
LOG_LEVEL=info
```

> `GUILD_ID` boş bırakılırsa komutlar global yüklenir (yayılması daha uzun sürebilir).

## Çalıştırma

Tek komutla:

```bash
npm install && node .
```

veya

```bash
npm start
```

## Komutlar (Tam Türkçe)

- `/cal sorgu:<youtube link veya şarkı adı>`
- `/gec`
- `/durdur`
- `/beklet`
- `/devam`
- `/kuyruk`

## Railway Deploy

1. Bu repoyu GitHub'a gönder.
2. Railway'de **New Project > Deploy from GitHub Repo** seç.
3. Projeye aşağıdaki Environment Variable değerlerini ekle:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID` (opsiyonel ama test için önerilir)
   - `DEFAULT_VOLUME` (opsiyonel)
   - `LOG_LEVEL` (opsiyonel)
4. `railway.json` içindeki `startCommand: node .` ile bot otomatik başlar.
5. Railway restart policy açık olduğu için çökme durumunda tekrar ayağa kalkar.

## 7/24 Çalışma Notları

- Railway/Render/VPS üzerinde process sürekli çalışacak şekilde deploy et.
- Uygulama içinde shard reconnect ve voice reconnect mekanizmaları bulunur.
- `pm2` ile çalıştırmak istersen:

```bash
npm i -g pm2
pm2 start index.js --name muzik-bot
pm2 save
```

## Stabilite İpuçları

- Sunucunda FFmpeg ve güncel Node.js (>=18) kullan.
- Çok yoğun kullanımda ses kalitesi/işlemci dengesini `play-dl` seçenekleriyle optimize edebilirsin.
- Log seviyesini prod ortamında `info`, debug için `debug` seç.
