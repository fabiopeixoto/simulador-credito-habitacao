/**
 * Constantes partilhadas entre páginas (sem React).
 * Carregar antes de inversa-bootstrap.js e app.js.
 */
;(function () {
  "use strict";
  window._SIM_SHARED = {
    FALLBACK_EUR: {
      "3m": { valor: 2.209, data: "maio 2026" },
      "6m": { valor: 2.541, data: "maio 2026" },
      "12m": { valor: 2.86, data: "maio 2026" },
    },
    CONTRATO_FACTOR: {
      efetivo: 1.0,
      termo: 0.9,
      parcial: 0.8,
      recibo: 0.7,
      pensao: 1.0,
    },
    EUR_COLORS: {
      "3m": ["#f97316", "rgba(249,115,22,0.18)"],
      "6m": ["#0284c7", "rgba(2,132,199,0.18)"],
      "12m": ["#2563eb", "rgba(37,99,235,0.18)"],
    },
  };
})();
