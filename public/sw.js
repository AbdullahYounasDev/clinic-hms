const CACHE_NAME = "clinichms-shell-v2";
const OFFLINE_URL = "/offline";

function shouldBypass(request) {
  if (request.method !== "GET") return true;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;

  const pathname = url.pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) return true;
  if (pathname === "/sw.js" || pathname.endsWith(".webmanifest")) return true;
  if (url.searchParams.has("_rsc")) return true;

  if (
    request.headers.get("RSC") ||
    request.headers.get("Next-Router-Prefetch") ||
    request.headers.get("Next-Router-State-Tree")
  ) {
    return true;
  }

  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (shouldBypass(event.request)) return;
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
      return Response.error();
    })
  );
});
