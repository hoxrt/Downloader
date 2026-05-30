/**
 * utils/stats.js
 * نظام تتبع الإحصائيات — يحفظ في ملف JSON محلي
 */

const fs = require("fs");
const path = require("path");

const STATS_FILE = path.join(__dirname, "../data/stats.json");

// تأكد إن مجلد data موجود
function ensureDir() {
  const dir = path.join(__dirname, "../data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// قراءة الإحصائيات
function readStats() {
  ensureDir();
  try {
    if (!fs.existsSync(STATS_FILE)) return defaultStats();
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch {
    return defaultStats();
  }
}

function defaultStats() {
  return {
    totalDownloads: 0,
    totalMP4: 0,
    totalMP3: 0,
    recentDownloads: [],
    dailyStats: {},
  };
}

// حفظ الإحصائيات
function writeStats(data) {
  ensureDir();
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

// تسجيل تحميل جديد
function recordDownload({ title, platform, type, quality, filesize }) {
  const stats = readStats();

  stats.totalDownloads++;
  if (type === "audio") stats.totalMP3++;
  else stats.totalMP4++;

  // إضافة للقائمة الأخيرة (آخر 50)
  stats.recentDownloads.unshift({
    id: Date.now(),
    title: title || "Unknown",
    platform: platform || "unknown",
    type: type || "video",
    quality: quality || "best",
    filesize: filesize || 0,
    time: new Date().toISOString(),
  });
  stats.recentDownloads = stats.recentDownloads.slice(0, 50);

  // إحصائيات يومية
  const today = new Date().toISOString().split("T")[0];
  if (!stats.dailyStats[today]) stats.dailyStats[today] = 0;
  stats.dailyStats[today]++;

  // احتفظ بآخر 30 يوم فقط
  const days = Object.keys(stats.dailyStats).sort().slice(-30);
  const filtered = {};
  days.forEach((d) => (filtered[d] = stats.dailyStats[d]));
  stats.dailyStats = filtered;

  writeStats(stats);
  return stats;
}

// جلب الإحصائيات
function getStats() {
  return readStats();
}

module.exports = { recordDownload, getStats };
