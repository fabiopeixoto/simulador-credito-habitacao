/**
 * Mínimo partilhado com o simulador principal para montar window._SIM
 * antes de carregar reverse-calc-page.js (página dedicada inversa.html).
 */
;(function () {
  "use strict";
  if (typeof window.React === "undefined") return;
  var React = window.React;
  var G = "#16a34a",
    R = "#dc2626",
    Au = "#2563eb",
    N = "#e5e7eb",
    Sky = "#0284c7";
  var shared = window._SIM_SHARED || {};
  var EUR_COLORS = shared.EUR_COLORS || {
    "3m": ["#f97316", "rgba(249,115,22,0.18)"],
    "6m": [Sky, "rgba(2,132,199,0.18)"],
    "12m": [Au, "rgba(37,99,235,0.18)"],
  };
  var FALLBACK_EUR = shared.FALLBACK_EUR || {
    "3m": { valor: 2.339, data: "junho 2026" },
    "6m": { valor: 2.596, data: "junho 2026" },
    "12m": { valor: 2.798, data: "junho 2026" },
  };
  var CONTRATO_FACTOR = shared.CONTRATO_FACTOR || {
    efetivo: 1.0,
    termo: 0.9,
    parcial: 0.8,
    recibo: 0.7,
    pensao: 1.0,
  };
  // fE/fP/SliderInput vivem em js/core/calc.js e js/components/slider-input.js,
  // carregados logo a seguir a este ficheiro em todas as páginas.

  var LTV_BRACKETS = {
    CA:    [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    CTT:   [{max:100,add:0}],
    BNKTR: [{max:75,add:0},{max:80,add:0.05},{max:90,add:0.10},{max:100,add:0.15}],
    ABANCA:[{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    BCP:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    ACTVO: [{max:70,add:0},{max:80,add:0},{max:90,add:0},{max:100,add:0.10}],
    BPI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    MNTPO: [{max:70,add:0},{max:80,add:0},{max:90,add:0},{max:100,add:0}],
    SANTR: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    NB:    [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    CGD:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    UCI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
    BNI:   [{max:80,add:0},{max:90,add:0.10}],
  };

  var BANK_DOMAINS = {
    CA:"creditoagricola.pt", CTT:"ctt.pt", BNKTR:"bankinter.pt", ABANCA:"abanca.com",
    BCP:"millenniumbcp.pt", ACTVO:"activobank.pt", BPI:"bpi.pt", MNTPO:"bancomontepio.pt",
    SANTR:"santander.pt", NB:"novobanco.pt", CGD:"cgd.pt", UCI:"uci.es",
    BNI:"bnieuropa.pt",
  };

  window._SIM = Object.assign(window._SIM || {}, {
    CONTRATO_FACTOR: CONTRATO_FACTOR,
    FALLBACK_EUR: FALLBACK_EUR,
    G: G,
    Au: Au,
    R: R,
    N: N,
    Sky: Sky,
    useState: React.useState,
    EUR_COLORS: EUR_COLORS,
    LTV_BRACKETS: LTV_BRACKETS,
    BANK_DOMAINS: BANK_DOMAINS,
  });
})();
