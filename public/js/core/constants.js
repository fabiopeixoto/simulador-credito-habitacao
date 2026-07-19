/**
 * Constantes de domínio partilhadas (sem React) — registadas em window._SIM.
 * Carregar depois de inversa-bootstrap.js.
 * Nota: CONTRATO_FACTOR, FALLBACK_EUR, EUR_COLORS, LTV_BRACKETS e
 * BANK_DOMAINS continuam definidos em inversa-bootstrap.js / sim-shared-constants.js.
 */
;(function(){
"use strict";

// ── Spread adicional por finalidade ──────────────────────────────────────
// Inicializados a partir de _SIM_CONST.regras (fonte: sim-defaults.js) e
// mutados EM-PLACE por applyApiConstants quando a API responde — app.js
// destructura estas referências no arranque, nunca reatribuir os objetos.
const _regras = ((window._SIM_CONST||{}).regras)||{};
const FINALIDADE_ADDON = _regras.finalidadeAddon || { hpp: 0, hab2: 0.20, arrendamento: 0.30 };
const FINALIDADE_MAX_LTV = _regras.finalidadeMaxLtv || { hpp: 90, hab2: 80, arrendamento: 80, jovemHpp: 100 };

// Tabs do simulador principal
const NAV=[{id:"comp",icon:"📋",label:"Comparação"},{id:"seg",icon:"🛡️",label:"Seguros"},{id:"cust",icon:"💰",label:"Custos"},{id:"viab",icon:"📊",label:"Viabilidade"},{id:"cen",icon:"⚡",label:"Cenários"},{id:"amort",icon:"🔄",label:"Amortização"}];

window._SIM = Object.assign(window._SIM||{}, {FINALIDADE_ADDON,FINALIDADE_MAX_LTV,NAV});
})();
