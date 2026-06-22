const express = require("express");
const router = express.Router();
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { validateUrl, PLATFORMS } = require("../utils/urlValidator");
const { recordDownload, getStats } = require("../utils/stats");

const execAsync = promisify(exec);

/* ════════════════════════════════════════
   PYTHON COMMAND DETECTION
   Railway/Linux uses python3, Windows often uses python.
   Detect once at startup.
════════════════════════════════════════ */
let PYTHON = "python3";
(async () => {
  try {
    await execAsync("python3 --version");
    PYTHON = "python3";
  } catch {
    try {
      await execAsync("python --version");
      PYTHON = "python";
    } catch {
      console.error("⚠️  Neither python3 nor python found!");
    }
  }
  console.log(`[VideoVault] Using Python command: ${PYTHON}`);
})();

/* ════════════════════════════════════════
   COOKIES RESOLUTION
   - Local dev: reads cookies.txt from project root
   - Railway/production: reads from YT_COOKIES env variable
     (write the contents into a temp file at startup)
════════════════════════════════════════ */
const COOKIES_PATH = path.join(__dirname, "../cookies.txt");

function resolveCookiesPath() {
  // 1) Local file already present?
  if (fs.existsSync(COOKIES_PATH)) return COOKIES_PATH;

  // 2) Env variable? Write to a temp file once.
  if (process.env.YT_COOKIES) {
    try {
      const tmpCookies = path.join(os.tmpdir(), "vv_cookies.txt");
      if (!fs.existsSync(tmpCookies)) {
        fs.writeFileSync(tmpCookies, process.env.YT_COOKIES, "utf8");
      }
      return tmpCookies;
    } catch (e) {
      console.error("Failed to write cookies from env:", e.message);
    }
  }
  return null;
}

function getCookiesArg() {
  const p = resolveCookiesPath();
  return p ? `--cookies "${p}"` : "";
}

async function tikwmFetch(url) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ url });
    const options = {
      hostname: "www.tikwm.com",
      port: 443,
      path: "/api/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "VideoVault/1.0",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = require("https").request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);

          // Check for success (code: 0)
          if (json.code === 0 && json.data) {
            // Try different video URL sources in order of preference
            const videoUrl =
              json.data.play ||
              json.data.wmplay ||
              json.data.download?.noWatermark;

            if (!videoUrl) {
              throw new Error("No video URL found in TikTok API response");
            }

            resolve({
              url: videoUrl,
              title: json.data.title || "TikTok Video",
              thumbnail:
                json.data.cover ||
                json.data.origin_cover ||
                json.data.ai_dynamic_cover,
              author: json.data.author?.nickname || "Unknown",
            });
          } else {
            reject(new Error(json.msg || "TikTok video could not be fetched"));
          }
        } catch (e) {
          console.error("TikTok parse error:", e.message);
          reject(new Error(`TikTok parse error: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("TikTok fetch timeout"));
    });
    req.write(body);
    req.end();
  });
}

async function ytDlpInfo(url) {
  const cookiesArg = getCookiesArg();
  const cmd = `${PYTHON} -m yt_dlp ${cookiesArg} --remote-components ejs:github --dump-json --no-playlist --no-warnings "${url}"`;
  const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
  const firstLine = stdout.trim().split("\n")[0];
  return JSON.parse(firstLine);
}

function extractQualities(info) {
  const formats = info.formats || [];
  const seen = new Map();

  for (const f of formats) {
    if (!f.vcodec || f.vcodec === "none") continue;
    if (!f.height) continue;

    const key = `${f.height}`;
    const tbr = f.tbr || 0;

    if (!seen.has(key) || tbr > seen.get(key).tbr) {
      // Build format with audio fallback if needed
      const formatId =
        f.acodec && f.acodec !== "none"
          ? f.format_id
          : `${f.format_id}+bestaudio[ext=m4a]/${f.format_id}+bestaudio`;

      seen.set(key, {
        formatId,
        quality: `${f.height}p`,
        ext: "mp4",
        filesize: f.filesize || f.filesize_approx || null,
        fps: f.fps || null,
        vcodec: f.vcodec,
        acodec: f.acodec,
        tbr,
      });
    }
  }

  return [...seen.values()]
    .sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))
    .slice(0, 6);
}

function formatBytes(bytes) {
  if (!bytes) return null;
  const units = ["B", "KB", "MB", "GB"];
  let i = 0,
    size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds) {
  if (!seconds) return "Unknown";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

router.post("/info", async (req, res) => {
  try {
    const { url } = req.body;
    const validation = validateUrl(url);
    if (!validation.valid)
      return res.status(400).json({ error: validation.error });

    const platform = PLATFORMS[validation.platform];
    let info;
    try {
      info = await ytDlpInfo(url.trim());
    } catch (err) {
      console.error("yt-dlp error:", err.message);

      // For TikTok — try tikwm API fallback
      const isTikTok = url.includes("tiktok.com");
      if (isTikTok) {
        try {
          console.log("yt-dlp failed on TikTok — trying tikwm fallback...");
          const tikwmResult = await tikwmFetch(url.trim());

          // Return simplified response using tikwm data
          return res.json({
            title: tikwmResult.title,
            thumbnail: tikwmResult.thumbnail,
            duration: "Unknown",
            durationSeconds: 0,
            uploader: tikwmResult.author,
            viewCount: null,
            platform: {
              key: "tiktok",
              name: "TikTok",
              icon: "fab fa-tiktok",
              color: "#25F4EE",
            },
            qualities: [
              {
                formatId: "tikwm",
                quality: "Best",
                ext: "mp4",
                filesize: null,
                filesizeFormatted: null,
                tikwmUrl: tikwmResult.url,
              },
            ],
            audioAvailable: false,
            tikwmMode: true,
          });
        } catch (tikwmErr) {
          console.error("TikTok fallback failed:", tikwmErr.message);
        }
      }

      if (err.message.includes("Private video"))
        return res.status(400).json({ error: "This video is private." });
      if (err.message.includes("not available"))
        return res
          .status(400)
          .json({ error: "Video is not available in your region." });
      if (err.message.includes("age"))
        return res
          .status(400)
          .json({ error: "Age-restricted content cannot be downloaded." });
      return res
        .status(400)
        .json({
          error:
            "Could not fetch video info. The URL may be invalid or the video is unavailable.",
        });
    }

    const qualities = extractQualities(info);
    res.json({
      title: info.title || "Unknown Title",
      thumbnail:
        info.thumbnail ||
        (info.thumbnails && info.thumbnails[info.thumbnails.length - 1]?.url) ||
        null,
      duration: formatDuration(info.duration),
      durationSeconds: info.duration || 0,
      uploader: info.uploader || info.channel || "Unknown",
      viewCount: info.view_count ? info.view_count.toLocaleString() : null,
      platform: {
        key: validation.platform,
        name: platform.name,
        icon: platform.icon,
        color: platform.color,
      },
      qualities: qualities.map((q) => ({
        ...q,
        filesizeFormatted: formatBytes(q.filesize),
      })),
      audioAvailable: true,
    });
  } catch (err) {
    console.error("Info endpoint error:", err);
    res.status(500).json({ error: "Failed to retrieve video information." });
  }
});

// ── SSE Progress endpoint ─────────────────────────────────
// GET /api/video/progress?id=xxx  — streams yt-dlp progress events
const progressClients = new Map();

router.get("/progress", (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).end();

  // Server-Sent Events headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  progressClients.set(id, res);

  req.on("close", () => progressClients.delete(id));
});

function sendProgress(id, data) {
  const client = progressClients.get(id);
  if (client) client.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── Download endpoint ──────────────────────────────────────
router.get("/download", async (req, res) => {
  let tmpDir = null;

  try {
    const { url, type, id, tikwmUrl } = req.query;
    // Decode format manually — encodeURIComponent preserves + signs which yt-dlp needs
    const format = req.query.format
      ? decodeURIComponent(req.query.format)
      : null;
    const validation = validateUrl(url);
    if (!validation.valid)
      return res.status(400).json({ error: validation.error });

    // ── TikTok direct download via tikwm ──
    if (tikwmUrl) {
      sendProgress(id, {
        stage: "start",
        pct: 10,
        status: "Connecting via tikwm…",
      });
      try {
        const tikwmRes = await new Promise((resolve, reject) => {
          const parsedUrl = new URL(tikwmUrl);
          const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: { "User-Agent": "VideoVault/1.0" },
          };
          const req2 = require("https").request(options, resolve);
          req2.on("error", reject);
          req2.setTimeout(30000, () => {
            req2.destroy();
            reject(new Error("timeout"));
          });
          req2.end();
        });

        const totalBytes = parseInt(tikwmRes.headers["content-length"] || "0");
        let downloadedBytes = 0;

        sendProgress(id, {
          stage: "downloading",
          pct: 20,
          status: "Downloading…",
        });

        const tmpId = crypto.randomBytes(8).toString("hex");
        tmpDir = path.join(os.tmpdir(), `vv_${tmpId}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        const tmpFile = path.join(tmpDir, "video.mp4");
        const writeStream = fs.createWriteStream(tmpFile);

        await new Promise((resolve, reject) => {
          tikwmRes.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const pct = Math.min(
                95,
                Math.round((downloadedBytes / totalBytes) * 90) + 5,
              );
              sendProgress(id, {
                stage: "downloading",
                pct,
                size: `${(totalBytes / 1024 / 1024).toFixed(1)}MB`,
              });
            }
          });
          tikwmRes.pipe(writeStream);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
          tikwmRes.on("error", reject);
        });

        sendProgress(id, { stage: "done", pct: 100, status: "Complete!" });

        const stat = fs.statSync(tmpFile);

        try {
          recordDownload({
            title: "tiktok_video",
            platform: "tiktok",
            type: "video",
            quality: "best",
            filesize: stat.size,
          });
        } catch {}

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="tiktok_video.mp4"`,
        );
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Access-Control-Expose-Headers", "Content-Length");

        const readStream = fs.createReadStream(tmpFile);
        readStream.pipe(res);
        readStream.on("close", () =>
          fs.rm(tmpDir, { recursive: true, force: true }, () => {}),
        );
        return;
      } catch (tikwmErr) {
        console.error("TikTok download error:", tikwmErr.message);
        if (id) sendProgress(id, { stage: "error", pct: 0, status: "Failed" });
        if (tmpDir) fs.rm(tmpDir, { recursive: true, force: true }, () => {});
        return res
          .status(500)
          .json({ error: "Download failed. Please try again." });
      }
    }

    const isTwitter = url.includes("twitter.com") || url.includes("x.com");
    const isTikTok = url.includes("tiktok.com");

    let formatSelector, ext, contentType;

    if (type === "audio") {
      formatSelector = "bestaudio/best";
      ext = "mp3";
      contentType = "audio/mpeg";
    } else {
      if (format) {
        // Use the format as provided (already has +bestaudio fallbacks if needed)
        formatSelector = format;
      } else {
        // Default: best video + best audio
        formatSelector =
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best";
      }
      ext = "mp4";
      contentType = "video/mp4";
    }

    let filename = "video";
    try {
      const cookiesArg2 = getCookiesArg();
      const { stdout } = await execAsync(
        `${PYTHON} -m yt_dlp ${cookiesArg2} --remote-components ejs:github --get-title --no-warnings "${url}"`,
        { timeout: 15000 },
      );
      // Remove only filesystem-unsafe characters, keep Arabic & other languages
      filename =
        stdout
          .trim()
          .replace(/[\\/:*?"<>|]/g, "") // illegal filename chars
          .replace(/\s+/g, "_")
          .substring(0, 80) || "video";
    } catch {}

    const tmpId = crypto.randomBytes(8).toString("hex");
    tmpDir = path.join(os.tmpdir(), `vv_${tmpId}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const outputTemplate = path.join(tmpDir, `video.%(ext)s`);
    const cookiesFilePath = resolveCookiesPath();
    const args = [
      "--no-playlist",
      "--progress",
      "--newline",
      "--progress-template",
      "%(progress._percent_str)s of %(progress._total_bytes_str)s at %(progress._speed_str)s ETA %(progress._eta_str)s",
      "--remote-components",
      "ejs:github",
      "-f",
      formatSelector,
      "-o",
      outputTemplate,
    ];
    if (cookiesFilePath) args.unshift("--cookies", cookiesFilePath);

    if (!isTwitter && !isTikTok && type !== "audio")
      args.push("--merge-output-format", "mp4");
    if (type === "audio") args.push("--extract-audio", "--audio-format", "mp3");
    args.push(url);

    sendProgress(id, { stage: "start", pct: 2, status: "Connecting…" });

    await new Promise((resolve, reject) => {
      // yt-dlp يكتب التقدم على stderr — نقرأه من هناك
      const ytDlp = spawn(PYTHON, ["-m", "yt_dlp", ...args]);

      function parseLine(line) {
        const raw = line.trim();
        if (!raw) return;

        // Template format: "45.2% of 45.33MiB at 2.50MiB/s ETA 00:12"
        const tmpl = raw.match(
          /^([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\S]+)\s+ETA\s+([\d:]+)/,
        );
        if (tmpl) {
          const pct = Math.min(95, Math.round(parseFloat(tmpl[1])));
          sendProgress(id, {
            stage: "downloading",
            pct,
            size: tmpl[2],
            speed: tmpl[3],
            eta: tmpl[4],
          });
          return;
        }

        // Fallback: standard yt-dlp format
        const std = raw.match(
          /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)(?:.*?at\s+([\S]+))?(?:.*?ETA\s+([\d:]+))?/,
        );
        if (std) {
          const pct = Math.min(95, Math.round(parseFloat(std[1])));
          sendProgress(id, {
            stage: "downloading",
            pct,
            size: std[2] || null,
            speed: std[3] || null,
            eta: std[4] || null,
          });
          return;
        }

        if (raw.includes("[Merger]") || raw.includes("Merging formats")) {
          sendProgress(id, { stage: "merging", pct: 96 });
        }
        if (raw.includes("[ExtractAudio]")) {
          sendProgress(id, { stage: "audio", pct: 96 });
        }
      }

      // yt-dlp يكتب التقدم على stderr
      ytDlp.stderr.on("data", (d) => {
        d.toString()
          .split("\n")
          .forEach((line) => {
            const t = line.trim();
            // Only log errors/warnings, not every progress line
            if (t.includes("ERROR") || t.includes("WARNING"))
              console.log("yt-dlp:", t);
            parseLine(line);
          });
      });

      // بعض الإصدارات تكتب على stdout
      ytDlp.stdout.on("data", (d) => {
        d.toString()
          .split("\n")
          .forEach((line) => parseLine(line));
      });

      ytDlp.on("error", reject);
      ytDlp.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`yt-dlp exited ${code}`)),
      );
    });

    sendProgress(id, { stage: "saving", pct: 98, status: "Saving file…" });

    const files = fs.readdirSync(tmpDir);
    if (files.length === 0) throw new Error("Output file not found");

    const finalFile = path.join(tmpDir, files[0]);
    const stat = fs.statSync(finalFile);
    const realExt = path.extname(files[0]).slice(1) || ext;

    sendProgress(id, { stage: "done", pct: 100, status: "Complete!" });

    // تسجيل التحميل في الإحصائيات
    const validation2 = validateUrl(url);
    try {
      recordDownload({
        title: filename.replace(/_/g, " "),
        platform: validation2.platform || "unknown",
        type: type || "video",
        quality: format || "best",
        filesize: stat.size,
      });
    } catch {}

    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Length, Content-Disposition",
    );
    // RFC 5987: filename* supports UTF-8 (Arabic etc.), with ASCII fallback for old browsers
    const fullName = `${filename}.${realExt}`;
    const asciiName = fullName.replace(/[^\x20-\x7E]/g, "_"); // fallback
    const encodedName = encodeURIComponent(fullName);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);

    const readStream = fs.createReadStream(finalFile);
    readStream.pipe(res);
    readStream.on("close", () =>
      fs.rm(tmpDir, { recursive: true, force: true }, () => {}),
    );
  } catch (err) {
    console.error("Download error:", err.message);
    if (req.query.id)
      sendProgress(req.query.id, { stage: "error", pct: 0, status: "Failed" });
    if (tmpDir) fs.rm(tmpDir, { recursive: true, force: true }, () => {});
    if (!res.headersSent)
      res.status(500).json({ error: "Download failed. Please try again." });
  }
});

router.get("/health", async (req, res) => {
  try {
    const { stdout } = await execAsync(`${PYTHON} -m yt_dlp --version`);
    res.json({ status: "ok", ytDlpVersion: stdout.trim() });
  } catch {
    res
      .status(503)
      .json({ status: "error", message: "yt-dlp is not installed." });
  }
});

// إحصائية عامة (بدون بيانات حساسة) لعرضها في الواجهة الرئيسية
router.get("/public-stats", (req, res) => {
  try {
    const stats = getStats();
    res.json({
      totalDownloads: stats.totalDownloads || 0,
      totalMP4: stats.totalMP4 || 0,
      totalMP3: stats.totalMP3 || 0,
    });
  } catch {
    res.json({ totalDownloads: 0, totalMP4: 0, totalMP3: 0 });
  }
});

module.exports = router;
