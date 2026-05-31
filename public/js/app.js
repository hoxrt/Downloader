/* ============================================================
   VideoVault — Main JavaScript
   app.js
============================================================ */

/* ════════════════════════════════════════
   CONFIG
════════════════════════════════════════ */
const API = window.location.origin + "/api/video";
let currentUrl = "";
let currentData = null;

/* ════════════════════════════════════════
   SPLASH SCREEN
════════════════════════════════════════ */
window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("splash").classList.add("hidden");
  }, 1500);
});

/* ════════════════════════════════════════
   PARTICLES
════════════════════════════════════════ */
(function initParticles() {
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");
  let W,
    H,
    particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const COLORS = ["rgba(123,110,255,", "rgba(91,158,255,", "rgba(0,229,212,"];

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.r = Math.random() * 1.5 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.alpha = Math.random() * 0.5 + 0.1;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.alpha + ")";
      ctx.fill();
    }
  }

  // Create particles
  for (let i = 0; i < 90; i++) particles.push(new Particle());

  // Draw lines between close particles
  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(123,110,255,${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      p.update();
      p.draw();
    });
    drawLines();
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ════════════════════════════════════════
   THEME TOGGLE
════════════════════════════════════════ */
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  document.getElementById("themeIcon").className =
    t === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun";
  localStorage.setItem("vv-theme", t);
}
document.getElementById("themeToggle").onclick = () =>
  applyTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark",
  );
applyTheme(localStorage.getItem("vv-theme") || "dark");

/* ════════════════════════════════════════
   PWA INSTALL
════════════════════════════════════════ */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("pwaBtn").classList.add("visible");
});
document.getElementById("pwaBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    document.getElementById("pwaBtn").classList.remove("visible");
    showToast(
      "success",
      "App Installed!",
      "VideoVault added to your home screen.",
    );
  }
  deferredPrompt = null;
};

/* ════════════════════════════════════════
   SERVICE WORKER
════════════════════════════════════════ */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(() => {
    // Show notification banner after 3 seconds if not asked before
    if (
      Notification.permission === "default" &&
      !localStorage.getItem("vv-notif-asked")
    ) {
      setTimeout(
        () => document.getElementById("notifBanner").classList.add("visible"),
        3000,
      );
    }
  });
}

/* ════════════════════════════════════════
   PUSH NOTIFICATIONS
════════════════════════════════════════ */
async function requestNotifPermission() {
  dismissNotifBanner();
  localStorage.setItem("vv-notif-asked", "1");
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    showToast(
      "success",
      "Notifications Enabled!",
      "You'll be notified when downloads are ready.",
    );
    new Notification("VideoVault", {
      body: "Notifications are now enabled! 🎉",
      icon: "/icon-192.png",
    });
  }
}
function dismissNotifBanner() {
  document.getElementById("notifBanner").classList.remove("visible");
  localStorage.setItem("vv-notif-asked", "1");
}
function sendDownloadNotification(title) {
  if (Notification.permission === "granted") {
    new Notification("Download Ready!", {
      body: `"${title}" is ready to save.`,
      icon: "/icon-192.png",
    });
  }
}

/* ════════════════════════════════════════
   HISTORY
════════════════════════════════════════ */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("vv-history") || "[]");
  } catch {
    return [];
  }
}
function saveHistory(url) {
  let h = getHistory().filter((i) => i.url !== url);
  h.unshift({ url, time: Date.now() });
  localStorage.setItem("vv-history", JSON.stringify(h.slice(0, 5)));
  renderHistory();
}
function clearHistory() {
  localStorage.removeItem("vv-history");
  renderHistory();
}
function renderHistory() {
  const h = getHistory();
  const section = document.getElementById("historySection");
  const list = document.getElementById("historyList");
  if (h.length === 0) {
    section.classList.remove("visible");
    return;
  }
  section.classList.add("visible");
  list.innerHTML = h
    .map((item) => {
      const icon =
        item.url.includes("youtube") || item.url.includes("youtu.be")
          ? "fab fa-youtube"
          : item.url.includes("twitter") || item.url.includes("x.com")
            ? "fab fa-x-twitter"
            : "fab fa-tiktok";
      const short =
        item.url.length > 52 ? item.url.substring(0, 52) + "…" : item.url;
      return `<div class="history-item" onclick="useHistory('${item.url.replace(/'/g, "\\'")}')">
      <i class="${icon} history-item-icon"></i>
      <span class="history-item-url">${short}</span>
    </div>`;
    })
    .join("");
}
function useHistory(url) {
  document.getElementById("videoUrl").value = url;
  updateInputIcon(url);
  document.getElementById("inputClear").classList.add("visible");
  fetchVideoInfo();
}

/* ════════════════════════════════════════
   INPUT HELPERS
════════════════════════════════════════ */
function updateInputIcon(val) {
  const icon = document.getElementById("inputIcon");
  if (val.match(/youtube\.com|youtu\.be/i)) {
    icon.className = "fab fa-youtube input-icon";
    icon.style.color = "#FF0000";
  } else if (val.match(/twitter\.com|x\.com/i)) {
    icon.className = "fab fa-x-twitter input-icon";
    icon.style.color = "";
  } else if (val.match(/tiktok\.com/i)) {
    icon.className = "fab fa-tiktok input-icon";
    icon.style.color = "var(--teal)";
  } else {
    icon.className = "fa-solid fa-link input-icon";
    icon.style.color = "";
  }
}
document.getElementById("videoUrl").addEventListener("input", (e) => {
  const val = e.target.value.trim();
  updateInputIcon(val);
  document
    .getElementById("inputClear")
    .classList.toggle("visible", val.length > 0);
});
document.getElementById("videoUrl").addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchVideoInfo();
});
function clearInput() {
  document.getElementById("videoUrl").value = "";
  document.getElementById("videoUrl").focus();
  document.getElementById("inputClear").classList.remove("visible");
  updateInputIcon("");
  hideResult();
}
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById("videoUrl").value = text;
      updateInputIcon(text);
      document.getElementById("inputClear").classList.add("visible");
      showToast("info", "Pasted!", "URL pasted from clipboard.");
    }
  } catch {
    showToast("error", "Failed", "Could not access clipboard.");
  }
}

/* ════════════════════════════════════════
   FETCH VIDEO INFO
════════════════════════════════════════ */
async function fetchVideoInfo() {
  const url = document.getElementById("videoUrl").value.trim();
  if (!url) {
    showToast("error", "Empty URL", "Please paste a video URL first.");
    return;
  }

  const btn = document.getElementById("fetchBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing…';

  hideResult();
  showLoading(true);
  setLoadingText("Connecting to video source…");
  currentUrl = url;

  try {
    setTimeout(() => setLoadingText("Fetching video metadata…"), 700);
    setTimeout(() => setLoadingText("Loading available qualities…"), 1500);

    const res = await fetch(`${API}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch video info.");

    currentData = data;
    saveHistory(url);
    showResult(data);
    showToast("success", "Video Found!", `"${trunc(data.title, 42)}" ready.`);
  } catch (err) {
    showToast("error", "Error", err.message || "Something went wrong.");
  } finally {
    showLoading(false);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Analyze';
  }
}

/* ════════════════════════════════════════
   RENDER RESULT
════════════════════════════════════════ */
function showResult(data) {
  const thumb = document.getElementById("resultThumbnail");
  if (data.thumbnail) {
    thumb.src = data.thumbnail;
    thumb.onerror = () => {
      thumb.style.display = "none";
    };
  }
  document.getElementById("resultDuration").textContent = data.duration || "";
  document.getElementById("resultPlatform").innerHTML =
    `<i class="${data.platform.icon}"></i> ${data.platform.name}`;
  document.getElementById("resultTitle").textContent = data.title;

  let stats = `<span><i class="fa-regular fa-clock"></i> ${data.duration}</span>`;
  if (data.uploader)
    stats += `<span><i class="fa-regular fa-user"></i> ${trunc(data.uploader, 26)}</span>`;
  if (data.viewCount)
    stats += `<span><i class="fa-regular fa-eye"></i> ${data.viewCount}</span>`;
  document.getElementById("resultStats").innerHTML = stats;

  const grid = document.getElementById("qualityGrid");
  grid.innerHTML = "";
  if (data.qualities && data.qualities.length > 0) {
    data.qualities.forEach((q) => {
      const bc = getBadgeClass(q.quality);
      const sz = q.filesizeFormatted ? ` · ${q.filesizeFormatted}` : "";
      const btn = document.createElement("button");
      btn.className = "btn btn--quality";
      btn.innerHTML = `<i class="fa-solid fa-download"></i><span class="q-badge ${bc}">${q.quality}</span>MP4${sz}`;
      btn.onclick = () => triggerDownload(q.formatId, "video", q.quality);
      grid.appendChild(btn);
    });
  } else {
    const btn = document.createElement("button");
    btn.className = "btn btn--quality";
    btn.innerHTML = `<i class="fa-solid fa-download"></i> Best Quality · MP4`;
    btn.onclick = () => triggerDownload("best", "video", "Best");
    grid.appendChild(btn);
  }

  document.getElementById("audioBtn").onclick = () =>
    triggerDownload(null, "audio");
  document.getElementById("resultSection").classList.add("visible");
  if (window.innerWidth < 768) {
    setTimeout(
      () =>
        document
          .getElementById("resultSection")
          .scrollIntoView({ behavior: "smooth", block: "start" }),
      100,
    );
  }
}

function getBadgeClass(q) {
  const h = parseInt(q);
  if (h >= 2160) return "uhd";
  if (h >= 1080) return "fhd";
  if (h >= 720) return "hd";
  return "sd";
}

/* ════════════════════════════════════════
   DOWNLOAD WITH REAL SSE PROGRESS
════════════════════════════════════════ */
let activeSSE = null;

async function triggerDownload(formatId, type, qualityLabel) {
  if (!currentUrl) {
    showToast("error", "No Video", "Fetch a video first.");
    return;
  }

  const label = type === "audio" ? "MP3 Audio" : `${qualityLabel} Video`;
  showDlModal(label);
  setDlProgress(0, "Connecting…");

  // Unique ID for this download session
  const dlId = Math.random().toString(36).substring(2, 10);

  // Close any previous SSE connection
  if (activeSSE) {
    activeSSE.close();
    activeSSE = null;
  }

  // 1) Open SSE connection to receive live progress from yt-dlp
  activeSSE = new EventSource(`${API}/progress?id=${dlId}`);

  activeSSE.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);

      if (d.stage === "start") {
        setDlProgress(2, "Starting download…");
      } else if (d.stage === "downloading") {
        // Show real percentage + speed + ETA
        const statusParts = [];
        if (d.speed) statusParts.push(d.speed);
        if (d.eta && d.eta !== "00:00") statusParts.push(`ETA ${d.eta}`);
        const status = statusParts.length
          ? statusParts.join(" · ")
          : `${d.pct}%`;
        setDlProgress(d.pct, status);
        // Show size info in sub-label
        if (d.size)
          document.getElementById("dlModalDesc").textContent =
            `Downloaded: ${d.size}`;
      } else if (d.stage === "merging") {
        setDlProgress(96, "Merging video & audio…");
      } else if (d.stage === "audio") {
        setDlProgress(96, "Extracting audio…");
      } else if (d.stage === "saving") {
        setDlProgress(98, "Saving file…");
      } else if (d.stage === "done") {
        setDlProgress(100, "Complete!");
        activeSSE.close();
        activeSSE = null;
      }
    } catch {}
  };

  activeSSE.onerror = () => {
    // SSE closed — normal after download completes
    if (activeSSE) {
      activeSSE.close();
      activeSSE = null;
    }
  };

  // 2) Trigger the actual file download after SSE is set up
  setTimeout(async () => {
    const params = new URLSearchParams({ url: currentUrl, type, id: dlId });
    if (formatId && type !== "audio") params.set("format", formatId);

    try {
      const response = await fetch(`${API}/download?${params}`);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Download failed.");
      }

      // Stream response into blob for saving
      const reader = response.body.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const blob = new Blob(chunks);
      const ext = type === "audio" ? "mp3" : "mp4";
      const filename =
        (currentData?.title || "video")
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 60) +
        "." +
        ext;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);

      setDlProgress(100, "Complete!");
      setTimeout(() => {
        closeDlModal();
        finishDlBubble();
        showToast(
          "success",
          "Download Complete!",
          `"${filename}" saved successfully.`,
        );
        sendDownloadNotification(currentData?.title || label);
      }, 1000);
    } catch (err) {
      console.error("Download error:", err);
      if (activeSSE) {
        activeSSE.close();
        activeSSE = null;
      }
      closeDlModal();
      showToast(
        "error",
        "Download Failed",
        err.message || "Something went wrong.",
      );
    }
  }, 300);
}

function setDlProgress(pct, status) {
  dlCurrentPct = pct;
  dlCurrentStatus = status;
  // Modal
  document.getElementById("dlProgressBar").style.width = pct + "%";
  document.getElementById("dlProgressPct").textContent = pct + "%";
  document.getElementById("dlProgressStatus").textContent = status;
  document.getElementById("dlIconRing").style.setProperty("--prog", pct + "%");
  // Bubble sync
  document.getElementById("dbtBar").style.width = pct + "%";
  document.getElementById("dbtPct").textContent = pct + "%";
  document.getElementById("dbtStatus").textContent = status;
  document.getElementById("dlBubbleRing").style.setProperty("--p", pct + "%");
}

/* ════════════════════════════════════════
   DOWNLOAD MODAL + BUBBLE
════════════════════════════════════════ */
let dlIsActive = false;
let dlCurrentLabel = "";
let dlCurrentPct = 0;
let dlCurrentStatus = "Starting…";

function showDlModal(label) {
  dlIsActive = true;
  dlCurrentLabel = label;
  document.getElementById("dlModalTitle").textContent = `Downloading ${label}`;
  document.getElementById("dlModalDesc").textContent =
    "Please wait while we prepare your file…";
  setDlProgress(0, "Starting…");
  document.getElementById("dlOverlay").classList.add("visible");
  // Show bubble
  const bubble = document.getElementById("dlBubble");
  bubble.classList.add("active");
  document.getElementById("dbtTitle").textContent = label;
  document.getElementById("dlBubbleBtn").classList.remove("done");
  document.getElementById("dlBubbleIcon").className = "fa-solid fa-download";
}

function closeDlModal() {
  document.getElementById("dlOverlay").classList.remove("visible");
  // Keep bubble visible if still downloading
  if (!dlIsActive) {
    document.getElementById("dlBubble").classList.remove("active");
  }
}

function reopenDlModal() {
  // Reopen the modal with current progress
  document.getElementById("dlModalTitle").textContent =
    `Downloading ${dlCurrentLabel}`;
  setDlProgress(dlCurrentPct, dlCurrentStatus);
  document.getElementById("dlOverlay").classList.add("visible");
}

function finishDlBubble() {
  dlIsActive = false;
  // Show green done state on bubble
  const btn = document.getElementById("dlBubbleBtn");
  btn.classList.add("done");
  document.getElementById("dlBubbleIcon").className =
    "fa-solid fa-circle-check";
  document.getElementById("dbtTitle").textContent = "Download Complete!";
  // Hide bubble after 5 seconds
  setTimeout(() => {
    document.getElementById("dlBubble").classList.remove("active");
    btn.classList.remove("done");
    document.getElementById("dlBubbleIcon").className = "fa-solid fa-download";
  }, 5000);
}

document.getElementById("dlOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeDlModal();
});

/* ════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════ */
function showLoading(show) {
  document.getElementById("loadingCard").classList.toggle("visible", show);
}
function setLoadingText(t) {
  document.getElementById("loadingText").textContent = t;
}
function hideResult() {
  document.getElementById("resultSection").classList.remove("visible");
}

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
function showToast(type, title, msg, dur = 4500) {
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
  };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]} toast-icon"></i>
    <div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    <button class="toast-close" onclick="dismissToast(this.parentElement)"><i class="fa-solid fa-xmark"></i></button>`;
  document.getElementById("toastContainer").appendChild(t);
  t._timer = setTimeout(() => dismissToast(t), dur);
}
function dismissToast(t) {
  if (!t || !t.parentElement) return;
  clearTimeout(t._timer);
  t.classList.add("exiting");
  t.addEventListener("animationend", () => t.remove(), { once: true });
}

/* ════════════════════════════════════════
   FAQ
════════════════════════════════════════ */
function toggleFaq(q) {
  const item = q.closest(".faq-item");
  const isOpen = item.classList.contains("open");
  document
    .querySelectorAll(".faq-item.open")
    .forEach((i) => i.classList.remove("open"));
  if (!isOpen) item.classList.add("open");
}

/* ════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════ */
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in-view");
        revealObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
);
document
  .querySelectorAll(".reveal, .reveal-stagger")
  .forEach((el) => revealObs.observe(el));

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
renderHistory();
function trunc(s, n) {
  return s && s.length > n ? s.substring(0, n) + "…" : s;
}

const qUrl = new URLSearchParams(window.location.search).get("url");
if (qUrl) {
  document.getElementById("videoUrl").value = decodeURIComponent(qUrl);
  setTimeout(fetchVideoInfo, 600);
}

/* ════════════════════════════════════════
   TYPEWRITER EFFECT
════════════════════════════════════════ */
(function initTypewriter() {
  const words = [
    "Any Video",
    "YouTube Videos",
    "TikTok Clips",
    "Twitter Videos",
    "4K Content",
    "MP3 Audio",
  ];
  let wordIndex = 0,
    charIndex = 0,
    isDeleting = false;
  const el = document.getElementById("typewriterText");
  if (!el) return;

  function type() {
    const word = words[wordIndex];
    if (isDeleting) {
      el.textContent = word.substring(0, charIndex - 1);
      charIndex--;
    } else {
      el.textContent = word.substring(0, charIndex + 1);
      charIndex++;
    }

    let delay = isDeleting ? 60 : 100;

    if (!isDeleting && charIndex === word.length) {
      delay = 2000; // pause at end
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      delay = 400;
    }

    setTimeout(type, delay);
  }
  // Add cursor style
  el.style.borderRight = "3px solid var(--accent)";
  el.style.paddingRight = "4px";
  el.style.animation = "cursorBlink 1s ease-in-out infinite";
  type();
})();

/* ════════════════════════════════════════
   VIDEO PREVIEW
════════════════════════════════════════ */
function openPreview() {
  if (!currentData?.thumbnail) return;
  const overlay = document.getElementById("previewOverlay");
  const video = document.getElementById("previewVideo");
  document.getElementById("previewTitle").textContent = currentData.title || "";
  document.getElementById("previewMeta").textContent =
    `${currentData.platform?.name || ""} · ${currentData.duration || ""}`;

  // Try to load a low-quality preview stream
  const params = new URLSearchParams({
    url: currentUrl,
    type: "video",
    format: "worst[ext=mp4]/worst",
  });
  video.src = `${API}/download?${params}`;
  video.load();
  overlay.classList.add("visible");
}

function closePreview() {
  const overlay = document.getElementById("previewOverlay");
  const video = document.getElementById("previewVideo");
  video.pause();
  video.src = "";
  overlay.classList.remove("visible");
}

// Show preview button after result loads
const _origShowResult = showResult;
showResult = function (data) {
  _origShowResult(data);
  const btn = document.getElementById("previewBtn");
  if (btn) btn.style.display = "inline-flex";
};

/* ════════════════════════════════════════
   KEYBOARD SHORTCUTS
════════════════════════════════════════ */
document.addEventListener("keydown", async (e) => {
  // Ctrl+V or Cmd+V — paste and analyze
  if ((e.ctrlKey || e.metaKey) && e.key === "v") {
    const active = document.activeElement;
    const isInput = active.tagName === "INPUT" || active.tagName === "TEXTAREA";
    if (!isInput) {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (
          text &&
          (text.includes("youtube") ||
            text.includes("youtu.be") ||
            text.includes("twitter") ||
            text.includes("x.com") ||
            text.includes("tiktok"))
        ) {
          document.getElementById("videoUrl").value = text;
          updateInputIcon(text);
          document.getElementById("inputClear").classList.add("visible");
          showToast("info", "URL Pasted!", "Analyzing automatically…");
          setTimeout(fetchVideoInfo, 500);
        }
      } catch {}
    }
  }

  // Escape — close modals
  if (e.key === "Escape") {
    closeDlModal();
    closePreview();
  }

  // Enter — analyze (when not in input)
  if (e.key === "Enter" && document.activeElement.id !== "videoUrl") {
    const url = document.getElementById("videoUrl").value.trim();
    if (url) fetchVideoInfo();
  }
});

/* ════════════════════════════════════════
   MINI PLAYER
════════════════════════════════════════ */
function showMiniPlayer(data) {
  const el = document.getElementById("miniPlayer");
  const thumb = document.getElementById("mpThumb");
  if (data.thumbnail) thumb.style.backgroundImage = `url(${data.thumbnail})`;
  document.getElementById("mpTitle").textContent = trunc(
    data.title || "Unknown",
    32,
  );
  document.getElementById("mpMeta").textContent =
    `${data.platform?.name || ""} · ${data.duration || ""}`;
  document.getElementById("mpDlBtn").onclick = () => {
    if (data.qualities?.length)
      triggerDownload(
        data.qualities[0].formatId,
        "video",
        data.qualities[0].quality,
      );
    else triggerDownload("best", "video", "Best");
  };
  el.classList.add("visible");
}

function hideMiniPlayer() {
  document.getElementById("miniPlayer").classList.remove("visible");
}

function openMiniPreview() {
  if (!currentUrl) return;
  // Open full preview modal instead
  openPreview();
}

// Watch result section visibility
const miniObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!currentData) return;
      if (!e.isIntersecting) showMiniPlayer(currentData);
      else hideMiniPlayer();
    });
  },
  { threshold: 0.05 },
);

setTimeout(() => {
  const rs = document.getElementById("resultSection");
  if (rs) miniObs.observe(rs);
}, 500);

// Hook into showResult
const _sr2 = showResult;
showResult = function (data) {
  _sr2(data);
  hideMiniPlayer();
  const rs = document.getElementById("resultSection");
  miniObs.unobserve(rs);
  miniObs.observe(rs);
};

/* ════════════════════════════════════════
   IMPROVED SCROLL REVEAL
════════════════════════════════════════ */
// Add staggered reveal to feature cards
document.querySelectorAll(".feature-card").forEach((card, i) => {
  card.style.transitionDelay = `${i * 60}ms`;
});

/* ════════════════════════════════════════
   MAGNETIC CURSOR (اختياري)
════════════════════════════════════════ */
let cursorActive = false;
let cursorHandlers = {};
let rafId = null;

function initMagneticCursor() {
  if (cursorActive) return;
  cursorActive = true;

  // Remove existing
  document.getElementById("cursor-dot")?.remove();
  document.getElementById("cursor-ring")?.remove();

  // Add cursor:none style
  if (!document.getElementById("cursor-none-style")) {
    const s = document.createElement("style");
    s.id = "cursor-none-style";
    s.textContent = "* { cursor: none !important; }";
    document.head.appendChild(s);
  }

  const dot = document.createElement("div");
  dot.id = "cursor-dot";
  const ring = document.createElement("div");
  ring.id = "cursor-ring";
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  let mouseX = 0,
    mouseY = 0,
    ringX = 0,
    ringY = 0;

  cursorHandlers.mousemove = (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.opacity = "1";
    ring.style.opacity = "1";
    dot.style.left = mouseX + "px";
    dot.style.top = mouseY + "px";

    const magnetic = e.target.closest(
      "button, .btn, a, .feature-card, .platform-card",
    );
    if (magnetic) {
      const r = magnetic.getBoundingClientRect();
      const dx = mouseX - (r.left + r.width / 2);
      const dy = mouseY - (r.top + r.height / 2);
      magnetic.style.transform = `translate(${dx * 0.2}px, ${dy * 0.2}px)`;
      magnetic.style.transition = "transform 0.15s ease";
    }
  };

  cursorHandlers.mouseover = (e) => {
    const m = e.target.closest("button, .btn, a");
    if (m)
      m.addEventListener(
        "mouseleave",
        () => {
          m.style.transform = "";
          m.style.transition = "transform 0.4s cubic-bezier(.34,1.56,.64,1)";
        },
        { once: true },
      );
  };

  cursorHandlers.mousedown = () => dot.classList.add("clicking");
  cursorHandlers.mouseup = () => dot.classList.remove("clicking");
  cursorHandlers.mouseleave = () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  };
  cursorHandlers.mouseenter = () => {
    dot.style.opacity = "1";
    ring.style.opacity = "1";
  };

  Object.entries(cursorHandlers).forEach(([ev, fn]) =>
    document.addEventListener(ev, fn),
  );

  function animateRing() {
    ringX += (mouseX - ringX) * 0.12;
    ringY += (mouseY - ringY) * 0.12;
    ring.style.left = ringX + "px";
    ring.style.top = ringY + "px";
    rafId = requestAnimationFrame(animateRing);
  }
  animateRing();
}

function destroyMagneticCursor() {
  cursorActive = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Remove event listeners
  Object.entries(cursorHandlers).forEach(([ev, fn]) =>
    document.removeEventListener(ev, fn),
  );
  cursorHandlers = {};

  // Remove elements
  document.getElementById("cursor-dot")?.remove();
  document.getElementById("cursor-ring")?.remove();
  document.getElementById("cursor-none-style")?.remove();

  // Reset any magnetic transforms
  document
    .querySelectorAll("button, .btn, a, .feature-card, .platform-card")
    .forEach((el) => {
      el.style.transform = "";
      el.style.transition = "";
    });
}

function toggleCursor() {
  const isOn = localStorage.getItem("vv-cursor") === "on";
  if (isOn) {
    localStorage.setItem("vv-cursor", "off");
    destroyMagneticCursor();
    updateCursorBtn(false);
    showToast("info", "Cursor Off", "Custom cursor disabled.");
  } else {
    localStorage.setItem("vv-cursor", "on");
    initMagneticCursor();
    updateCursorBtn(true);
    showToast("info", "Cursor On", "Custom cursor enabled.");
  }
}

function updateCursorBtn(isOn) {
  const btn = document.getElementById("cursorToggle");
  const icon = document.getElementById("cursorIcon");
  if (!btn || !icon) return;
  // ✅ fa-computer-mouse موجود في Font Awesome 6
  icon.className = isOn
    ? "fa-solid fa-computer-mouse"
    : "fa-solid fa-computer-mouse";
  btn.style.background = isOn ? "var(--accent-sub)" : "";
  btn.style.borderColor = isOn ? "rgba(123,110,255,.3)" : "";
  btn.style.color = isOn ? "var(--accent)" : "";
  btn.title = isOn ? "Disable custom cursor" : "Enable custom cursor";
}

// Show button only on desktop, init if previously enabled
if (!window.matchMedia("(pointer: coarse)").matches) {
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("cursorToggle");
    if (btn) btn.style.display = "grid";
    const saved = localStorage.getItem("vv-cursor") === "on";
    updateCursorBtn(saved);
    if (saved) initMagneticCursor();
  });
}
