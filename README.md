# 🎬 VideoVault — Premium Video Downloader

A startup-quality web app for downloading videos from YouTube, X (Twitter), and TikTok.
Built with Node.js + Express backend and a glassmorphism dark-mode frontend.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **yt-dlp** — The download engine

### 1. Install yt-dlp

```bash
# macOS (Homebrew)
brew install yt-dlp

# Linux / Ubuntu
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Windows (winget)
winget install yt-dlp

# Or via pip (any OS)
pip install yt-dlp
```

### 2. Install Node dependencies

```bash
cd video-downloader
npm install
```

### 3. Start the server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

### 4. Open in browser

Visit: **http://localhost:3000**

---

## 📁 Project Structure

```
video-downloader/
├── server.js              # Express entry point
├── package.json
├── routes/
│   └── video.js           # /api/video endpoints (info, download, health)
├── utils/
│   └── urlValidator.js    # URL validation & platform detection
└── public/
    └── index.html         # Full frontend (HTML + CSS + JS)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/video/info` | Fetch video metadata + available qualities |
| `GET`  | `/api/video/download` | Stream video/audio download |
| `GET`  | `/api/video/health` | Check yt-dlp installation status |

### POST `/api/video/info`

```json
// Request body
{ "url": "https://youtube.com/watch?v=..." }

// Response
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": "3:45",
  "uploader": "Channel Name",
  "viewCount": "1,234,567",
  "platform": { "key": "youtube", "name": "YouTube", "icon": "fab fa-youtube", "color": "#FF0000" },
  "qualities": [
    { "formatId": "137", "quality": "1080p", "ext": "mp4", "filesizeFormatted": "45.3 MB" },
    { "formatId": "22", "quality": "720p", "ext": "mp4", "filesizeFormatted": "28.1 MB" }
  ],
  "audioAvailable": true
}
```

### GET `/api/video/download`

Query params:
- `url` — Video URL (required)
- `format` — Format ID from info endpoint (optional, defaults to best)
- `type` — `"video"` or `"audio"` (required)

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Server port |

Set via environment: `PORT=8080 npm start`

---

## 🌐 Deployment

### Render / Railway / Fly.io

1. Push to GitHub
2. Connect repo to platform
3. Set `npm start` as the start command
4. **Ensure yt-dlp is installed** — add a `build.sh`:

```bash
#!/bin/bash
npm install
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
```

### Docker

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip ffmpeg && pip install yt-dlp --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## ⚠️ Legal Notice

This tool is intended for **personal use only**. Only download content you have rights to download. Respect the terms of service of YouTube, X (Twitter), TikTok, and all other platforms. The developer assumes no liability for misuse.

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Glassmorphism), Vanilla JS |
| Backend | Node.js, Express.js |
| Downloader | yt-dlp (via child_process) |
| Fonts | Syne + DM Sans (Google Fonts) |
| Icons | Font Awesome 6 |
| Security | Helmet, express-rate-limit, CORS |
