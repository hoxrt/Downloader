/**
 * routes/admin.js
 * Admin dashboard API endpoints
 */

const express = require("express");
const router = express.Router();
const { getStats } = require("../utils/stats");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin2025";

// Middleware: check admin token
router.use((req, res, next) => {
  const token = req.cookies?.["vv-admin"] || req.headers["x-admin-token"];
  if (token === ADMIN_PASSWORD) return next();
  if (req.path === "/login") return next();
  res.status(401).json({ error: "Unauthorized" });
});

// Admin login
router.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.setHeader(
      "Set-Cookie",
      `vv-admin=${ADMIN_PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
    );
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Wrong admin password" });
  }
});

// Get stats
router.get("/stats", (req, res) => {
  const stats = getStats();
  res.json(stats);
});

// Logout
router.post("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "vv-admin=; Path=/; Max-Age=0");
  res.json({ success: true });
});

module.exports = router;
