/**
 * Constantes de domínio partilhadas (sem React) — registadas em window._SIM.
 * Carregar depois de inversa-bootstrap.js.
 * Nota: CONTRATO_FACTOR, FALLBACK_EUR, EUR_COLORS, LTV_BRACKETS e
 * BANK_DOMAINS continuam definidos em inversa-bootstrap.js / sim-shared-constants.js.
 */
;(function(){
"use strict";

// ── Spread adicional por finalidade ──────────────────────────────────────
const FINALIDADE_ADDON = {
  hpp:    0,     // Habitação Própria Permanente
  hab2:   0.20,  // Segunda habitação (típico: +0,10% a +0,30%)
  arrendamento: 0.30,
};
const FINALIDADE_MAX_LTV = {
  hpp:    90,    // HPP: máx 90% (ou 100% jovem)
  hab2:   80,    // 2.ª habitação: máx 80%
  arrendamento: 80,
};

// Tabs do simulador principal
const NAV=[{id:"comp",icon:"📋",label:"Comparação"},{id:"seg",icon:"🛡️",label:"Seguros"},{id:"cust",icon:"💰",label:"Custos"},{id:"viab",icon:"📊",label:"Viabilidade"},{id:"cen",icon:"⚡",label:"Cenários"},{id:"amort",icon:"🔄",label:"Amortização"}];

window._SIM = Object.assign(window._SIM||{}, {FINALIDADE_ADDON,FINALIDADE_MAX_LTV,NAV});
})();
