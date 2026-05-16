const CACHE = "simulador-v15";

/** URLs exactas referenciadas em index.html / inversa.html (incl. query ?v=). */
const PRECACHE = [
  "/",
  "/index.html",
  "/quanto-posso-pedir.html",
  "/manifest.json",
  "/icon.svg",
  "/react-runtime.js?v=1",
  "/inversa-bootstrap.js?v=1",
  "/reverse-calc-page.js?v=11",
  "/inversa-mount.js?v=3",
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
