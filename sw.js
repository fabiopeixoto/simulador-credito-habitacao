const CACHE = "simulador-v39";

/** URLs exactas referenciadas em index.html / quanto-posso-pedir.html / historico.html (incl. query ?v=). */
const PRECACHE = [
  "/",
  "/index.html",
  "/quanto-posso-pedir.html",
  "/historico.html",
  "/manifest.json",
  "/favicon.png",
  "/images/logo.png",
  "/images/logo.svg",
  "/react-runtime.js?v=1",
  "/recharts-polyfill.js?v=1",
  "/app.js?v=13",
  "/index-mount.js?v=1",
  "/inversa-bootstrap.js?v=1",
  "/comments-modal.js?v=1",
  "/page-header.js?v=10",
  "/transferencia.html",
  "/transferencia-page.js?v=4",
  "/transferencia-mount.js?v=1",
  "/reverse-calc-page.js?v=14",
  "/inversa-mount.js?v=4",
  "/historico-page.js?v=4",
  "/historico-mount.js?v=2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSameOriginScriptRequest(req) {
  try {
    const u = new URL(req.url);
    if (u.origin !== self.location.origin) return false;
    if (req.destination === "script") return true;
    if (u.pathname.endsWith(".js")) return true;
    return false;
  } catch (_) {
    return false;
  }
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((r) => {
          if (r) return r;
          if (isSameOriginScriptRequest(e.request)) {
            return new Response("", { status: 503, statusText: "Script unavailable offline" });
          }
          return caches.match("/index.html");
        })
      )
  );
});
