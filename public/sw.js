// Service Worker for VideoVault PWA
const CACHE_NAME = "videovault-v1";
const STATIC_ASSETS = ["/", "/index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Only cache GET requests for static assets, pass API calls through
  if (e.request.url.includes("/api/")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// Push notifications
self.addEventListener("push", (e) => {
  const data = e.data?.json() || {
    title: "VideoVault",
    body: "Your download is ready!",
  };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
