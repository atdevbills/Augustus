/* sw.js — service worker for the school site (works under /Augustus/ on GitHub Pages).
   Strategy: network first, so new uploads/edits show immediately; cache is only the offline fallback.
   Supabase requests (data, photos, audio) are NOT intercepted, so they are never served stale.
   When you change any site file, bump CACHE_VERSION to clear old copies. */
const CACHE_VERSION = "v2"; // bumped to v2 so the old cache clears
const CACHE = "augustus-" + CACHE_VERSION;

const SHELL = [
  "/Augustus/", 
  "/Augustus/index.html", 
  "/Augustus/notice.html", 
  "/Augustus/admin.html",
  "/Augustus/style.css", 
  "/Augustus/notice-style.css", 
  "/Augustus/admin-style.css",
  "/Augustus/theme.js", 
  "/Augustus/script.js", 
  "/Augustus/notice-script.js", 
  "/Augustus/admin-script.js", 
  "/Augustus/supabase-config.js",
  "/Augustus/manifest.json", 
  "/Augustus/admin-manifest.json",
  "/Augustus/favicon.png", 
  "/Augustus/icon-192.png", 
  "/Augustus/icon-512.png"
];

// Outside files the pages need (supabase-js library, fonts)
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return; // Supabase etc. go straight to the network

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && (res.status === 200 || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === "navigate") {
      const home = await cache.match("/Augustus/index.html");
      if (home) return home;
    }
    throw err;
  }
}