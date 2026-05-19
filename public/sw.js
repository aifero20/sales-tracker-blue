const CACHE = "binowo-v4";

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
    .then(() => {
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
      });
    })
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/api/") ||
    e.request.method !== "GET"
  ) return;

  const isHashedAsset = url.pathname.match(/\/assets\/.*\.[a-f0-9]{8,}\.(js|css)$/);

  if (isHashedAsset) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          }
          return res;
        });
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
