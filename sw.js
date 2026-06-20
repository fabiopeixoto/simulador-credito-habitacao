const CACHE = "simulador-v132";

/** URLs exactas referenciadas em index.html / quanto-posso-pedir.html / historico.html (incl. query ?v=). */
const PRECACHE = [
  "/",
  "/index.html",
  "/quanto-posso-pedir.html",
  "/historico.html",
  "/privacidade.html",
  "/manifest.json",
  "/favicon.png",
  "/images/logo.png",
  "/react-runtime.js?v=1",
  "/recharts-polyfill.js?v=1",
  "/sim-shared-constants.js?v=2",
  "/js/core/calc.js?v=1",
  "/js/core/constants.js?v=1",
  "/js/core/styles.js?v=1",
  "/js/components/slider-input.js?v=1",
  "/js/components/ref-badge.js?v=1",
  "/js/components/hist-modal.js?v=1",
  "/js/views/header-bar.js?v=1",
  "/js/views/params-panel.js?v=1",
  "/js/views/view-comp.js?v=1",
  "/js/views/view-seguros.js?v=2",
  "/js/views/view-custos.js?v=2",
  "/js/views/view-viabilidade.js?v=2",
  "/js/views/view-cenarios.js?v=3",
  "/js/views/view-amortizacao.js?v=1",
  "/app.js?v=81",
  "/bank-detail-modal.js?v=4",
  "/comp-table-mobile.js?v=1",
  "/comp-table-desktop.js?v=1",
  "/seg-table-mobile.js?v=1",
  "/cust-table-mobile.js?v=1",
  "/cen-table-mobile.js?v=2",
  "/index-mount.js?v=5",
  "/inversa-bootstrap.js?v=6",
  "/comments-modal.js?v=5",
  "/page-header.js?v=19",
  "/glossario-modal.js?v=5",
  "/transferencia.html",
  "/transf-table-mobile.js?v=2",
  "/transferencia-page.js?v=15",
  "/transferencia-mount.js?v=6",
  "/reverse-calc-page.js?v=21",
  "/inversa-mount.js?v=7",
  "/historico-page.js?v=12",
  "/historico-mount.js?v=5",
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
