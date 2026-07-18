/**
 * Cálculos e formatação partilhados (sem React) — fonte única para todas as
 * páginas (simulador principal, transferência, inversa, histórico).
 * Regista tudo em window._SIM; carregar depois de inversa-bootstrap.js.
 */
;(function(){
"use strict";

// ── Formatação ────────────────────────────────────────────────────────────
const fE  = v => isFinite(v) ? Math.round(v).toLocaleString("pt-PT",{style:"currency",currency:"EUR",maximumFractionDigits:0}) : "—";
const fE2 = v => isFinite(v) ? v.toLocaleString("pt-PT",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}) : "—";
const fP  = v => isFinite(v) ? v.toFixed(3).replace(".",",")+"%" : "—";
const fP1 = v => v.toFixed(1).replace(".",",") + "%";

/** Margem orientativa vs simuladores oficiais (±5% na prestação total — ver docs/auditoria.md). */
function margemVsOficial(pt){const x=Number(pt);return isFinite(x)?Math.max(25,Math.round(x*0.05)):50;}

// ── Prestação mensal (anuidade) ───────────────────────────────────────────
function calcP(C,tanA,anos) {
  const r=tanA/100/12, n=anos*12;
  if(r===0||n===0) return n>0?C/n:0;
  return C*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
}

// ── TAEG — Taxa Anual de Encargos Efectiva Global ─────────────────────────
// Fórmula EU Directiva 2014/17/UE (transposta DL 74-A/2017):
// Capital = comIniciais_t0 + Σ(encargo_t / (1+r)^t, t=1..n)
// onde r = TAEG/12 (taxa mensal). Resolve por bissecção.
function calcTAEG(capital, comIniciais, encargo_mensal, n) {
  if(!capital||!encargo_mensal||!n) return 0;
  if(encargo_mensal * n <= capital) return 0;
  let lo=0.00001, hi=0.05;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2;
    const pv=encargo_mensal*(1-Math.pow(1+mid,-n))/mid;
    if(pv + comIniciais > capital) lo=mid; else hi=mid;
  }
  // Diretiva EU 2014/17/UE: TAEG = taxa anual efectiva = (1+r_mensal)^12 - 1
  return Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
}

// ── TAEG com carência — Directiva EU 2014/17/UE (duas fases) ─────────────
// Durante a carência pagam-se só juros (encargo_car); depois amortiza-se
// normalmente (encargo_amort). O PV de cada fase é descontado à taxa mensal r.
function calcTAEGWithCarencia(capital, comIniciais, encargo_car, n_car, encargo_amort, n_amort) {
  if(!capital||!encargo_amort||!n_amort) return 0;
  if(encargo_car*n_car + encargo_amort*n_amort <= capital) return 0;
  let lo=0.00001, hi=0.05;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2;
    const pv_car = n_car>0 ? encargo_car*(1-Math.pow(1+mid,-n_car))/mid : 0;
    const pv_amort = encargo_amort*(1-Math.pow(1+mid,-n_amort))/mid * Math.pow(1+mid,-n_car);
    if(pv_car + pv_amort + comIniciais > capital) lo=mid; else hi=mid;
  }
  return Math.round((Math.pow(1+(lo+hi)/2,12)-1)*10000)/100;
}

// ── MTIC — Montante Total Imputado ao Consumidor ─────────────────────────
// Tudo o que o cliente paga ao longo da vida do crédito
function calcMTIC(comIniciais, encargo_mensal, n) {
  return Math.round(comIniciais + encargo_mensal * n);
}

// ── IS sobre juros — crédito hipotecário a prazo fixo ────────────────────
// IS sobre a utilização de crédito (CIS Verba 17.1): 0,6% do capital em
// contrato (pago na escritura, incluído em isCredTAEG). Não há IS adicional
// sobre as prestações mensais para crédito hipotecário de prazo determinado.
function isJurosMedioMensal(capital, tanA, anos, finalidade) {
  return 0;
}

// ── Seguro de vida sobre capital médio em dívida ─────────────────────────
function vidaR(a){
  if(a<=25)return 0.0012; if(a<=30)return 0.0015; if(a<=35)return 0.0020;
  if(a<=40)return 0.0028; if(a<=45)return 0.0040; if(a<=50)return 0.0060;
  if(a<=55)return 0.0090; if(a<=60)return 0.0130; return 0.0180;
}
// Prémio mensal do seguro de vida — escalado pelo capital inicial e idade do titular.
// Usa capital inicial (não médio) para corresponder ao prémio da 1.ª prestação,
// que é o que os simuladores oficiais dos bancos apresentam na tabela.
function sVida(g,age,cap) {
  if(!g)return 0;
  return g.vRef*(cap/g.vCap)*(vidaR(age)/vidaR(g.vAge));
}
function sTot(g,a1,a2,is2,cap,val,anos) {
  if(!g)return {v1:0,v2:0,vTot:0,m:0,tot:0};
  const v1=sVida(g,a1,cap), v2=is2?sVida(g,a2,cap):0;
  const m=g.mAno*(val/g.pRef)/12;
  return {v1,v2,vTot:v1+v2,m,tot:v1+v2+m};
}

// IMT — tabelas OE 2026 (escalões atualizados, valores 2026)
function calcIMT(v,j,finalidade) {
  if(finalidade!=="hpp"){
    // Tabela II 2026: 2ª habitação e arrendamento (progressiva 1%→8%, flat 6% acima)
    if(v<=106346) return v*0.01;
    if(v<=145470) return v*0.02-1063.46;
    if(v<=198347) return v*0.05-5427.56;
    if(v<=330539) return v*0.07-9394.50;
    if(v<=633931) return v*0.08-12699.89;
    if(v<=1150853) return v*0.06;
    return v*0.075;
  }
  // Tabela I 2026: HPP
  // IMT Jovem (OE 2026, continente): isenção total até 330.539€; entre 330.539€ e 660.982€ taxa 8% só sobre o excedente; acima do teto parcial aplica-se a tabela normal (sem benefício)
  if(j){
    if(v<=330539)return 0;
    if(v<=660982)return(v-330539)*0.08;
  }
  if(v<=106346) return 0;
  if(v<=145470) return v*0.02-2126.92;
  if(v<=198347) return v*0.05-6491.02;
  if(v<=330539) return v*0.07-10457.96;
  if(v<=660982) return v*0.08-13763.35;
  if(v<=1150853) return v*0.06;
  return v*0.075;
}

// ── Amortização antecipada ────────────────────────────────────────────────
function simA(C,tanA,anos,extra) {
  const r=tanA/100/12, P=calcP(C,tanA,anos);
  let s=C,j=0,m=0;
  while(s>0.01&&m<anos*12){const ji=s*r;j+=ji;s-=(P-ji);m++;if(extra>0&&m%12===0)s=Math.max(0,s-extra);}
  return{meses:m,juros:j,economia:Math.max(0,P*anos*12-C-j),poupados:anos*12-m};
}
function amChart(C,tanA,anos,extra) {
  const r=tanA/100/12, P=calcP(C,tanA,anos);
  let s1=C,s2=C; const d=[{ano:0,"Com amort.":C,"Sem amort.":C}];
  for(let m=1;m<=anos*12;m++){
    s1=Math.max(0,s1-(P-s1*r)); s2=Math.max(0,s2-(P-s2*r));
    if(extra>0&&m%12===0)s1=Math.max(0,s1-extra);
    if(m%12===0)d.push({ano:m/12,"Com amort.":Math.round(s1),"Sem amort.":Math.round(s2)});
  }
  return d;
}

// Prestação durante carência (só juros)
function prestacaoCarencia(C, tanA) { return C * tanA/100/12; }

// ── Escalões de spread por LTV ────────────────────────────────────────────
// spread adicional sobre o spread base conforme o LTV.
// Lê window._SIM.LTV_BRACKETS no momento da chamada — a API actualiza os
// escalões em runtime (ver loadRates em app.js).
function getLTVAddon(bankS, ltv) {
  const brackets = ((window._SIM||{}).LTV_BRACKETS||{})[bankS] || [];
  for (const b of brackets) { if (ltv <= b.max) return b.add; }
  return 0.15; // acima de todos os escalões
}

window._SIM = Object.assign(window._SIM||{}, {
  fE,fE2,fP,fP1,margemVsOficial,
  calcP,calcTAEG,calcTAEGWithCarencia,calcMTIC,isJurosMedioMensal,vidaR,sVida,sTot,calcIMT,
  simA,amChart,prestacaoCarencia,getLTVAddon,
});
})();
