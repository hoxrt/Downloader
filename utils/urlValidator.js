/**
 * utils/urlValidator.js
 * URL validation and platform detection utilities
 */

/**
 * Supported platforms and their URL patterns
 */
const PLATFORMS = {
  youtube: {
    name: "YouTube",
    patterns: [
      /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i,
      /^(https?:\/\/)?(www\.)?youtube\.com\/(embed\/|v\/)/i,
    ],
    icon: "fab fa-youtube",
    color: "#FF0000",
  },
  twitter: {
    name: "X (Twitter)",
    patterns: [
      /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i,
    ],
    icon: "fab fa-x-twitter",
    color: "#000000",
  },
  tiktok: {
    name: "TikTok",
    patterns: [
      /^(https?:\/\/)?(www\.|vm\.)?tiktok\.com\/@[\w.]+\/video\/\d+/i,
      /^(https?:\/\/)?vm\.tiktok\.com\/\w+/i,
      /^(https?:\/\/)?(www\.)?tiktok\.com\/t\/\w+/i,
    ],
    icon: "fab fa-tiktok",
    color: "#010101",
  },
};

/**
 * Detect which platform a URL belongs to
 * @param {string} url - The URL to check
 * @returns {string|null} - Platform key or null if unsupported
 */
function detectPlatform(url) {
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    for (const pattern of platform.patterns) {
      if (pattern.test(url)) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Validate if a URL is supported by the downloader
 * @param {string} url - URL to validate
 * @returns {{ valid: boolean, platform: string|null, error: string|null }}
 */
function validateUrl(url) {
  if (!url || typeof url !== "string") {
    return { valid: false, platform: null, error: "URL is required." };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { valid: false, platform: null, error: "URL cannot be empty." };
  }

  // Basic URL format check
  try {
    new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    );
  } catch {
    return { valid: false, platform: null, error: "Invalid URL format." };
  }

  const platform = detectPlatform(trimmed);

  if (!platform) {
    return {
      valid: false,
      platform: null,
      error:
        "Unsupported platform. Please use a YouTube, X (Twitter), or TikTok URL.",
    };
  }

  return { valid: true, platform, error: null };
}

module.exports = { validateUrl, detectPlatform, PLATFORMS };
