const CACHE = "simulador-v166";

/** URLs exactas referenciadas nos HTML (incl. query ?v=). */
const PRECACHE = [
  "/",
  "/index.html",
  "/quanto-posso-pedir.html",
  "/historico.html",
  "/transferencia.html",
  "/comparacao.html",
  "/imi.html",
  "/rentabilidade.html",
  "/custos-compra.html",
  "/stress-euribor.html",
  "/privacidade.html",
  "/manifest.json",
  "/favicon.png",
  "/images/logo.png",
  "/js/vendor/react-runtime.js?v=1",
  "/js/vendor/recharts-polyfill.js?v=4",
  "/js/shared/sim-defaults.js?v=1",
  "/js/shared/imi-municipios-defaults.js?v=1",
  "/js/shared/sim-shared-constants.js?v=3",
  "/js/shared/inversa-bootstrap.js?v=7",
  "/js/shared/page-header.js?v=51",
  "/js/core/calc.js?v=4",
  "/js/core/constants.js?v=2",
  "/js/core/styles.js?v=1",
  "/js/components/slider-input.js?v=1",
  "/js/components/ref-badge.js?v=1",
  "/js/components/hist-modal.js?v=1",
  "/js/components/comments-modal.js?v=9",
  "/js/components/glossario-modal.js?v=10",
  "/js/components/processo-modal.js?v=1",
  "/js/components/bank-detail-modal.js?v=4",
  "/js/components/comp-table-mobile.js?v=1",
  "/js/components/comp-table-desktop.js?v=1",
  "/js/components/seg-table-mobile.js?v=1",
  "/js/components/cust-table-mobile.js?v=1",
  "/js/components/cen-table-mobile.js?v=2",
  "/js/components/transf-table-mobile.js?v=2",
  "/js/views/header-bar.js?v=8",
  "/js/views/params-panel.js?v=1",
  "/js/views/view-comp.js?v=1",
  "/js/views/view-seguros.js?v=2",
  "/js/views/view-custos.js?v=3",
  "/js/views/view-viabilidade.js?v=2",
  "/js/views/view-cenarios.js?v=4",
  "/js/views/view-amortizacao.js?v=1",
  "/js/pages/app.js?v=84",
  "/js/pages/index-mount.js?v=5",
  "/js/pages/historico-page.js?v=13",
  "/js/pages/historico-mount.js?v=6",
  "/js/pages/transferencia-page.js?v=17",
  "/js/pages/transferencia-mount.js?v=8",
  "/js/pages/reverse-calc-page.js?v=24",
  "/js/pages/inversa-mount.js?v=9",
  "/js/pages/comparacao-page.js?v=8",
  "/js/pages/comparacao-mount.js?v=3",
  "/js/pages/imi-page.js?v=4",
  "/js/pages/imi-mount.js?v=2",
  "/js/pages/custos-compra-page.js?v=4",
  "/js/pages/custos-compra-mount.js?v=2",
  "/js/pages/stress-euribor-page.js?v=3",
  "/js/pages/stress-euribor-mount.js?v=2",
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
