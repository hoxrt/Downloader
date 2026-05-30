# 🎬 VideoVault — Premium Video Downloader

موقع تحميل فيديوهات احترافي يدعم YouTube و X (Twitter) و TikTok.
مبني بـ Node.js + Express في الباك إند وواجهة مستخدم عصرية بتأثيرات Glassmorphism.

---

## ✨ المميزات

- 🎥 تحميل فيديوهات من YouTube و X (Twitter) و TikTok
- 🎵 استخراج MP3 من أي فيديو
- 📊 شريط تقدم حقيقي أثناء التحميل (SSE)
- 🌙 Dark / Light Mode
- 💫 Splash Screen + Particles خلفية متحركة
- 📱 PWA — قابل للتثبيت كتطبيق على الجوال
- 🔔 Push Notifications
- 🕐 تاريخ آخر 5 روابط
- 🔒 حماية بكلمة سر للموقع
- 📈 لوحة تحكم للمدير

---

## 🚀 تشغيل المشروع

### المتطلبات

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **yt-dlp** — محرك التحميل
- **ffmpeg** — لدمج الفيديو والصوت

### 1. تثبيت yt-dlp

```bash
# macOS
brew install yt-dlp

# Linux
pip install yt-dlp

# Windows
pip install yt-dlp
# أو
winget install yt-dlp
```

### 2. تثبيت ffmpeg

```bash
# macOS
brew install ffmpeg

# Windows
winget install ffmpeg
```

### 3. تثبيت الحزم وتشغيل السيرفر

```bash
cd video-downloader
npm install
npm start
```

### 4. افتح المتصفح

```
http://localhost:3000
```

---

## 📁 هيكل المشروع

```
video-downloader/
├── server.js                  # نقطة الدخول الرئيسية
├── package.json
├── data/
│   └── stats.json             # إحصائيات التحميل (يُنشأ تلقائياً)
├── routes/
│   ├── video.js               # API التحميل والمعلومات
│   └── admin.js               # API لوحة التحكم
├── utils/
│   ├── urlValidator.js        # التحقق من الروابط
│   └── stats.js               # نظام الإحصائيات
└── public/
    ├── index.html             # الواجهة الرئيسية
    ├── login.html             # صفحة الدخول
    ├── admin.html             # لوحة التحكم
    ├── admin-login.html       # دخول المدير
    ├── manifest.json          # PWA manifest
    └── sw.js                  # Service Worker
```

---

## 🔌 API Endpoints

| Method | Endpoint              | الوصف                                |
| ------ | --------------------- | ------------------------------------ |
| `POST` | `/api/video/info`     | جلب معلومات الفيديو والجودات المتاحة |
| `GET`  | `/api/video/download` | تحميل الفيديو أو الصوت               |
| `GET`  | `/api/video/progress` | SSE لتقدم التحميل الحقيقي            |
| `GET`  | `/api/video/health`   | التحقق من تثبيت yt-dlp               |
| `POST` | `/api/admin/login`    | تسجيل دخول المدير                    |
| `GET`  | `/api/admin/stats`    | جلب الإحصائيات                       |
| `POST` | `/api/admin/logout`   | تسجيل خروج المدير                    |
| `POST` | `/auth`               | تسجيل دخول الموقع                    |

---

## 🔒 كلمات السر

### كلمة سر الموقع

في `server.js`:

```javascript
const SITE_PASSWORD = process.env.SITE_PASSWORD || "videovault2025";
```

### كلمة سر المدير

في `routes/admin.js`:

```javascript
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin2025";
```

> **نصيحة:** غيّر كلمات السر قبل الرفع على الإنترنت!

---

## 📈 لوحة التحكم

افتح في المتصفح:

```
http://localhost:3000/admin
```

تعرض:

- إجمالي التحميلات
- عدد MP4 و MP3
- تحميلات اليوم
- رسم بياني لآخر 14 يوم
- آخر 50 تحميل مع التفاصيل

---

## 🌐 الرفع على الإنترنت (Railway)

1. ارفع المشروع على GitHub
2. افتح [railway.app](https://railway.app) ووصّل الـ repo
3. أضف متغيرات البيئة:
   ```
   SITE_PASSWORD=كلمة_سرك
   ADMIN_PASSWORD=كلمة_سر_المدير
   PORT=3000
   ```
4. أضف build command:
   ```bash
   pip install yt-dlp && npm install
   ```

---

## ⚙️ متغيرات البيئة

| المتغير          | الافتراضي        | الوصف          |
| ---------------- | ---------------- | -------------- |
| `PORT`           | `3000`           | منفذ السيرفر   |
| `SITE_PASSWORD`  | `videovault2025` | كلمة سر الموقع |
| `ADMIN_PASSWORD` | `admin2025`      | كلمة سر المدير |

---

## 🧰 التقنيات المستخدمة

| الطبقة    | التقنية                                 |
| --------- | --------------------------------------- |
| Frontend  | HTML5, CSS3 (Glassmorphism), Vanilla JS |
| Backend   | Node.js, Express.js                     |
| التحميل   | yt-dlp + ffmpeg                         |
| الخطوط    | Syne + DM Sans (Google Fonts)           |
| الأيقونات | Font Awesome 6                          |
| الأمان    | Helmet, Rate Limiting, Cookie Auth      |
| PWA       | Service Worker, Web Manifest            |
| التقدم    | Server-Sent Events (SSE)                |

---

## ⚠️ تنبيه قانوني

هذه الأداة مخصصة **للاستخدام الشخصي فقط**.
احترم حقوق الملكية الفكرية وشروط الاستخدام لكل منصة.
