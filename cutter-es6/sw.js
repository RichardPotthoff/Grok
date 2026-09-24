/* Offline cache for the ESM cutter. Relative URLs so this works
   on GitHub Pages (/Grok/cutter-es6/) and on the Grok preview.
   Bump VERSION whenever app sources change so waiting clients can update. */
const VERSION = "cutter-offline-v8-20260924";
const PRECACHE = [
  "./standalone.html",
  "./drawing.html",
  "./manifest.json",
  "./icon-180.png",
  "./favicon.svg",
  "./index.html",
  "./es6/turtle-graphics.js",
  "./es6/geometry.js",
  "./es6/m4.js",
  "./es6/cookiecutters.js",
  "./es6/path-utils.js",
  "./es6/close-path.js",
  "./es6/biarc.js",
  "./es6/curve-editor.js",
  "./es6/drawing-doc.js",
  "./es6/tool-icons.js",
  "./es6/path-xform.js",
  "./es6/turtle-cmd.js",
  "./es6/webgl-cutter.js",
  "./es6/curve-editor-widget.js",
  "./es6/webgl-cutter-widget.js",
  "./es6/download-kit.js",
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
            /* optional file */
          }
        }),
      );
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

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting" || event.data?.type === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  const live =
    event.request.mode === "navigate" ||
    path.endsWith(".html") ||
    path.endsWith(".js") ||
    path.endsWith(".json") ||
    path.endsWith("/sw.js");

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      if (live) {
        try {
          const res = await fetch(event.request, { cache: "no-cache" });
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch (_) {
          return (
            (await caches.match(event.request, { ignoreSearch: true })) ||
            (await caches.match("./standalone.html")) ||
            Response.error()
          );
        }
      }
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) {
        fetch(event.request)
          .then((res) => {
            if (res.ok) cache.put(event.request, res);
          })
          .catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      } catch (_) {
        return Response.error();
      }
    })(),
  );
});
