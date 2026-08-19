/* Offline cache for the ESM cutter. Relative URLs so this works
   on GitHub Pages (/Grok/cutter-es6/) and on the Grok preview. */
const VERSION = "cutter-offline-v1";
const PRECACHE = [
  "./standalone.html",
  "./manifest.json",
  "./icon-180.png",
  "./favicon.svg",
  "./index.html",
  "./es6/turtle-graphics.js",
  "./es6/geometry.js",
  "./es6/m4.js",
  "./es6/cookiecutters.js",
  "./es6/path-utils.js",
  "./es6/curve-editor.js",
  "./es6/webgl-cutter.js",
  "./es6/curve-editor-widget.js",
  "./es6/webgl-cutter-widget.js",
  "./es6/download-kit.js",
  "./es6/README.md",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res.ok) await cache.put(url, res);
          } catch (_) {
            /* optional file (e.g. IIFE index.html) */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res.ok && new URL(event.request.url).origin === self.location.origin) {
          const cache = await caches.open(VERSION);
          cache.put(event.request, res.clone());
        }
        return res;
      } catch (_) {
        if (event.request.mode === "navigate") {
          return (
            (await caches.match("./standalone.html")) ||
            (await caches.match("./index.html")) ||
            Response.error()
          );
        }
        return Response.error();
      }
    })(),
  );
});
