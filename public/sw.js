// ConstructHub Service Worker v1
// Strategy:
//   - Cache-first for /_next/static and /icons
//   - Network-first for everything else (HTML, API calls)
//
// No offline writes in v1 — offline banner handled by OfflineBanner component.

const CACHE_NAME = "constructhub-v1";
const STATIC_PATTERN = /^\/_next\/static\/|^\/icons\//;

self.addEventListener("install", (event) => {
  // Activate immediately without waiting for old SW to stop
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Remove stale caches from previous versions
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Don't intercept cross-origin requests (Cloudinary, Neon, etc.)
  if (url.origin !== self.location.origin) return;

  if (STATIC_PATTERN.test(url.pathname)) {
    // Cache-first: static assets are content-hashed, safe to cache long-term
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Network-first: always try network, fall back to cache (stale page) if offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful HTML navigations so app shell works offline
        if (
          response.ok &&
          request.headers.get("accept")?.includes("text/html")
        ) {
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ??
            new Response(
              `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline — ConstructHub</title>
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
              .box{text-align:center;padding:2rem}h1{font-size:1.25rem;font-weight:600;margin-bottom:.5rem}
              p{color:#64748b;font-size:.875rem}a{color:#0f172a;font-weight:500}</style></head>
              <body><div class="box"><h1>You're offline</h1>
              <p>Check your connection and <a href="/dashboard">try again</a>.</p></div></body></html>`,
              { headers: { "Content-Type": "text/html" } }
            )
        )
      )
  );
});
