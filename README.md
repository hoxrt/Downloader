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
- ⌨️ تأثير Typewriter في العنوان
- 🖱️ Magnetic Cursor (اختياري)
- 🎨 Noise Texture على الخلفية
- 📱 PWA — قابل للتثبيت كتطبيق على الجوال
- 🔔 Push Notifications
- 🕐 تاريخ آخر 5 روابط
- 📦 Download Manager Bubble مع شريط تقدم
- 🎬 Mini Player عند التمرير
- 👁️ Preview الفيديو قبل التحميل
- ⌨️ اختصارات لوحة المفاتيح
- 🔒 حماية بكلمة سر للموقع
- 🛡️ Brute Force Protection مع تضاعف وقت الحظر
- 📈 لوحة تحكم للمدير
- ❌ صفحة 404 مخصصة

---

## 🚀 تشغيل المشروع

### المتطلبات

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **yt-dlp** — محرك التحميل
- **ffmpeg** — لدمج الفيديو والصوت
- **Deno** — لحل YouTube JS challenges

### 1. تثبيت المتطلبات

```bash
# yt-dlp
pip install yt-dlp

# ffmpeg (Windows)
winget install ffmpeg

# Deno (Windows)
irm https://deno.land/install.ps1 | iex
```

### 2. تثبيت الحزم

```bash
cd video-downloader
npm install
```

### 3. إنشاء ملف `.env`

```bash
PORT=3000
SITE_PASSWORD=كلمة_سرك
ADMIN_PASSWORD=كلمة_سر_المدير
```

### 4. تشغيل السيرفر

```bash
npm start
```

### 5. افتح المتصفح

```
http://localhost:3000
```

---

## 📁 هيكل المشروع

```
video-downloader/
├── server.js                  # نقطة الدخول الرئيسية
├── package.json
├── Dockerfile                 # للرفع على Railway
├── nixpacks.toml
├── .env                       # كلمات السر (لا ترفعه على GitHub)
├── .env.example               # مثال على المتغيرات
├── .gitignore
├── cookies.txt                # YouTube cookies (لا ترفعه على GitHub)
├── data/
│   └── stats.json             # إحصائيات التحميل
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
    ├── 404.html               # صفحة 404
    ├── manifest.json          # PWA manifest
    ├── sw.js                  # Service Worker
    ├── css/
    │   └── style.css          # التنسيق
    └── js/
        └── app.js             # JavaScript
```

---

## 🔌 API Endpoints

| Method | Endpoint              | الوصف                        |
| ------ | --------------------- | ---------------------------- |
| `POST` | `/api/video/info`     | جلب معلومات الفيديو والجودات |
| `GET`  | `/api/video/download` | تحميل الفيديو أو الصوت       |
| `GET`  | `/api/video/progress` | SSE لتقدم التحميل الحقيقي    |
| `GET`  | `/api/video/health`   | التحقق من تثبيت yt-dlp       |
| `POST` | `/api/admin/login`    | تسجيل دخول المدير            |
| `GET`  | `/api/admin/stats`    | جلب الإحصائيات               |
| `POST` | `/api/admin/logout`   | تسجيل خروج المدير            |
| `POST` | `/auth`               | تسجيل دخول الموقع            |

---

## 🔒 الأمان

### كلمات السر

في ملف `.env`:

```
SITE_PASSWORD=كلمة_سرك
ADMIN_PASSWORD=كلمة_سر_المدير
```

### Brute Force Protection

- بعد **3 محاولات** خاطئة → حظر مؤقت
- كل مرة تنحظر يتضاعف الوقت:
  - المرة الأولى: 15 دقيقة
  - المرة الثانية: 30 دقيقة
  - المرة الثالثة: 45 دقيقة
  - الحد الأقصى: 24 ساعة

---

## ⌨️ اختصارات لوحة المفاتيح

| الاختصار | الوظيفة                   |
| -------- | ------------------------- |
| `Ctrl+V` | لصق رابط وتحليله تلقائياً |
| `Enter`  | تحليل الرابط              |
| `Escape` | إغلاق النوافذ             |

---

## 📈 لوحة التحكم

```
http://localhost:3000/admin
```

تعرض:

- إجمالي التحميلات
- عدد MP4 و MP3
- تحميلات اليوم
- رسم بياني لآخر 14 يوم
- آخر 50 تحميل

---

## 🌐 الرفع على Railway

1. ارفع على GitHub
2. وصّل الـ repo بـ Railway
3. أضف متغيرات البيئة في Variables:
   ```
   SITE_PASSWORD=كلمة_سرك
   ADMIN_PASSWORD=كلمة_سر_المدير
   ```
4. Railway يكتشف الـ Dockerfile تلقائياً ويثبت yt-dlp و ffmpeg

---

## 🧰 التقنيات

| الطبقة    | التقنية                                       |
| --------- | --------------------------------------------- |
| Frontend  | HTML5, CSS3, Vanilla JS                       |
| Backend   | Node.js, Express.js                           |
| التحميل   | yt-dlp + ffmpeg + Deno                        |
| الخطوط    | Syne + DM Sans                                |
| الأيقونات | Font Awesome 6                                |
| الأمان    | Helmet, Rate Limiting, Brute Force Protection |
| PWA       | Service Worker, Web Manifest                  |
| التقدم    | Server-Sent Events (SSE)                      |
| الاستضافة | Railway (Docker)                              |

---

## ⚠️ تنبيه قانوني

للاستخدام الشخصي فقط. احترم حقوق الملكية الفكرية وشروط الاستخدام لكل منصة.
