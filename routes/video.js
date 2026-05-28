const express = require("express");
const router = express.Router();
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const { validateUrl, PLATFORMS } = require("../utils/urlValidator");

const execAsync = promisify(exec);

async function ytDlpInfo(url) {
  const cmd = `yt-dlp --dump-json --no-playlist --no-warnings "${url}"`;
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

router.get("/download", async (req, res) => {
  try {
    const { url, format, type } = req.query;
    const validation = validateUrl(url);
    if (!validation.valid)
      return res.status(400).json({ error: validation.error });

    let formatSelector, ext, contentType;
    if (type === "audio") {
      formatSelector = "bestaudio/best";
      ext = "mp3";
      contentType = "audio/mpeg";
    } else {
      formatSelector =
        format || "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
      ext = "mp4";
      contentType = "video/mp4";
    }

    let filename = "video";
    try {
      const { stdout } = await execAsync(
        `yt-dlp --get-title --no-warnings "${url}"`,
        { timeout: 10000 },
      );
      filename = stdout
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 80);
    } catch {}

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.${ext}"`,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Transfer-Encoding", "chunked");

    const args = [
      "--no-warnings",
      "--no-playlist",
      "-f",
      formatSelector,
      "-o",
      "-",
    ];
    if (type === "audio") args.push("--extract-audio", "--audio-format", "mp3");
    args.push(url);

    const ytDlp = spawn("yt-dlp", args);
    ytDlp.stdout.pipe(res);
    ytDlp.stderr.on("data", (data) =>
      console.log("yt-dlp:", data.toString().trim()),
    );
    ytDlp.on("error", (err) => {
      if (!res.headersSent) res.status(500).json({ error: "Download failed." });
    });
    ytDlp.on("close", () => res.end());
    req.on("close", () => ytDlp.kill("SIGTERM"));
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: "Download failed." });
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
