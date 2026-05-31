/**
 * ============================================================
 * VideoVault - Premium Video Downloader
 * server.js - Main Express application entry point
 * ============================================================
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const videoRoutes = require("./routes/video");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ──────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow CDN resources
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ────────────────────────────────────────────
// Limit each IP to 30 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// ── Password Protection ─────────────────────────────────────
const SITE_PASSWORD = process.env.SITE_PASSWORD || "videovault2025";

// Simple cookie parser (must come before auth middleware)
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie || "";
  cookieHeader.split(";").forEach((c) => {
    const parts = c.trim().split("=");
    const k = parts[0]?.trim();
    const v = parts.slice(1).join("=").trim();
    if (k && v) req.cookies[k] = v;
  });
  next();
});

// Auth middleware: check session cookie
app.use((req, res, next) => {
  // Allow login page and auth endpoint
  if (req.path === "/login.html" || req.path === "/auth") return next();
  // Check cookie
  const token = req.cookies?.["vv-auth"];
  if (token === SITE_PASSWORD) return next();
  // Block API
  if (req.path.startsWith("/api/"))
    return res.status(401).json({ error: "Unauthorized" });
  // Show login page
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Auth endpoint
app.post("/auth", (req, res) => {
  const { password } = req.body;
  if (password === SITE_PASSWORD) {
    res.setHeader(
      "Set-Cookie",
      `vv-auth=${SITE_PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`,
    );
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Wrong password" });
  }
});

// ── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── API Routes ───────────────────────────────────────────────
app.use("/api/video", videoRoutes);
app.use("/api/admin", adminRoutes);

// Admin dashboard page
app.get("/admin", (req, res) => {
  const token = req.cookies?.["vv-admin"];
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin2025";
  if (token === ADMIN_PASSWORD) {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
  } else {
    res.sendFile(path.join(__dirname, "public", "admin-login.html"));
  }
});

// ── Catch-all: Serve Frontend or 404 ────────────────────────
app.get("*", (req, res) => {
  // Check if it's an HTML page request
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// ── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error. Please try again.",
  });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 VideoVault server running on http://localhost:${PORT}`);
  console.log(`📺 Ready to download videos!\n`);
});
