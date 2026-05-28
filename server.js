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

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security Middleware ──────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow CDN resources
  })
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

// ── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── API Routes ───────────────────────────────────────────────
app.use("/api/video", videoRoutes);

// ── Catch-all: Serve Frontend ────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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
