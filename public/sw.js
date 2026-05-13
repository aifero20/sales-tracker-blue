const CACHE = "binowo-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Skip Supabase & API calls — jangan di-cache
  if (
    url.hostname.includes("supabase") ||
    url.pathname.startsWith("/api/") ||
    e.request.method !== "GET"
  ) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
        }
        return res;
      });
      // Kalau ada cache, tampilkan dulu sambil fetch di background
      return cached ?? fetchPromise;
    }).catch(() => caches.match(e.request))
  );
});
