const CACHE = "alazab-v10";
const APP_SHELL = ["/", "/index.html", "/icon.svg", "/manifest.json"];

// Install: cache the app shell
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - API calls → always network (never cache)
//   - Everything else → cache first, fall back to network
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Never intercept API calls or non-GET requests
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        // Update cache with fresh copy
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      // Return cached instantly, refresh in background
      return cached || networkFetch;
    })
  );
});
