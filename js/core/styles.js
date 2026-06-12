/**
 * Estilos de tabela e helpers de cor partilhados (sem React) — registados em
 * window._SIM. Carregar depois de inversa-bootstrap.js (que define as cores
 * base G/R/Au/N/Sky e EUR_COLORS).
 */
;(function(){
"use strict";
const S = window._SIM = window._SIM||{};
const G=S.G||"#16a34a", R=S.R||"#dc2626", Au=S.Au||"#2563eb";

// Taxa de esforço (DSTI): cor e rótulo
const ecC=ef=>ef<=35?G:ef<=40?Au:R;
const ecL=ef=>ef<=35?"Aprovável":ef<=40?"Limite":"Difícil";

// Estilos de tabela (th/td normais e compactos, fundos verde/vermelho)
const thS={padding:"6px 8px",textAlign:"left",color:"#374151",fontSize:11,letterSpacing:1,fontWeight:600,borderBottom:"1px solid rgba(37,99,235,0.22)",whiteSpace:"nowrap",verticalAlign:"bottom"};
const tdB={padding:"8px 9px"};
const tdG=i=>({...tdB,background:i===0?"rgba(74,222,128,0.09)":"rgba(74,222,128,0.035)",color:"#14532d"});
const tdR=i=>({...tdB,background:i===0?"rgba(248,113,113,0.09)":"rgba(248,113,113,0.03)",color:"#7f1d1d"});
const thSC={...thS,padding:"4px 6px"};
const tdBC={padding:"6px 6px"};
const tdGC=i=>({...tdBC,background:i===0?"rgba(74,222,128,0.09)":"rgba(74,222,128,0.035)",color:"#14532d"});
const tdRC=i=>({...tdBC,background:i===0?"rgba(248,113,113,0.09)":"rgba(248,113,113,0.03)",color:"#7f1d1d"});
const rbg=i=>i===0?"rgba(201,168,76,0.32)":i===1?"rgba(148,163,184,0.28)":i===2?"rgba(160,108,50,0.11)":"rgba(0,0,0,0.025)";

Object.assign(S,{ecC,ecL,thS,thSC,tdB,tdBC,tdG,tdGC,tdR,tdRC,rbg});
})();
