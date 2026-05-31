const express = require("express");
const router = express.Router();
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { validateUrl, PLATFORMS } = require("../utils/urlValidator");
const { recordDownload } = require("../utils/stats");

const execAsync = promisify(exec);

async function ytDlpInfo(url) {
  const hasCookies = fs.existsSync(path.join(__dirname, "../cookies.txt"));
  const cookiesArg = hasCookies
    ? `--cookies "${path.join(__dirname, "../cookies.txt")}"`
    : "";
  const cmd = `yt-dlp ${cookiesArg} --remote-components ejs:github --dump-json --no-playlist --no-warnings "${url}"`;
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
    const { url, format, type, id } = req.query;
    const validation = validateUrl(url);
    if (!validation.valid)
      return res.status(400).json({ error: validation.error });

    const isTwitter = url.includes("twitter.com") || url.includes("x.com");
    const isTikTok = url.includes("tiktok.com");

    let formatSelector, ext, contentType;

    if (type === "audio") {
      formatSelector = "bestaudio/best";
      ext = "mp3";
      contentType = "audio/mpeg";
    } else if (isTwitter) {
      formatSelector = "http-2176/http-950/http-632";
      ext = "mp4";
      contentType = "video/mp4";
    } else if (isTikTok) {
      formatSelector = "best[ext=mp4]/best";
      ext = "mp4";
      contentType = "video/mp4";
    } else {
      formatSelector =
        format ||
        "18/best[vcodec!=none][acodec!=none][ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
      ext = "mp4";
      contentType = "video/mp4";
    }

    let filename = "video";
    try {
      const hasCookies2 = fs.existsSync(path.join(__dirname, "../cookies.txt"));
      const cookiesArg2 = hasCookies2
        ? `--cookies "${path.join(__dirname, "../cookies.txt")}"`
        : "";
      const { stdout } = await execAsync(
        `yt-dlp ${cookiesArg2} --remote-components ejs:github --get-title --no-warnings "${url}"`,
        { timeout: 15000 },
      );
      filename = stdout
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 80);
    } catch {}

    const tmpId = crypto.randomBytes(8).toString("hex");
    tmpDir = path.join(os.tmpdir(), `vv_${tmpId}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const outputTemplate = path.join(tmpDir, `video.%(ext)s`);
    const hasCookies = fs.existsSync(path.join(__dirname, "../cookies.txt"));
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
    if (hasCookies)
      args.unshift("--cookies", path.join(__dirname, "../cookies.txt"));

    if (!isTwitter && !isTikTok && type !== "audio")
      args.push("--merge-output-format", "mp4");
    if (type === "audio") args.push("--extract-audio", "--audio-format", "mp3");
    args.push(url);

    sendProgress(id, { stage: "start", pct: 2, status: "Connecting…" });

    await new Promise((resolve, reject) => {
      // yt-dlp يكتب التقدم على stderr — نقرأه من هناك
      const ytDlp = spawn("yt-dlp", args);

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
            console.log("yt-dlp:", line.trim());
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

    res.setHeader("Access-Control-Expose-Headers", "Content-Length");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.${realExt}"`,
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
    const { stdout } = await execAsync("yt-dlp --version");
    res.json({ status: "ok", ytDlpVersion: stdout.trim() });
  } catch {
    res
      .status(503)
      .json({ status: "error", message: "yt-dlp is not installed." });
  }
});

module.exports = router;
