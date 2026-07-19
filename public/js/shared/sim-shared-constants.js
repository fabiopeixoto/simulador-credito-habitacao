/**
 * Constantes partilhadas entre páginas (sem React).
 * Carregar depois de sim-defaults.js e antes de inversa-bootstrap.js e app.js.
 */
;(function () {
  "use strict";
  var DEFAULTS = window._SIM_DEFAULTS || {};
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Valores em vigor em runtime: começam iguais aos defaults do código e são
  // sobrepostos em-place por applyApiConstants quando /api/banks responde.
  // Consumidores leem window._SIM.CONST.* no momento da chamada (nunca copiar).
  window._SIM_CONST = clone(DEFAULTS);

  /**
   * Aplica as constantes vindas de /api/banks (raw.constants) mutando
   * window._SIM_CONST EM-PLACE — as referências estão capturadas por closures
   * e destructuring (ex. FINALIDADE_* em app.js), nunca reatribuir objetos.
   */
  function applyApiConstants(raw) {
    var c = raw && raw.constants;
    if (!c || typeof c !== "object") return;
    var C = window._SIM_CONST;
    // Merge profundo que preserva as referências dos objetos aninhados já
    // existentes (ex. regras.finalidadeAddon é o MESMO objeto que
    // _SIM.FINALIDADE_ADDON) — substituir apenas valores/arrays folha.
    function deepMerge(dst, src) {
      if (!dst || !src || typeof src !== "object" || Array.isArray(src)) return;
      for (var k in src) {
        var v = src[k];
        if (v && typeof v === "object" && !Array.isArray(v) &&
            dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) {
          deepMerge(dst[k], v);
        } else {
          dst[k] = (v && typeof v === "object") ? clone(v) : v;
        }
      }
    }
    function mergeArr(dst, src) {
      if (!Array.isArray(dst) || !Array.isArray(src) || !src.length) return;
      dst.splice.apply(dst, [0, dst.length].concat(clone(src)));
    }
    deepMerge(C.fiscal, c.fiscal);
    deepMerge(C.regras, c.regras);
    deepMerge(C.custos, c.custos);
    mergeArr(C.vida, c.vida);
    deepMerge(C.euriborFallback, c.euriborFallback);
    // FINALIDADE_* são registados em _SIM por core/constants.js e destructurados
    // no arranque de app.js — mutar também essas cópias em-place.
    var S = window._SIM || {};
    if (c.regras && c.regras.finalidadeAddon && S.FINALIDADE_ADDON) Object.assign(S.FINALIDADE_ADDON, c.regras.finalidadeAddon);
    if (c.regras && c.regras.finalidadeMaxLtv && S.FINALIDADE_MAX_LTV) Object.assign(S.FINALIDADE_MAX_LTV, c.regras.finalidadeMaxLtv);
  }

  window._SIM_SHARED = {
    applyApiConstants: applyApiConstants,
    FALLBACK_EUR: window._SIM_CONST.euriborFallback,
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
    // Deteção de dispositivo móvel por user-agent (avaliada uma vez no arranque).
    // Janelas estreitas em desktop mantêm a vista completa — só dispositivos
    // móveis reais recebem a vista compacta.
    isMobileDevice: (function () {
      try {
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean")
          return navigator.userAgentData.mobile;
        var ua = navigator.userAgent || "";
        if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) return true;
        // iPad com UA de desktop (iPadOS ≥13): Macintosh + ecrã táctil
        return /Macintosh/i.test(ua) && "ontouchstart" in window;
      } catch (_) {
        return false;
      }
    })(),
  };
})();
