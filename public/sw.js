/**
 * Spiral Cafe POS - Progressive Web App Service Worker
 * 
 * SECURITY & ARCHITECTURAL BOUNDARIES:
 * - Does NOT cache authenticated API responses (/api/*)
 * - Does NOT cache Supabase or WebSocket connections
 * - Does NOT intercept Windows Print Connector requests (127.0.0.1:4318)
 * - Provides lightweight offline fallback and shell assets for PWA installability
 */

const CACHE_NAME = "spiral-pos-shell-v1.2.0";
const PRECACHE_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32x32.png",
  "/app-logo.png"
];

// Install: Precache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: Clean up older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: Secure passthrough with offline shell fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Never handle non-GET requests
  if (req.method !== "GET") {
    return;
  }

  // 2. Bypass local print connector completely
  if (url.hostname === "127.0.0.1" && (url.port === "4318" || url.port === "9100")) {
    return;
  }

  // 3. Bypass external services (Supabase, Razorpay, CDN)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 4. Strict Security: NEVER cache /api/ endpoints or sensitive admin requests
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 5. Navigation requests (HTML pages): Network-first, fallback to /offline.html on network failure
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match("/offline.html").then((fallback) => {
          return fallback || new Response("Internet connection required for Spiral Cafe POS.", {
            status: 503,
            headers: { "Content-Type": "text/plain" }
          });
        });
      })
    );
    return;
  }

  // 6. Static icons and manifest: Cache-first with network update
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json" || url.pathname === "/app-logo.png") {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  // 7. All other requests: Passthrough to network
  return;
});

