;(function(){
if(!window.React||!window.Recharts)return;try{
const { useState, useEffect, useMemo, useCallback } = React;
const { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } = Recharts;

// ── Euribor fallback (maio 2026) ──────────────────────────────────────────
const FALLBACK_EUR = {
  "3m":  { valor: 2.209, data: "maio 2026" },
  "6m":  { valor: 2.541, data: "maio 2026" },
  "12m": { valor: 2.860, data: "maio 2026" },
};
const FALLBACK_BANK_DATA = {
  // Offline / primeira pintura: espelhar api/banks.js SEED_SPREADS; em produção GET /api/banks (SQLite) é a fonte.
  CA:    {sCom:0.70,sSem:1.83,mCom:3.45,mSem:4.58,fCom:4.70,fSem:5.83,jsCom:0.75,jsSem:1.88,promoPeriodo:24,promoSpread:0.45, dossier:250,avaliacao:200,contaMes:3.50,capMin:25000, capMax:2000000,vRef:22.68,mAno:160,minutas:0,  jovemIsenta:true}, // PRE-FT particulares mai.2026 §18.1: CH «CA Dedicado» Euribor 1/3/6/12m + spread 0,70–1,83% (aquisição); mista 2a base 2,50%+0,85% e fase var. 0,70–1,83%; fixa 5/10/15a TAN 4,70–5,83%. CH Jovem aquisição desde 0,75%; ex. TAEG 30a spread 1,88% (Nota 1e). E12 ilustr. 2,747% abr.2026. Campanha spread 0,45% 24m. 18–30a: isenção abertura+DO nos ex. TAEG jovem. BANKS_STATIC refs 3/6/12m (app não tem série 1m)
  CTT:   {sCom:0.85,sSem:1.45,mCom:3.05,mSem:3.65,fCom:4.10,fSem:4.70,jsCom:0.75,jsSem:1.35,jmCom:2.75,jmSem:3.35,jfCom:3.95,jfSem:4.55,promoPeriodo:0, promoSpread:null,dossier:280, avaliacao:230,contaMes:1.73,capMin:25000, capMax:1000000,vRef:21.51,mAno:207.12,minutas:160,jovemIsenta:false}, // FINE mai.2026 (bancoctt.pt): variável E3/6/12m spread 0,85%/1,45% c/s prod.; mista 2a TAN 3,05%/3,65%; fixa 30a TAN 4,10%/4,70%. CHjovem DL44: var. 0,75%/1,35%; mista 2,75%/3,35%; fixa 3,95%/4,55% (campos jmCom/jfCom). Seguro vida 258,12€/a (var., 150k, 30a); multi 207,12€/a (200k) — Generali Seguros, S.A. Conta ≈1,73€/mês. Comissões: dossier 280€+IS, aval.230€+IS, minutas 160€+IS
  BNKTR: {sCom:0.70,sSem:1.05,mCom:2.90,mSem:3.25,fCom:3.45,fSem:3.80,jsCom:0.62,jsSem:0.97,promoPeriodo:24,promoSpread:null,dossier:350,avaliacao:250,contaMes:0,   capMin:100000,capMax:3000000,vRef:33.28,mAno:196,minutas:0,  jovemIsenta:false}, // Normal verif. simulador Bankinter 2026 (prints): spr 0,70%/1,05% c/ pack Vida+Multi+Dom. (Δ0,35pp); 180k/30a E3→746,81€ · E6→773,92€ · E12→802,96€. CH Jovem (js): estim. −0,08pp até print próprio
  ABANCA:{sCom:0.70,sSem:1.70,mCom:3.45,mSem:4.45,fCom:2.70,fSem:3.50,jsCom:0.58,jsSem:1.58,promoPeriodo:0, promoSpread:null,dossier:520,avaliacao:286,contaMes:6.24,capMin:5000,  capMax:2000000,vRef:16.76,mAno:154,minutas:0,  jovemIsenta:true}, // PRE-FT mai.2026 §18.1 CH Valor+/Reg. Geral: spread Euribor 12m +0,70% a +1,70% (Nota 5: valores c/ redução máx. produtos); TAN ilustr. E12 2,747% (abr.2026)+spread; 1.º ano taxa fixa 2,50–3,50%. Nota 1 FINE: formalização 520€, avaliação 286€, conta 6,24€. Nota 3: financiamento mín. 5k€. PRE-FC mar.2026: avaliação imóvel residencial 275€+IS4%≈286€
  BCP:   {sCom:0.70,sSem:1.50,mCom:3.45,mSem:4.25,fCom:4.10,fSem:4.65,jsCom:0.85,jsSem:1.50,promoPeriodo:24,promoSpread:0,  dossier:300,avaliacao:250,contaMes:5.00,capMin:20000, capMax:3000000,vRef:19.92,mAno:256,minutas:0,  jovemIsenta:true}, // SECCAO_18.pdf (mai.2026): CH c/ garantia variável E6/E12 + spread 0,70–1,50%; TAN ilustr. E12 2,747% (abr.2026)+spread; taxa fixa 5a/25a 4,10%/4,65% (notas TAEG). CH Jovem: spr 0,85%/1,50% verif. simulador 2026 (200k/30a). FINE: comissões iniciais 748,80€ (dossier+formalização+avaliação) — modelo interno 300+250
  ACTVO: {sCom:0.75,sSem:1.50,mCom:3.85,mSem:4.75,fCom:4.00,fSem:4.75,jsCom:0.68,jsSem:1.38,promoPeriodo:24,promoSpread:0,  dossier:300,avaliacao:250,contaMes:0,   capMin:20000, capMax:3000000,vRef:19.84,mAno:256,minutas:0,  jovemIsenta:true}, // §18.1 mai.2026 (activobank.pt): variável sCom 0,75%/sSem 1,50%; mista 24m TAN 3,85% c/ prod. / 4,75% s/ prod.; taxa fixa TAN 4,00% c/ prod. / 4,75% s/ prod. Banco digital sem comissão de conta
  BPI:   {sCom:0.75,sSem:1.50,mCom:3.20,mSem:3.95,fCom:4.10,fSem:4.85,jsCom:0.75,jsSem:1.50,promoPeriodo:0, promoSpread:null,dossier:290,avaliacao:230,contaMes:4.90,capMin:25000, capMax:3000000,vRef:13.12,mAno:195,minutas:190,jovemIsenta:true}, // FINE CH (contentservice UCM01004994): E6+spread 0,75%/1,50% c/ e s/ vendas associadas facultativas; mista mesma fase var.; fixa ilustr. 30a 4,10%/4,85% (70% LTV). CH Jovem DL44 (bpi.pt/credito-habitacao-jovem, mai.2026): mesmos spreads na var.; fixa ilustr. 3,95%/4,70% (100% + garantia Estado). Dossier 290€, aval. 230€+IS, minutas 190€ (campanha FINE)
  MNTPO: {sCom:0.70,sSem:2.30,mCom:3.05,mSem:4.75,fCom:4.50,fSem:5.90,jsCom:0.58,jsSem:1.38,promoPeriodo:0, promoSpread:null,dossier:312,avaliacao:239,contaMes:3.11,capMin:10000, capMax:2000000,vRef:8.29, mAno:79, minutas:0,  jovemIsenta:false}, // §18.1 mai.2026 (bancomontepio.pt): variável EUR 3M/6M/12M + spread 0,70–2,30%; mista 2a TAN 3,05% c/ prod. (base 2,35%+spr 0,70%); taxa fixa TAN ~4,50% c/ prod. / ~5,90% s/ prod. (PDF inacessível, estimativa). Comissões 300€+IS/230€+IS≈312/239€. Conta Base c/ dom. ≈3,11€/mês. BANKS_STATIC refs 3/6/12m
  SANTR: {sCom:0.80,sSem:1.90,mCom:3.25,mSem:4.35,fCom:4.40,fSem:4.40,jsCom:0.80,jsSem:1.90,promoPeriodo:36,promoSpread:0,  dossier:725,avaliacao:230,contaMes:2.90,capMin:30000, capMax:3000000,vRef:22.55,mAno:246,minutas:0,  jovemIsenta:false}, // FINE CH particulares (abr.2026): E6 2,454%+spread 0,80%/1,90% → TAN var. 3,254%/4,354%; mista fase var. idem; taxa fixa ilustr. 4,40% (10/20/30a). Formalização 725€, avaliação 230€ (TAEG). Jovens: garantia Estado DL44 + isenções fiscais/emolumentos (§4, §8–9) — mesmo spread nos exemplos
  NB:    {sCom:0.75,sSem:1.70,mCom:3.65,mSem:4.60,fCom:3.71,fSem:5.99,jsCom:0.65,jsSem:1.60,promoPeriodo:0, promoSpread:null,dossier:333,avaliacao:322,contaMes:8.22,capMin:10000, capMax:3000000,vRef:17.55,mAno:98, minutas:0,  jovemIsenta:true}, // PRE-FT mai.2026 §18.1 CH indexada/mista: spread Euribor+0,75% a +1,70%; dossier 320€+IS4%≈333€; avaliação 310€+IS4%≈322€ (PRE-FC fev.2026). TAN fixa 3,712–5,996% (quadro CH fixo). Euribor 12m ilustr. 2,747% (abr.2026). capMin 10k€ no preçário (simulador pode exigir mais)
  // CGD: Medida Jovem — POST simuladorch.cgd.pt (2026-05-10): LTV>90% → spr base 2,35%/cond.1,65%; LTV≤90% → 1,35%/0,65% (imóvel≥valorRef). Ver apply em BANKS useMemo.
  CGD:   {sCom:0.70,sSem:2.90,mCom:3.15,mSem:5.35,fCom:4.75,fSem:6.95,jsCom:0.65,jsSem:1.35,promoPeriodo:24,promoSpread:null,dossier:250,avaliacao:200,contaMes:6.30,capMin:5000,  capMax:3000000,vRef:29.82,mAno:110,minutas:0,  jovemIsenta:true}, // Folheto taxas 18.pdf particulares (mai.2026): CH Regime Geral E6+0,70% a +2,90%; E6 ilustr. 2,454%; TAN mista/fixa alinh. taxa base 30a 4,05%+spread. Montante mín. 5k€. Medida Jovem: spreads 0,65/1,35 no useMemo (simulador). Comissões dossier/avaliação: folheto 10.pdf é «Outros clientes» — valores mantidos
  UCI:   {sCom:1.43,sSem:2.30,mCom:4.09,mSem:4.09,fCom:4.39,fSem:4.39,jsCom:1.43,jsSem:2.30,promoPeriodo:0, promoSpread:null,dossier:600,avaliacao:225,contaMes:0,   capMin:12500, capMax:1000000,vRef:19.00,mAno:150,minutas:400,  jovemIsenta:false}, // §18.1 mai.2026 (uci.pt/bisonbank): variável E6 spread 1,43–2,30%; mista 5a TAN 4,09% / 10a TAN 4,29%; taxa fixa 10a TAN 4,39%. Sem diferenciação c/s produtos (mSem=mCom, fSem=fCom). PRE-FC mar.2026: abertura máx.600€+IS, aval.225€+IS, prep.doc.400€+IS. Montante 12,5k–1M€
  BNI:   {sCom:2.00,sSem:3.10,mCom:4.45,mSem:5.55,fCom:5.30,fSem:6.20,jsCom:2.00,jsSem:3.10,promoPeriodo:0, promoSpread:null,dossier:750,avaliacao:200,contaMes:3.00,capMin:25000, capMax:1000000,vRef:19.00,mAno:150,minutas:0,  jovemIsenta:false}, // §18.1 taxas mai.2026: CH c/ garantia hipotecária Euribor 3/6/12m + spread 2,0–3,1% (fin./garantia ≤80%); E6 abr.2026 2,454%+2,0/3,1%→TAN 4,454%/5,554% nos ex. TAEG. Mista: TAN fixa ilustr. 24m 5,299%/6,199% + mesma fase var. Comissões §2.1: estudo 0,5% mín.750€ máx.2500€ +IS; avaliação 200€+IS. js: sem linha jovem no PDF — igual ao quadro geral
  BEST:  {sCom:0.90,sSem:1.90,mCom:3.65,mSem:4.60,fCom:4.41,fSem:5.99,jsCom:0.90,jsSem:1.90,promoPeriodo:0, promoSpread:null,dossier:333,avaliacao:322,contaMes:8.84,capMin:10000, capMax:1800000,vRef:17.55,mAno:123,minutas:0,  jovemIsenta:false}, // Intermediário de crédito Novo Banco (entidade mutuante NB; mai.2026). sSem confirmado via ex. TAEG: E6 3,002%+1,90%→TAN 4,902%. sCom est. alinhado ao produto NB (0,90% spread mínimo). Conta 360° 8,84€/mês IS incluído. Seguros NB: GamaLife (vida) + Mudum (multi). Cap. máx. 1,8M€. Sem linha CH Jovem.
};
const CACHE_KEY   = "credito_cache_v13";
const CACHE_H     = 8;
const HIST_KEY    = 'simulador-hist-v1';
const HIST_MAX  = 5;

// ── Seguros ───────────────────────────────────────────────────────────────
const SEG = {
  CA:    {vRef:22.68,vCap:150000,vAge:30,insV:"CA Seguros",       mAno:160, pRef:200000,insM:"CA Seguros"},
  CTT:   {vRef:21.51,vCap:150000,vAge:30,insV:"Generali Seguros, S.A.",mAno:207.12,pRef:200000,insM:"Generali Seguros, S.A."},
  BNKTR: {vRef:33.28,vCap:150000,vAge:36,insV:"Bankinter Seguros",mAno:196, pRef:200000,insM:"Bankinter Seguros"},
  ABANCA:{vRef:16.76,vCap:150000,vAge:30,insV:"Abanca Seguros",   mAno:154, pRef:200000,insM:"Abanca Seguros"},
  BCP:   {vRef:19.92,vCap:150000,vAge:30,insV:"Ocidental Vida",   mAno:256, pRef:200000,insM:"Ageas/Ocidental"},
  ACTVO: {vRef:19.84,vCap:150000,vAge:30,insV:"Ocidental Vida",   mAno:256, pRef:200000,insM:"Ageas/Ocidental"},
  BPI:   {vRef:13.12,vCap:150000,vAge:30,insV:"BPI Vida",         mAno:195, pRef:200000,insM:"BPI Seguros"},
  MNTPO: {vRef: 8.29,vCap:100000,vAge:30,insV:"Lusitania Vida",   mAno: 79, pRef:100000,insM:"Lusitania"},
  SANTR: {vRef:22.55,vCap:150000,vAge:30,insV:"Santander Seguros",mAno:246, pRef:200000,insM:"Santander Seguros"},
  NB:    {vRef:17.55,vCap:150000,vAge:30,insV:"GamaLife",         mAno: 98, pRef:200000,insM:"Mudum"},
  CGD:   {vRef:29.82,vCap:150000,vAge:30,insV:"Fidelidade",       mAno:110, pRef:200000,insM:"Fidelidade Casa"},
  UCI:   {vRef:19.00,vCap:150000,vAge:30,insV:"(est.)",           mAno:150, pRef:200000,insM:"(est.)"},
  BNI:   {vRef:19.00,vCap:150000,vAge:30,insV:"(est.)",           mAno:150, pRef:200000,insM:"(est.)"},
  BEST:  {vRef:17.55,vCap:150000,vAge:30,insV:"GamaLife",         mAno:123, pRef:200000,insM:"Mudum"},
};

// ── Comissões por banco (dossier + avaliação + preparação minutas) ─────────
// Fonte: preçários oficiais e FINE publicadas (maio 2026)
const COM = {
  CA:    {dossier:250,  avaliacao:200, minutas:0,   total2hab:450,  jovemIsenta:true},
  CTT:   {dossier:280, avaliacao:230, minutas:160, total2hab:670,  jovemIsenta:false},
  BNKTR: {dossier:350,  avaliacao:250, minutas:0,   total2hab:600,  jovemIsenta:false},
  ABANCA:{dossier:520,  avaliacao:286, minutas:0,   total2hab:806,  jovemIsenta:true},
  BCP:   {dossier:300,  avaliacao:250, minutas:0,   total2hab:550,  jovemIsenta:true},   // isenta ≤35a
  ACTVO: {dossier:300,  avaliacao:250, minutas:0,   total2hab:550,  jovemIsenta:true},
  BPI:   {dossier:290,  avaliacao:230, minutas:190, total2hab:710,  jovemIsenta:true},
  MNTPO: {dossier:312,  avaliacao:239, minutas:0,   total2hab:551,  jovemIsenta:false},
  SANTR: {dossier:725,  avaliacao:230, minutas:0,   total2hab:955,  jovemIsenta:false},
  NB:    {dossier:333,  avaliacao:322, minutas:0,   total2hab:655,  jovemIsenta:true},
  CGD:   {dossier:250,  avaliacao:200, minutas:0,   total2hab:450,  jovemIsenta:true},
  UCI:   {dossier:600,  avaliacao:225, minutas:400, total2hab:1225, jovemIsenta:false},
  BNI:   {dossier:750,  avaliacao:200, minutas:0,   total2hab:950,  jovemIsenta:false},
  BEST:  {dossier:333,  avaliacao:322, minutas:0,   total2hab:655,  jovemIsenta:false},
};

// ── Escalões de spread por LTV (verificados Mai.2026) ────────────────────
// spread adicional sobre o spread base conforme o LTV
// padrão de mercado: ≤80%→+0, 80-90%→+0.05pp, >90%→+0.10pp
// BNI: não financia acima de 90%; BNKTR: escalonamento mais conservador a partir de 75%
const LTV_BRACKETS = {
  CA:    [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  CTT:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  BNKTR: [{max:75,add:0},{max:80,add:0.05},{max:90,add:0.10},{max:100,add:0.15}],
  ABANCA:[{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  BCP:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  ACTVO: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  BPI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  MNTPO: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  SANTR: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  NB:    [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  CGD:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  UCI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  BNI:   [{max:80,add:0},{max:90,add:0.10}],
  BEST:  [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
};

function getLTVAddon(bankS, ltv) {
  const brackets = LTV_BRACKETS[bankS] || [];
  for (const b of brackets) { if (ltv <= b.max) return b.add; }
  return 0.15; // acima de todos os escalões
}

// ── Limites de capital por banco ─────────────────────────────────────────
const CAPITAL_LIMITS = {
  CA:    {min:25000,  max:2000000},
  CTT:   {min:25000,  max:1000000},
  BNKTR: {min:100000, max:3000000}, // Bankinter mín. €100k!
  ABANCA:{min:5000,   max:2000000}, // Nota 3 PRE-FT mai.2026: montante mínimo CH 5k€
  BCP:   {min:20000,  max:3000000},
  ACTVO: {min:20000,  max:3000000},
  BPI:   {min:25000,  max:3000000},
  MNTPO: {min:10000,  max:2000000}, // Preçário CH (mai.2026): mín. 10k€ com garantia hipotecária
  SANTR: {min:30000,  max:3000000},
  NB:    {min:10000,  max:3000000}, // Preçário NB: mín. 10k€ (CH §18.1); comparador pode usar montantes maiores
  CGD:   {min:5000,   max:3000000}, // Folheto 18.pdf (mai.2026): montante mínimo CH 5k€
  UCI:   {min:12500,  max:1000000},
  BNI:   {min:25000,  max:1000000},
  BEST:  {min:10000,  max:1800000},
};

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

// ── Comissão mensal de manutenção de conta (obrigatória para vinculação) ──
// Fonte: FINE publicadas e preçários oficiais (maio 2026)
// Incluída no cálculo TAEG conforme Directiva 2014/17/UE
const CONTA_MES = {
  CA:    {val:3.50,  nota:"Manutenção DO nos exemplos TAEG §18.1; valor mensal estimado (PRE-FT mai.2026)"},
  CTT:   {val:1.73, nota:"Conta à ordem — 20€/ano + IS 4% nos exemplos TAEG (precário mai.2026) ≈ 1,73€/mês"},
  BNKTR: {val:0,     nota:"Sem comissão de conta obrigatória"},
  ABANCA:{val:6.24,  nota:"Conta à ordem — exemplo FINE Nota 1 (mai.2026): 6,24€/mês incl. IS"},
  BCP:   {val:5.00,  nota:"Conta Millennium (estimativa; manutenção mensal fora do §18.1 CH no SECCAO_18 analisado)"},
  ACTVO: {val:0,     nota:"Banco digital — sem comissão"},
  BPI:   {val:4.90,  nota:"Conta Pacote BPI (estimativa; manutenção mensal fora da TAEG nos exemplos FINE CH)"},
  MNTPO: {val:3.11,  nota:"Conta Base c/ domiciliação ordenado 2,99€/mês + IS 4% ≈ 3,11€ (PRE-FC mai.2026)"},
  SANTR: {val:2.90,  nota:"Conta (estimativa; manutenção mensal fora da TAEG nos exemplos FINE CH)"},
  NB:    {val:8.22,  nota:"Conta Pacote (fam. 100%) 7,90€/mês + IS 4% ≈ 8,22€ (PRE-FC fev.2026)"},
  CGD:   {val:6.30,  nota:"Conta Caixadirecta €6,30/mês IS incluído (sem linha dedicada no 18.pdf de taxas CH)"},
  UCI:   {val:0,     nota:"Sem conta obrigatória"},
  BNI:   {val:3.00,  nota:"Conta DO (estimativa; manutenção fora do quadro §18.1 taxas mai.2026)"},
  BEST:  {val:8.84,  nota:"Conta 360° 8,84€/mês IS incluído (est.; intermediário NB — PRE-FC mai.2026)"},
};
// Os bancos aplicam um factor de correcção ao rendimento declarado
const CONTRATO_FACTOR = {
  efetivo:  1.00,  // Contrato sem termo — 100%
  termo:    0.90,  // Contrato a termo certo — ~90%
  parcial:  0.80,  // Part-time
  recibo:   0.70,  // Trabalhador independente / recibos verdes — ~70%
  pensao:   1.00,  // Pensão/reforma — 100%
};

// ── Bancos estáticos ──────────────────────────────────────────────────────
const BANKS_STATIC = [
  {name:"Crédito Agrícola", s:"CA",    color:"#2d6a2d", refs:["3m","6m","12m"], jOk:true,  carenciaMax:0,  tipos:["variável","mista","fixa"], promos:["CH CA Dedicado: spread 0,70–1,83% (PRE-FT: Euribor 1/3/6/12m; simulador 3/6/12m)", "Spread promocional 0,45% primeiros 24m","Taxa fixa ilustr. 4,70–5,83% (5/10/15a)"], prod:"Dom. ordenado + Seg. Vida CA + Multirriscos CA",                          jProd:"18–30a: isenção comissão abertura + manutenção DO nos exemplos TAEG"},
  {name:"Banco CTT",        s:"CTT",   color:"#e30613", refs:["3m","6m","12m"], jOk:true,  carenciaMax:0,  tipos:["variável","mista","fixa"],  promos:["Spread CH Normal: 0,85% c/ prod. / 1,45% s/ prod. (Euribor 3/6/12m)","Mista 2a: TAN 3,05% c/ prod. / 3,65% s/ prod.","Taxa fixa 30a: TAN 4,10% c/ prod. / 4,70% s/ prod.","CH Jovem DL44: var. 0,75%/1,35%; mista 2,75%/3,35%; fixa 3,95%/4,55%"], prod:"Seg. Vida + Multirriscos + Dom. CTT (Generali Seguros, S.A.)",              jProd:"CH Jovem: var. 0,75% c/ prod.; mista 2,75%; fixa 3,95% (Garantia Estado DL44/2024)"},
  {name:"Bankinter",        s:"BNKTR", color:"#f7941d", refs:["3m","6m","12m"], jOk:true,  carenciaMax:12, tipos:["variável","mista","fixa"], promos:["Crédito normal: spr.mín. 0,70% c/ pack (−0,35pp vs sem) — verif. simulador","CH Jovem ≤35: spread estim. mais favorável (−0,08pp vs normal)","Euribor 3m · 6m · 12m","Aceita seguros externos"],                                                  prod:"Seg. Vida + Multirriscos + Dom. ordenado",                               jProd:"TAN fixa 2,25% 2 anos; 100% garantia Estado"},
  {name:"Abanca",           s:"ABANCA",color:"#00529b", refs:["6m","12m"],       jOk:true,  carenciaMax:0,  tipos:["variável","mista"],         promos:["Indexante Euribor 6m ou 12m","Taxa fixa 2,70% 1.º/2.º ano"],                                                                                   prod:"Dom. ≥1.000€ + Seg. Vida + Multi + Cartão",                              jProd:"TAN fixa 2,70% 1.º ano → spread 0,70%"},
  {name:"Millennium BCP",   s:"BCP",   color:"#c8102e", refs:["3m","6m","12m"], jOk:true,  carenciaMax:0,  tipos:["variável","mista","fixa"], promos:["CH: spread 0,70–1,50% (SECCAO_18 mai.2026)","CH Jovem: 0,85%/1,50% (verif. simulador)","Spread 0% primeiros 2 anos","Isenção comissões ≤35a","3 indexantes"],                                              prod:"Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas",      jProd:"Promo 24m + packs; isenção comissões ≤35a"},
  {name:"ActivoBank",       s:"ACTVO", color:"#6d1e8a", refs:["3m","6m","12m"], jOk:true,  carenciaMax:0,  tipos:["variável","mista","fixa"],  promos:["Spread 0% primeiros 2 anos (mista 24m)","3 indexantes (E3/E6/E12)","Taxa fixa: TAN 4,00% c/ prod. / 4,75% s/ prod."],   prod:"Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas",      jProd:"Spread 0% 2 anos; taxa fixa disponível; 100% garantia Estado"},
  {name:"Banco BPI",        s:"BPI",   color:"#005ca9", refs:["6m"],            jOk:true,  carenciaMax:0,  tipos:["variável","mista","fixa"], promos:["Spread CH 0,75–1,50% (FINE; redução máx. 75 p.b. vendas associadas)","CH Jovem DL44: mesmos spreads na var.; TAN fixa ilustr. mais baixa","Aceita seguradora externa"], prod:"Seg. Vida BPI + Multirriscos BPI (ou externa sem bonif.)",                jProd:"Garantia Estado até 100% (≤35a); isenções comissões iniciais em campanha"},
  {name:"Banco Montepio",   s:"MNTPO", color:"#7a0f2e", refs:["3m","6m","12m"], jOk:true,  carenciaMax:24, tipos:["variável","mista","fixa"],  promos:["CH §18.1: Euribor 3/6/12m + spread 0,70–2,30%","Mista 2a: TAN 3,05% c/ prod.","Taxa fixa: TAN ~4,50% c/ prod. / ~5,90% s/ prod.","Cashback 1,5%"],           prod:"Conta Ordenado + Cartão ≥500€/sem + Seg. Vida + Multirriscos Lusitania", jProd:"100% garantia Estado; taxa fixa disponível; cashback 1,5%"},
  {name:"Santander",        s:"SANTR", color:"#ec0000", refs:["6m"],            jOk:true,  carenciaMax:12, tipos:["variável","mista","fixa"], promos:["Spread 0% 3 anos (c/prod.) → 0,80% (FINE)","Spread base 1,90% s/ pack (FINE)","Garantia Estado ≤35a (DL44) + benefícios fiscais jovem"],                                                                             prod:"Cartão créd.≥300€ + Seg. Vida + Multirriscos Santander",                 jProd:"Garantia Estado até 100%; isenções IMT/selo/emol. (Lei 30-A/2024, DL48-D) — ver FINE"},
  {name:"Novo Banco",       s:"NB",    color:"#00a651", refs:["3m","6m","12m"], jOk:true,  carenciaMax:24, tipos:["variável","mista","fixa"], promos:["Euribor 3m · 6m · 12m","Cashback 1%","Mudum — multirriscos mais barato"],                                                                   prod:"Pack 1.º Banco (dom.) + GamaLife + Mudum",                               jProd:"100% financiamento; cashback 1%"},
  {name:"CGD",              s:"CGD",   color:"#006633", refs:["6m"],            jOk:true,  carenciaMax:0,  tipos:["variável","mista","fixa"], promos:["Banco público","CH Reg. Geral: E6 + spread 0,70%–2,90% (folh. 18)","Medida Jovem: spreads no simulador CGD","Cert. A/B: -0,15%"],                       prod:"Pack Vinculação + Pack Ligação (Fidelidade Vida + Multi)",                jProd:"Reg. Geral E6+0,70–2,90% (mai.2026); Medida Jovem 0,65% no simulador oficial"},
  {name:"UCI",              s:"UCI",   color:"#1a3a6b", refs:["6m"],            jOk:true,  carenciaMax:0,  tipos:["variável","mista"],         promos:["CH variável: E6 + spread 1,43–2,30% (§18.1 mai.2026)","Mista: TAN 4,09% (5a) / 4,29% (10a fixo + E6)","Fixa até 10a (prazo máx): TAN 4,39% — não simulada (prazo curto)","Montante 12,5k–1M€","Sem conta obrigatória"], prod:"Seg. Vida + Multirriscos",  jProd:"100% c/ garantia Estado (condições UCI)"},
  {name:"BNI Europa",       s:"BNI",   color:"#4a235a", refs:["3m","6m","12m"], jOk:false, carenciaMax:0,  tipos:["variável","mista","fixa"], promos:["CH: spread 2,0–3,1% (Euribor 3/6/12m; §18.1 mai.2026)","Mista ilustr. 24m + variável (notas TAEG)","Estudo 0,5% (mín. 750€) + avaliação 200€"], prod:"Domiciliação + Seguros",                                                 jProd:"Sem CH Jovem no §18.1 analisado"},
  {name:"Banco Best",        s:"BEST",  color:"#e85520", refs:["3m","6m","12m"], jOk:false, carenciaMax:24, tipos:["variável","mista","fixa"], promos:["Intermediário Novo Banco (entidade mutuante NB)","CH variável: E3/E6/E12m + spread 0,90–1,90% (mai.2026)","GamaLife + Mudum (mesmos seguros que NB)"],                                                         prod:"Conta 360° + Dom. ordenado + Seg. Vida GamaLife + Multirriscos Mudum",  jProd:"Sem linha de CH Jovem dedicada"},
];

// ── Helpers matemáticos ───────────────────────────────────────────────────
const fE  = v => isFinite(v) ? Math.round(v).toLocaleString("pt-PT",{style:"currency",currency:"EUR",maximumFractionDigits:0}) : "—";
const fE2 = v => isFinite(v) ? v.toLocaleString("pt-PT",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}) : "—";
const fP  = v => isFinite(v) ? v.toFixed(3).replace(".",",")+"%" : "—";
const fP1 = v => v.toFixed(1).replace(".",",") + "%";
/** Margem orientativa vs simuladores oficiais (±5% na prestação total — AUDITORIA). */
function margemVsOficial(pt){const x=Number(pt);return isFinite(x)?Math.max(25,Math.round(x*0.05)):50;}

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
  return Math.round((lo+hi)/2*12*10000)/100;
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


// IMT — tabelas Portaria 352/2024 (valores 2025)
function calcIMT(v,j,finalidade) {
  if(finalidade!=="hpp"){
    // Tabela II 2025: 2ª habitação e arrendamento (progressiva 1%→8%, flat 6% acima)
    if(v<=99407)  return v*0.01;
    if(v<=136025) return v*0.02-994.07;
    if(v<=185474) return v*0.05-5074.82;
    if(v<=309140) return v*0.07-8784.30;
    if(v<=618313) return v*0.08-11875.70;
    return v*0.06;
  }
  // Tabela I 2025: HPP
  // IMT Jovem (OE 2026, continente): isenção total até 330.539€; entre 330.539€ e 660.982€ taxa 8% só sobre o excedente; acima do teto parcial aplica-se a tabela normal (sem benefício)
  if(j){
    if(v<=330539)return 0;
    if(v<=660982)return(v-330539)*0.08;
  }
  if(v<=99407)  return 0;
  if(v<=136025) return v*0.02-1988.14;
  if(v<=185474) return v*0.05-6069.39;
  if(v<=309140) return v*0.07-9778.87;
  if(v<=618313) return v*0.08-12869.52;
  return v*0.06;
}

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

// ── Domínios dos bancos (para favicon) ────────────────────────────────────
const BANK_DOMAINS={CA:"creditoagricola.pt",CTT:"ctt.pt",BNKTR:"bankinter.pt",ABANCA:"abanca.com",BCP:"millenniumbcp.pt",ACTVO:"activobank.pt",BPI:"bpi.pt",MNTPO:"bancomontepio.pt",SANTR:"santander.pt",NB:"novobanco.pt",CGD:"cgd.pt",UCI:"uci.es",BNI:"bnieuropa.pt",BEST:"bancobest.pt"};
// ── Cores e estilos ───────────────────────────────────────────────────────
const G="#16a34a",R="#dc2626",Au="#2563eb",N="#e5e7eb",Sky="#0284c7";
const ecC=ef=>ef<=35?G:ef<=40?Au:R;
const ecL=ef=>ef<=35?"Aprovável":ef<=40?"Limite":"Difícil";
const thS={padding:"6px 8px",textAlign:"left",color:"#4b5563",fontSize:11,letterSpacing:1,fontWeight:600,borderBottom:"1px solid rgba(37,99,235,0.22)",whiteSpace:"nowrap",verticalAlign:"bottom"};
const tdB={padding:"8px 9px"};
const tdG=i=>({...tdB,background:i===0?"rgba(74,222,128,0.09)":"rgba(74,222,128,0.035)",color:"#14532d"});
const tdR=i=>({...tdB,background:i===0?"rgba(248,113,113,0.09)":"rgba(248,113,113,0.03)",color:"#7f1d1d"});
const thSC={...thS,padding:"4px 6px"};
const tdBC={padding:"6px 6px"};
const tdGC=i=>({...tdBC,background:i===0?"rgba(74,222,128,0.09)":"rgba(74,222,128,0.035)",color:"#14532d"});
const tdRC=i=>({...tdBC,background:i===0?"rgba(248,113,113,0.09)":"rgba(248,113,113,0.03)",color:"#7f1d1d"});
const rbg=i=>i===0?"rgba(201,168,76,0.32)":i===1?"rgba(148,163,184,0.28)":i===2?"rgba(160,108,50,0.11)":"rgba(0,0,0,0.025)";
const EUR_COLORS={"3m":["#f97316","rgba(249,115,22,0.18)"],"6m":[Sky,"rgba(2,132,199,0.18)"],"12m":[Au,"rgba(37,99,235,0.18)"]};

function RefBadge({refKey}){
  const[c,bg]=EUR_COLORS[refKey]||[Au,"rgba(37,99,235,0.18)"];
  return (React.createElement("span", {style: {display:"inline-block",background:bg,border:"1px solid "+c,borderRadius:4,padding:"2px 6px",fontSize:11,fontFamily:"monospace",fontWeight:700,color:c}}, "Eur."+refKey));
}

function TCard({n,idade,setIdade,rend,setRend,tipoC,setTipoC,colorStr}){
  const opts=[["efetivo","Efetivo"],["termo","Termo certo"],["parcial","Part-time"],["recibo","Rec. verde"],["pensao","Pensão"]];
  const factor=CONTRATO_FACTOR[tipoC]||1;
  const rendAdj=Math.round(rend*factor);
  return(
    React.createElement("div", {style: {background:"rgba("+colorStr+",0.05)",border:"1px solid rgba("+colorStr+",0.25)",borderRadius:10,padding:"12px 14px"}}, React.createElement("div", {style: {fontSize:12,fontWeight:700,color:"rgba("+colorStr+",1)",fontFamily:"sans-serif",marginBottom:9}}, "👤 TITULAR "+n), React.createElement("div", {style: {marginBottom:9}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "IDADE"), React.createElement(SliderInput, {min: 18, max: 75, step: 1, value: idade, onChange: setIdade, color: "rgba("+colorStr+",1)", suffix: " anos", formatFn: v=>v.toString()})), React.createElement("div", {style: {marginBottom:18}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "TIPO DE CONTRATO"), React.createElement("select", {value: tipoC, onChange: e=>setTipoC(e.target.value), style: {width:"auto",background:"#ffffff",border:"1px solid rgba(37,99,235,0.3)",color:"#111827",borderRadius:6,padding:"5px 8px",fontSize:12,cursor:"pointer"}}, opts.map(([v,l])=>React.createElement("option", {key: v, value: v}, l))), factor<1&&React.createElement("div", {style: {fontSize:10,color:Au,marginTop:2,fontFamily:"sans-serif"}}, "Banco considera "+Math.round(factor*100)+"% do rendimento")), React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "RENDIMENTO LÍQUIDO MENSAL"), React.createElement(SliderInput, {min: 500, max: 15000, step: 100, value: rend, onChange: setRend, color: "rgba("+colorStr+",1)", suffix: "€/mês", formatFn: v=>v.toLocaleString('pt-PT')}), factor<1&&React.createElement("div", {style: {fontSize:11,color:Au,fontFamily:"sans-serif",marginTop:2}}, "Rendimento considerado: "+fE(Math.round(rend*factor))+"/mês")))
  );
}

// ── Componente: slider + input numérico em simultâneo ─────────────────────
function SliderInput({min,max,step,value,onChange,color,prefix,suffix,formatFn,ariaLabel}){
  const [inputVal, setInputVal] = React.useState(String(value));
  const [editing,  setEditing]  = React.useState(false);

  // Sync input display when value changes externally (e.g. slider)
  React.useEffect(()=>{ if(!editing) setInputVal(String(value)); },[value,editing]);

  function handleInputChange(e){
    setInputVal(e.target.value);
  }
  function handleInputBlur(){
    setEditing(false);
    const n = parseInt(inputVal.replace(/\D/g,''), 10);
    if(!isNaN(n)){
      const clamped = Math.min(max, Math.max(min, Math.round(n/step)*step));
      onChange(clamped);
      setInputVal(String(clamped));
    } else {
      setInputVal(String(value));
    }
  }
  function handleKeyDown(e){
    if(e.key==='Enter') e.target.blur();
    if(e.key==='Escape'){ setEditing(false); setInputVal(String(value)); e.target.blur(); }
  }

  const displayFn = formatFn || (v=>v.toLocaleString('pt-PT'));

  return (
    React.createElement("div", null, React.createElement("input", {type: "range", min: min, max: max, step: step, value: value, onChange: e=>onChange(+e.target.value), "aria-label": ariaLabel||suffix||"valor", style: {width:"100%",accentColor:color||"#2563eb"}}), React.createElement("div", {style: {display:"flex",alignItems:"center",gap:6,marginTop:4,minWidth:0}}, prefix&&React.createElement("span", {style: {fontSize:13,color:"#4b5563",fontFamily:"sans-serif",flexShrink:0}}, prefix), React.createElement("input", {type: "text", inputMode: "numeric", "aria-label": (ariaLabel||suffix||"valor")+" (editar)", value: editing ? inputVal : displayFn(value), onFocus: ()=>{ setEditing(true); setInputVal(String(value)); }, onChange: handleInputChange, onBlur: handleInputBlur, onKeyDown: handleKeyDown, style: {
            flex:"0 1 90px",minWidth:"40px",padding:"4px 8px",
            background:"rgba(37,99,235,0.08)",
            border:"1px solid rgba(37,99,235,0.35)",
            borderRadius:6,color:"#111827",fontSize:14,fontWeight:700,
            fontFamily:"sans-serif",textAlign:"right",outline:"none",
            cursor:"text"
          }}), suffix&&React.createElement("span", {style: {fontSize:13,color:"#4b5563",fontFamily:"sans-serif"}}, suffix)))
  );
}
// ── Dados dos bancos via API local (SQLite) ───────────────────────────────
async function fetchBanks() {
  const resp = await fetch("/api/banks");
  if(!resp.ok){
    const errText = await resp.text().catch(()=>"");
    const errJson = (() => { try { return JSON.parse(errText); } catch(_) { return {}; } })();
    throw new Error(errJson.error || "HTTP "+resp.status);
  }
  return resp.json(); // {banks: [...], euribor: {...}}
}

/** Garante sCom = spread normal (fora da promo) e promoSpread = spread da campanha (mais baixo). */
function normalizeCampaignSpreadRow(d){
  if(!d||typeof d!=="object")return d;
  const o={...d};
  const pp=Number(o.promoPeriodo)||0;
  if(pp<=0)return o;
  if(typeof o.promoSpread!=="number"||!Number.isFinite(o.promoSpread))return o;
  if(typeof o.sCom!=="number"||!Number.isFinite(o.sCom))return o;
  const hi=Math.max(o.sCom,o.promoSpread),lo=Math.min(o.sCom,o.promoSpread);
  o.sCom=hi;o.promoSpread=lo;return o;
}

const NAV=[{id:"comp",icon:"📋",label:"Comparação"},{id:"seg",icon:"🛡️",label:"Seguros"},{id:"cust",icon:"💰",label:"Custos"},{id:"viab",icon:"📊",label:"Viabilidade"},{id:"cen",icon:"⚡",label:"Cenários"},{id:"amort",icon:"🔄",label:"Amortização"}];

const _Q=new URLSearchParams(location.search);
const _qi=(k,d)=>{const n=parseInt(_Q.get(k),10);return Number.isFinite(n)?n:d;};
const _qb=(k)=>_Q.get(k)==='1';
const _qs=(k,d,o)=>{const v=_Q.get(k);return o.includes(v)?v:d;};

window._SIM={fE,fP,SliderInput,CONTRATO_FACTOR,FALLBACK_EUR,G,Au,R,N,Sky,useState,EUR_COLORS};

function App(){
  // Euribor / spreads
  const[EUR,setEUR]=useState(FALLBACK_EUR);
  const[bankData,setBankData]=useState(FALLBACK_BANK_DATA);
  const[status,setStatus]=useState("idle");
  const[msg,setMsg]=useState("");
  const[ts,setTs]=useState(null);

  // Parâmetros base
  const[valorImovel,setValorImovel]=useState(()=>Math.max(50000,_qi('v',200000)));
  const[valorAvaliacao,setValorAvaliacao]=useState(()=>Math.max(0,_qi('va',0)));
  const[pct,setPct]=useState(()=>Math.min(100,Math.max(10,_qi('p',80))));
  const[prazo,setPrazo]=useState(()=>Math.min(40,Math.max(10,_qi('pr',30))));
  const[tipoTaxa,setTipoTaxa]=useState(()=>_qs('t',"variável",["variável","mista","fixa"]));
  const[modoJovem,setModoJovem]=useState(()=>_qb('j'));
  const[finalidade,setFinalidade]=useState(()=>_qs('f',"hpp",["hpp","hab2","arrendamento"]));
  const[certA,setCertA]=useState(()=>_qb('ca'));

  // Titulares
  const[titulares,setTitulares]=useState(()=>_qi('t2',1)===2?2:1);
  const[idade1,setIdade1]=useState(()=>Math.min(75,Math.max(18,_qi('i1',30))));
  const[rend1,setRend1]=useState(()=>Math.max(500,_qi('r1',1000)));
  const[tipoC1,setTipoC1]=useState(()=>_qs('c1',"efetivo",["efetivo","termo","parcial","recibo","pensao"]));
  const[idade2,setIdade2]=useState(()=>Math.min(75,Math.max(18,_qi('i2',30))));
  const[rend2,setRend2]=useState(()=>Math.max(500,_qi('r2',1000)));
  const[tipoC2,setTipoC2]=useState(()=>_qs('c2',"efetivo",["efetivo","termo","parcial","recibo","pensao"]));

  // DSTI extras
  const[dependentes,setDependentes]=useState(()=>Math.min(10,Math.max(0,_qi('dep',0))));
  const[outros,setOutros]=useState(()=>Math.max(0,_qi('out',0)));

  // Opções de crédito
  const[carencia,setCarencia]=useState(()=>Math.min(24,Math.max(0,_qi('car',0))));
  const[segProtecao,setSegProtecao]=useState(()=>_qb('sp'));

  // Amortização
  const[amortExtra,setAmortExtra]=useState(()=>Math.max(0,_qi('ae',0)));
  const[sortBy,setSortBy]=useState(()=>_qs('s',"prestTotal",["prestTotal","comProd","semProd","taeg","mtic","poupanca","spread","esforco","seguros"]));
  const[filtroEuribor,setFiltroEuribor]=useState(()=>_qs('euf',"all",["all","3m","6m","12m"]));
  const[nav,setNav]=useState("comp");
  const[shared,setShared]=useState(false);
  const[saved,setSaved]=useState(false);
  const[histSaved,setHistSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(_){return[];}});
  const[showHist,setShowHist]=useState(false);
  const[showComments,setShowComments]=useState(false);
  const[showGlossario,setShowGlossario]=useState(false);
  const[comments,setComments]=useState([]);
  const[commentLoad,setCommentLoad]=useState(false);
  const[commentForm,setCommentForm]=useState({name:"",text:"",bank:"",simPt:"",realPt:""});
  const[commentSubmit,setCommentSubmit]=useState(false);
  const[commentErr,setCommentErr]=useState("");
  const[commentOk,setCommentOk]=useState(false);
  const[replyTo,setReplyTo]=useState(null);
  const[replyForm,setReplyForm]=useState({name:"",text:""});
  const[replySubmit,setReplySubmit]=useState(false);
  const[replyErr,setReplyErr]=useState("");
  const[replyOk,setReplyOk]=useState("");
  const[bancoCustos,setBancoCustos]=useState("");
  const[bancoAmort,setBancoAmort]=useState("");
  const[bancoCen,setBancoCen]=useState("");
  
  // ── Load rates ──────────────────────────────────────────────────────────
  const loadRates=useCallback(async(force)=>{
    if(!force){
      try{
        const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
        if(cached&&cached.ts&&cached.ts<=Date.now()&&(Date.now()-cached.ts)/3600000<CACHE_H){
          setEUR(cached.eur);
          const cbd=cached.bd||{};
          const normBd={};
          Object.keys(FALLBACK_BANK_DATA).forEach(k=>{
            const fb=FALLBACK_BANK_DATA[k];
            normBd[k]=normalizeCampaignSpreadRow({...fb,...cbd[k]});
            /* jsCom/jsSem: bundle auditado (CH Jovem); cache/API podem trazer SQLite desactualizado */
            normBd[k].jsCom=fb.jsCom;normBd[k].jsSem=fb.jsSem;
          });
          setBankData(normBd); setTs(new Date(cached.ts));
          setStatus("cached"); setMsg("Cache válida · há "+Math.round((Date.now()-cached.ts)/3600000)+"h"); return;
        }
      }catch(_){}
    }
  setStatus("loading"); setMsg("A carregar dados dos bancos...");
  try{
    const raw=await fetchBanks();
    const e=(raw.euribor&&raw.euribor.eur)||{};
    const label=(raw.euribor&&raw.euribor.eurLabel)||"";
    const newEUR={"3m":{valor:e["3m"]||FALLBACK_EUR["3m"].valor,data:label||FALLBACK_EUR["3m"].data},"6m":{valor:e["6m"]||FALLBACK_EUR["6m"].valor,data:label||FALLBACK_EUR["6m"].data},"12m":{valor:e["12m"]||FALLBACK_EUR["12m"].valor,data:label||FALLBACK_EUR["12m"].data}};
    setEUR(newEUR); setTs(new Date()); setStatus("ok");
    let statusMsg=label?"Euribor BCE · "+label:"Dados: actualizados";
    const newBD={};
    let nSpr=0;
    const fn=(v,lo,hi)=>{const n=Number(v);return Number.isFinite(n)&&n>=lo&&n<hi?n:null;};
    // Converter array de bancos em mapa de spreads {código: {...}}
    const spreadsMap={};
    (raw.banks||[]).forEach(b=>{if(b.code&&b.spreads)spreadsMap[b.code]=b.spreads;});
    Object.keys(FALLBACK_BANK_DATA).forEach(k=>{
      const fb=FALLBACK_BANK_DATA[k];
      const rv=spreadsMap[k]||{};
      const upd={};
      const tryN=(key,lo,hi)=>{const v=fn(rv[key],lo,hi);if(v!==null)upd[key]=v;};
      const sc=fn(rv.sCom,0,5);if(sc!==null){upd.sCom=sc;nSpr++;}
      tryN('sSem',0,5);tryN('mCom',0,10);tryN('mSem',0,10);tryN('fCom',0,10);tryN('fSem',0,10);
      /* jsCom/jsSem: não aplicar da API — vêm do bundle (FALLBACK) após o merge */
      tryN('dossier',0,2000);tryN('avaliacao',0,2000);tryN('contaMes',0,100);
      tryN('capMin',0,5000000);tryN('capMax',0,50000000);
      tryN('vRef',0,500);tryN('mAno',0,5000);
      tryN('promoPeriodo',0,360);
      const ps=rv.promoSpread;if(ps===null||(typeof ps==='number'&&Number.isFinite(ps)&&ps>=0&&ps<10))upd.promoSpread=ps;
      tryN('minutas',0,500);
      const ji=rv.jovemIsenta;if(typeof ji==='boolean')upd.jovemIsenta=ji;
      const fs=(v)=>typeof v==='string'&&v.length>0&&v.length<100?v.trim():null;
      const iv=fs(rv.insV);if(iv!==null)upd.insV=iv;
      const im=fs(rv.insM);if(im!==null)upd.insM=im;
      const cn=fs(rv.contaNota);if(cn!==null)upd.contaNota=cn;
      const row=normalizeCampaignSpreadRow({...fb,...upd,updated:sc!==null});
      row.jsCom=fb.jsCom;row.jsSem=fb.jsSem;
      newBD[k]=row;
    });
    setBankData(newBD);
    if(Object.keys(spreadsMap).length>0) statusMsg+=" · "+nSpr+"/"+Object.keys(FALLBACK_BANK_DATA).length+" actualizado ✓";
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({eur:newEUR,bd:newBD,ts:Date.now()}));}catch(_){}
    setMsg(statusMsg);
  }catch(err){setStatus("error");setMsg("Erro: "+err.message.slice(0,80));}
  },[]);
  useEffect(()=>{
    loadRates(false);
    const revalidateId=setTimeout(()=>loadRates(true),1200);
    return()=>clearTimeout(revalidateId);
  },[loadRates]);
  useEffect(()=>{const id=setInterval(()=>loadRates(true),CACHE_H*3600*1000);return()=>clearInterval(id);},[loadRates]);
  useEffect(()=>{try{const sp=new URLSearchParams(window.location.search);if(sp.get("comments")==="1"){setShowComments(true);sp.delete("comments");const q=sp.toString();const nu=q?"?"+q:"";window.history.replaceState({},"",window.location.pathname+nu+(window.location.hash||""));}}catch(_){}},[]);
  useEffect(()=>{var fn=window.__creditSimRevealAds;if(typeof fn==="function")fn();},[]);
  
  // ── Derivados ────────────────────────────────────────────────────────────
  const is2=titulares===2;
  const maxPctFin=modoJovem&&finalidade==="hpp"?100:FINALIDADE_MAX_LTV[finalidade]||90;
  const pctR=Math.min(pct,maxPctFin);
  // Valor de referência para LTV = min(aquisição, avaliação) — se avaliação definida
  const valorRef=valorAvaliacao>0?Math.min(valorImovel,valorAvaliacao):valorImovel;
  const valorLim=Math.min(valorRef,modoJovem?450000:valorRef);
  const capital=Math.round(valorLim*pctR/100);
  const entrada=valorImovel-capital; // entrada em relação ao preço de compra
  // LTV real = capital / valorRef (pode diferir do pct se avaliação < aquisição)
  const ltvReal=valorRef>0?Math.round(capital/valorRef*100):pctR;
  const ltv=ltvReal;
  const certB=certA?0.15:0;
  // Aviso se avaliação abaixo do valor de aquisição
  const avalAbaixo=valorAvaliacao>0&&valorAvaliacao<valorImovel;

  // Rendimento ajustado por tipo de contrato e dependentes
  const rendAdj1=Math.round(rend1*(CONTRATO_FACTOR[tipoC1]||1));
  const rendAdj2=is2?Math.round(rend2*(CONTRATO_FACTOR[tipoC2]||1)):0;
  // Cada dependente reduz a capacidade em ~€400/mês (encargo estimado BdP)
  const rendT=Math.max(0, rendAdj1+rendAdj2-(dependentes*400));

  // Prazo — dupla regra BdP
  const idadeMax=is2?Math.max(idade1,idade2):idade1;
  const prazoMaxBdP = idadeMax<=30 ? 40 : (idadeMax<=35 ? 37 : 35);
  const prazoMax75  = Math.max(10,75-idadeMax);
  const prazoMax    = Math.min(prazoMaxBdP,prazoMax75);
  const prazoR      = Math.min(prazo,prazoMax);
  let prazoLimLabel;
  if (prazoMax75 <= prazoMaxBdP) {
    prazoLimLabel = "Limite 75a: "+idadeMax+"a + "+prazoMax+"a";
  } else if (idadeMax <= 30) {
    prazoLimLabel = "BdP (≤30a): máx. 40a";
  } else if (idadeMax <= 35) {
    prazoLimLabel = "BdP (30-35a): máx. 37a";
  } else {
    prazoLimLabel = "BdP (>35a): máx. 35a";
  }

  // Seguro de protecção ao crédito (opcional): ~€12/mês p/ €100k
  const segProtMensal=segProtecao?Math.round(capital*0.00012):0;

  // ── Banks com spread dinâmico + LTV + finalidade ─────────────────────────
  const BANKS=useMemo(()=>{
    return BANKS_STATIC.map(b=>{
      const bd=bankData[b.s]||{};
      const basesCom=bd.sCom??1;
      const basesSem=bd.sSem??1.5;
      const ltvAddonRaw=getLTVAddon(b.s,ltv);
      const ltvAddon=(b.s==="CGD"&&modoJovem&&finalidade==="hpp")?0:ltvAddonRaw;
      const finalAddon=FINALIDADE_ADDON[finalidade]||0;
      let jsc=bd.jsCom??b.jsCom;
      let jss=bd.jsSem??FALLBACK_BANK_DATA[b.s]?.jsSem??basesSem;
      // CGD Medida Jovem (simulador oficial): spreads por patamar de LTV sobre valor de referência
      if(b.s==="CGD"&&modoJovem&&finalidade==="hpp"&&valorRef>0){
        const acima90=capital/valorRef>0.9;
        jsc=acima90?1.65:0.65;
        jss=acima90?2.35:1.35;
      } else if(modoJovem&&b.jOk){
        if(Math.abs(jsc-basesCom)<1e-6) jsc=Math.max(0.12,Math.round((basesCom-0.10)*100)/100);
        if(Math.abs(jss-basesSem)<1e-6) jss=Math.max(0.12,Math.round((basesSem-0.10)*100)/100);
      }
      const jovMF=(x)=>!x||x<=0?x:Math.max(0.15,Math.round((x-0.12)*100)/100);
      let mC=bd.mCom??b.mCom??0,mS=bd.mSem??b.mSem??0,fC=bd.fCom??b.fCom??0,fS=bd.fSem??b.fSem??0;
      if(modoJovem&&b.jOk){
        mC=bd.jmCom!=null?bd.jmCom:jovMF(mC);
        mS=bd.jmSem!=null?bd.jmSem:jovMF(mS);
        fC=bd.jfCom!=null?bd.jfCom:jovMF(fC);
        fS=bd.jfSem!=null?bd.jfSem:jovMF(fS);
      }
      return{
        ...b,
        sCom:Math.max(0,(modoJovem?jsc:basesCom)-certB+ltvAddon+finalAddon),
        sComBase:modoJovem?jsc:basesCom,
        sSem:(modoJovem?jss:basesSem)+ltvAddon+finalAddon,
        ltvAddon,finalAddon,
        spreadUpdated:bd.updated??false,
        capitalOk:capital>=(bd.capMin??0)&&capital<=(bd.capMax??9999999),
        capitalMin:bd.capMin??0,
        capitalMax:bd.capMax??9999999,
        promoPeriodo:bd.promoPeriodo??0,
        promoSpread:bd.promoSpread??null,
        mCom:mC,
        mSem:mS,
        fCom:fC,
        fSem:fS,
        jsCom:jsc,
        jsSem:jss,
        insV:bd.insV,
        insM:bd.insM,
        contaNota:bd.contaNota,
      };
    });
  },[bankData,certB,ltv,finalidade,modoJovem,capital,valorRef]);

  // ── Resultados ────────────────────────────────────────────────────────────
  const resultados=useMemo(()=>{
    const rows=[];
    const filtroAtivo=filtroEuribor!=="all";
    BANKS.forEach(b=>{
      if(modoJovem&&!b.jOk)return;
      if(!b.tipos.includes(tipoTaxa))return;
      if(filtroAtivo&&!b.refs.includes(filtroEuribor))return;
      const refsU=tipoTaxa==="variável"
        ?(filtroAtivo?[filtroEuribor]:b.refs)
        :(filtroAtivo?[filtroEuribor]:[b.refs[0]]);
      refsU.forEach(ref=>{
        const ev=(EUR[ref]||FALLBACK_EUR[ref]).valor;
        let tanC,tanS;
        if(tipoTaxa==="variável"){tanC=ev+b.sCom;tanS=ev+b.sSem;}
        else if(tipoTaxa==="mista"){tanC=b.mCom;tanS=b.mSem;}
        else{tanC=b.fCom;tanS=b.fSem;}

        const prazoEfetivo=prazoR-carencia/12;
        const prazoCalc=prazoEfetivo>0?prazoEfetivo:prazoR;
        const pC=calcP(capital,tanC,prazoCalc);
        const pS=calcP(capital,tanS,prazoCalc);

        // Prestação durante carência (só juros)
        const pCarenciaC=carencia>0?prestacaoCarencia(capital,tanC):null;
        const pCarenciaS=carencia>0?prestacaoCarencia(capital,tanS):null;

        // Seguros sobre capital médio em dívida (mais preciso)
        const seg=sTot({...SEG[b.s],...bankData[b.s]},idade1,idade2,is2,capital,valorImovel,prazoR);

        // IS sobre juros médio mensal (decrescente para arrendamento; 0 para HPP)
        const isM=isJurosMedioMensal(capital,tanC,prazoCalc,finalidade);

        // Comissão mensal de conta do banco
        const contaM=bankData[b.s]?.contaMes??CONTA_MES[b.s]?.val??0;

        const ptC=pC+seg.tot+isM+segProtMensal+contaM;
        const ptS=pS+seg.tot+isM+segProtMensal+contaM;

        // DSTI
        const efC=rendT>0?(ptC+outros)/rendT*100:0;
        const pSt=calcP(capital,tanC+1.5,prazoCalc);
        const efSt=rendT>0?((pSt+seg.tot+isM+segProtMensal+contaM)+outros)/rendT*100:0;

        // TAEG e MTIC — encargo mensal TAEG inclui prestação + seguros + IS + conta
        // Custos iniciais TAEG = dossier + avaliação + minutas + DPA + IS crédito
        const comB2base=COM[b.s]||{dossier:300,avaliacao:230,minutas:0,jovemIsenta:false};
        const bd2=bankData[b.s]||{};
        const comB2={...comB2base,dossier:bd2.dossier??comB2base.dossier,avaliacao:bd2.avaliacao??comB2base.avaliacao,minutas:bd2.minutas??comB2base.minutas,jovemIsenta:bd2.jovemIsenta??comB2base.jovemIsenta};
        const comD2=modoJovem&&comB2.jovemIsenta?0:comB2.dossier;
        const isCredTAEG=Math.round(capital*0.006);
        const regHTAEG=(modoJovem&&finalidade==="hpp")?0:Math.round(capital*0.0008+150);
        const comInic=comD2+(comB2.avaliacao||0)+(comB2.minutas||0)+200+isCredTAEG+regHTAEG;
        const encargoTAEG=pC+seg.tot+isM+segProtMensal+contaM;
        const taeg=calcTAEG(capital,comInic,encargoTAEG,prazoCalc*12);
        let mtic;
        if(carencia>0){
          const encCar=(pCarenciaC||0)+seg.tot+isM+segProtMensal+contaM;
          mtic=Math.round(comInic+encCar*carencia+encargoTAEG*prazoCalc*12);
        } else {
          mtic=calcMTIC(comInic,encargoTAEG,prazoCalc*12);
        }

        rows.push({
          ...b,ref,ev,tanC,tanS,pC,pS,seg,isM,contaM,ptC,ptS,
          pCarenciaC,pCarenciaS,
          taeg,mtic,comInic,encargoTAEG,
          diff:pS-pC,diffTot:(pS-pC)*prazoR*12,efC,efSt,pSt,
          isMulti:b.refs.length>1&&tipoTaxa==="variável"&&filtroEuribor==="all",
          rowKey:b.s+"-"+ref,
        });
      });
    });
    // Pre-computar representante de cada banco (primeira linha de cada banco)
    const bankRep = {};
    rows.forEach(r => { if (!bankRep[r.s]) bankRep[r.s] = r; });

    return rows.sort((a,bk)=>{
      if(sortBy==="prestTotal")  return a.ptC-bk.ptC || a.s.localeCompare(bk.s);
      if(sortBy==="comProd")     return a.pC-bk.pC   || a.s.localeCompare(bk.s);
      if(sortBy==="semProd")     return a.pS-bk.pS   || a.s.localeCompare(bk.s);
      if(sortBy==="taeg")        return a.taeg-bk.taeg || a.s.localeCompare(bk.s);
      if(sortBy==="mtic")        return a.mtic-bk.mtic || a.s.localeCompare(bk.s);
      if(sortBy==="poupanca")    return bk.diff-a.diff || a.s.localeCompare(bk.s);
      if(sortBy==="spread")      return a.sCom-bk.sCom || a.s.localeCompare(bk.s);
      if(sortBy==="esforco")     return a.efC-bk.efC  || a.s.localeCompare(bk.s);
      if(sortBy==="seguros")     return a.seg.tot-bk.seg.tot || a.s.localeCompare(bk.s);
      return 0;
    });
  },[BANKS,bankData,modoJovem,finalidade,tipoTaxa,filtroEuribor,EUR,capital,prazoR,carencia,idade1,idade2,is2,valorImovel,rendT,outros,sortBy,segProtMensal]);

  const melhor=resultados[0];

  // Custos detalhados
  const imt=calcIMT(valorImovel,modoJovem,finalidade);
  const isEsc=modoJovem&&finalidade==="hpp"?0:valorImovel*0.008;
  const isCred=capital*0.006;
  // IS escritura sobre a prestação (0,6% do capital em vigor — já incluído no isCred)
  const registoHipoteca=modoJovem&&finalidade==="hpp"?0:Math.round(capital*0.0008+150); // emolumentos
  // Banco seleccionado para custos (usa o melhor como default)
  const bancoSCustos = bancoCustos || (melhor?.s) || "CA";
  const comB=COM[bancoSCustos]||{dossier:300,avaliacao:230,minutas:0,jovemIsenta:false};
  const comDossier=modoJovem&&comB.jovemIsenta?0:comB.dossier;
  const comAval=comB.avaliacao;
  const comMinutas=comB.minutas||0;
  const dpa=200;
  const notario=750;
  const totalCustos=imt+isEsc+isCred+comDossier+comAval+comMinutas+dpa+registoHipoteca;
  const bancoNomeCustos=BANKS_STATIC.find(b=>b.s===bancoSCustos)?.name||"—";

  // Cenários Euribor
  const cenarios=useMemo(()=>{
    if(!melhor||tipoTaxa!=="variável")return[];
    const cRow=resultados.find(r=>r.s===(bancoCen||(melhor?.s)||""))||melhor;
    return[-0.5,0,0.5,1.0,1.5,2.0].map(d=>{
      const e2=cRow.ev+d,t2=e2+cRow.sCom;
      const p2=calcP(capital,t2,prazoR),pt2=p2+cRow.seg.tot+isJurosMedioMensal(capital,t2,prazoR,finalidade)+segProtMensal;
      const ef=rendT>0?(pt2+outros)/rendT*100:0;
      const st=calcP(capital,t2+1.5,prazoR)+cRow.seg.tot+isJurosMedioMensal(capital,t2+1.5,prazoR,finalidade)+segProtMensal;
      return{label:d===0?"Atual":d>0?("+"+d+"%"):(d+"%"),delta:d,eur:e2,tan:t2,p:Math.round(p2),pt:Math.round(pt2),ef,st:Math.round(st),efSt:rendT>0?(st+outros)/rendT*100:0};
    });
  },[melhor,resultados,bancoCen,capital,prazoR,rendT,outros,tipoTaxa,segProtMensal]);

  const bancoCenS=bancoCen||(melhor?.s)||"";
  const bancoCenRow=resultados.find(r=>r.s===bancoCenS)||melhor;
  const fixaB=bancoCenRow?.tipos?.includes("fixa")?bancoCenRow:null;
  const brkEur=fixaB?(fixaB.fCom-fixaB.sCom):null;
  // Banco seleccionado para amortização
  const bancoAmortS = bancoAmort || (melhor?.s) || "";
  const bancoAmortRow = resultados.find(r=>r.s===bancoAmortS) || melhor;
  const tanBest=bancoAmortRow?.tanC||3.5;
  const bancoAmortNome=bancoAmortRow?.name||"—";
  const bancoAmortRef=bancoAmortRow?.ref||"12m";
  const amSem=simA(capital,tanBest,prazoR,0);
  const amCom=amortExtra>0?simA(capital,tanBest,prazoR,amortExtra):null;
  const amCh=amortExtra>0?amChart(capital,tanBest,prazoR,amortExtra):[];

  const segChart=useMemo(()=>{
    const seen=new Set();
    return resultados.filter(r=>{if(seen.has(r.s))return false;seen.add(r.s);return true;})
      .sort((a,b)=>a.seg.tot-b.seg.tot)
      .map(r=>({name:r.s,"Vida T1":Math.round(r.seg.v1),"Vida T2":Math.round(r.seg.v2),"Multirriscos":Math.round(r.seg.m)}));
  },[resultados]);

  // Comentários
  const loadComments=useCallback(async()=>{
    setCommentLoad(true);
    try{const r=await fetch("/api/comments");if(r.ok)setComments(await r.json());}catch(_){}
    setCommentLoad(false);
  },[]);
  useEffect(()=>{loadComments();},[loadComments]);
  useEffect(()=>{if(showComments)loadComments();},[showComments,loadComments]);
  useEffect(()=>{const id=setInterval(()=>loadComments(),60000);return()=>clearInterval(id);},[loadComments]);
  const commentTotal=useMemo(()=>comments.reduce((total,c)=>total+1+((c.replies||[]).length),0),[comments]);
  async function submitComment(e){
    e.preventDefault();
    setCommentErr("");setCommentOk(false);setCommentSubmit(true);
    try{
      const r=await fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(commentForm)});
      const d=await r.json();
      if(!r.ok){setCommentErr(d.error||"Erro ao enviar");}
      else{setComments(c=>[{...d,replies:d.replies||[]},...c]);setCommentForm({name:"",text:"",bank:"",simPt:"",realPt:""});setCommentOk(true);setTimeout(()=>setCommentOk(false),4000);}
    }catch(_){setCommentErr("Erro de ligação");}
    setCommentSubmit(false);
  }
  async function submitReply(e,parentId){
    e.preventDefault();
    setReplyErr("");setReplySubmit(true);
    try{
      const r=await fetch("/api/comments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...replyForm,parentId})});
      const d=await r.json();
      if(!r.ok){setReplyErr(d.error||"Erro ao responder");}
      else{
        setComments(list=>list.map(c=>c.id===parentId?{...c,replies:[...(c.replies||[]),d]}:c));
        setReplyForm({name:"",text:""});setReplyTo(null);setReplyOk(parentId);setTimeout(()=>setReplyOk(""),4000);
      }
    }catch(_){setReplyErr("Erro de ligação");}
    setReplySubmit(false);
  }

  // Partilha por URL
  function handleShare(){
    const _p=new URLSearchParams();
    _p.set('v',valorImovel);_p.set('p',pct);_p.set('pr',prazo);_p.set('t',tipoTaxa);
    if(modoJovem)_p.set('j','1');
    if(finalidade!=='hpp')_p.set('f',finalidade);
    if(certA)_p.set('ca','1');
    _p.set('t2',titulares);_p.set('i1',idade1);_p.set('r1',rend1);
    if(tipoC1!=='efetivo')_p.set('c1',tipoC1);
    if(titulares===2){_p.set('i2',idade2);_p.set('r2',rend2);if(tipoC2!=='efetivo')_p.set('c2',tipoC2);}
    if(dependentes)_p.set('dep',dependentes);
    if(outros)_p.set('out',outros);
    if(carencia)_p.set('car',carencia);
    if(segProtecao)_p.set('sp','1');
    if(valorAvaliacao>0)_p.set('va',valorAvaliacao);
    if(amortExtra)_p.set('ae',amortExtra);
    if(sortBy!=='prestTotal')_p.set('s',sortBy);
    if(filtroEuribor!=='all')_p.set('euf',filtroEuribor);
    const url=location.origin+location.pathname+'?'+_p.toString();
    function confirm(){setShared(true);setTimeout(()=>setShared(false),2000);}
    if(navigator.share){navigator.share({title:'Simulação Crédito Habitação',url}).then(confirm).catch(()=>{});}
    else{navigator.clipboard.writeText(url).then(confirm,()=>prompt('Copia este link:',url));}
  }

  function handleSave(){
    const _p=new URLSearchParams();
    _p.set('v',valorImovel);_p.set('p',pct);_p.set('pr',prazo);_p.set('t',tipoTaxa);
    if(modoJovem)_p.set('j','1');
    if(finalidade!=='hpp')_p.set('f',finalidade);
    if(certA)_p.set('ca','1');
    _p.set('t2',titulares);_p.set('i1',idade1);_p.set('r1',rend1);
    if(tipoC1!=='efetivo')_p.set('c1',tipoC1);
    if(titulares===2){_p.set('i2',idade2);_p.set('r2',rend2);if(tipoC2!=='efetivo')_p.set('c2',tipoC2);}
    if(dependentes)_p.set('dep',dependentes);
    if(outros)_p.set('out',outros);
    if(carencia)_p.set('car',carencia);
    if(segProtecao)_p.set('sp','1');
    if(valorAvaliacao>0)_p.set('va',valorAvaliacao);
    if(amortExtra)_p.set('ae',amortExtra);
    if(sortBy!=='prestTotal')_p.set('s',sortBy);
    if(filtroEuribor!=='all')_p.set('euf',filtroEuribor);
    const entry={
      ts:Date.now(),
      label:fE(valorImovel)+" · "+prazoR+"a · "+tipoTaxa+(filtroEuribor!=="all"?" · Eur."+filtroEuribor:"")+" · melhor: "+(melhor?melhor.name+" ("+fP(melhor.tanC)+")":"—"),
      url:location.origin+location.pathname+'?'+_p.toString()
    };
    const next=[entry,...histSaved].slice(0,HIST_MAX);
    try{localStorage.setItem(HIST_KEY,JSON.stringify(next));}catch(_){}
    setHistSaved(next);
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  }

  // Status
  const stIcon=status==="loading"?"⏳":status==="ok"?"✅":status==="cached"?"🔄":"⚠️";
  const stColor=status==="ok"?G:status==="cached"?Sky:status==="error"?R:Au;
  const updatedCount=Object.values(bankData).filter(x=>x.updated).length;

  return React.createElement(React.Fragment,null,
    React.createElement("div", {style: {fontFamily:"'Inter',system-ui,sans-serif",background:N,minHeight:"100vh",color:"#111827"}}, React.createElement("div", {style: {background:"linear-gradient(135deg,#ffffff 0%,#eff6ff 55%,#ffffff 100%)",borderBottom:"1px solid "+Au,padding:"10px 16px 0"}}, React.createElement("div", {style: {maxWidth:1440,margin:"0 auto"}}, React.createElement("div", {style: {display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,paddingBottom:10}}, React.createElement("div", null, React.createElement("a",{href:"/",style:{display:"flex",alignItems:"center",gap:8,textDecoration:"none",color:"inherit"}},React.createElement("img",{src:"/images/logo.png",alt:"Simulador Crédito Habitação",style:{height:40,width:"auto",flexShrink:0}}),React.createElement("h1",{style:{margin:0,fontSize:21,fontWeight:700,color:"#111827",letterSpacing:-0.3,fontFamily:"'Inter',system-ui,sans-serif"}},"Simulador Crédito Habitação")), React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:2}}, "Portugal · 14 bancos · Euribor em tempo real"), React.createElement("div", {style:{display:"flex",gap:5,marginTop:7,flexWrap:"wrap"}}, ["3m","6m","12m"].map(k=>{const v=EUR[k]||FALLBACK_EUR[k];const[c,bg]=EUR_COLORS[k];return React.createElement("div",{key:k,style:{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",background:bg,borderRight:"1px solid rgba(0,0,0,0.04)",borderRadius:4}},React.createElement("span",{style:{color:c,fontWeight:700,fontSize:10,fontFamily:"monospace",letterSpacing:1}},"EUR "+k.toUpperCase()),React.createElement("span",{style:{color:"#111827",fontSize:13,fontWeight:700,fontFamily:"monospace"}},v.valor.toFixed(3).replace(".",",")+"%"),v.data&&React.createElement("span",{style:{color:"#4b5563",fontSize:10,fontFamily:"sans-serif",marginLeft:2}},v.data));}),React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4,marginLeft:6,paddingLeft:8,borderLeft:"1px solid rgba(0,0,0,0.08)",fontSize:11,color:stColor,fontFamily:"sans-serif"}},stIcon+" "+msg,ts&&status!=="loading"&&React.createElement("span",{style:{color:"#4b5563",marginLeft:3}},ts.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}))))), React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}, React.createElement("div", {style:{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}},
React.createElement("button", {onClick:handleSave,"aria-label":"Guardar simulação",title:"Guardar simulação", style:{padding:"7px 10px",background:saved?"rgba(74,222,128,0.12)":"rgba(0,0,0,0.05)",border:"1px solid "+(saved?"rgba(74,222,128,0.5)":"rgba(0,0,0,0.09)"),borderRadius:7,color:saved?G:"#4b5563",fontSize:14,cursor:"pointer",transition:"all 0.2s"}}, saved?"✓":"💾"),
            React.createElement("button", {onClick:()=>setShowHist(h=>!h),"aria-label":"Histórico de simulações",title:"Histórico de simulações", style:{padding:"7px 10px",background:showHist?"rgba(2,132,199,0.12)":"rgba(0,0,0,0.05)",border:"1px solid "+(showHist?"rgba(2,132,199,0.4)":"rgba(0,0,0,0.09)"),borderRadius:7,color:showHist?Sky:"#4b5563",fontSize:14,cursor:"pointer",transition:"all 0.2s"}}, histSaved.length>0?"📋 "+histSaved.length:"📋"),
            React.createElement("div", {style:{width:1,height:22,background:"rgba(0,0,0,0.09)",margin:"0 3px"}}),
            React.createElement("button", {onClick:handleShare,"aria-label":"Partilhar simulação", style:{padding:"7px 13px",background:shared?"rgba(74,222,128,0.12)":"rgba(2,132,199,0.08)",border:"1px solid "+(shared?"rgba(74,222,128,0.5)":"rgba(2,132,199,0.3)"),borderRadius:7,color:shared?G:"#0284c7",fontSize:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600,transition:"all 0.2s"}}, shared?"✓ Copiado!":"🔗 Partilhar"),
            React.createElement("button", {onClick:()=>loadRates(true),disabled:status==="loading","aria-label":"Actualizar taxas", style:{padding:"7px 13px",background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.4)",borderRadius:7,color:Au,fontSize:12,fontFamily:"sans-serif",cursor:status==="loading"?"not-allowed":"pointer",fontWeight:600}}, status==="loading"?"⏳ A actualizar...":"🔄 Actualizar"),
            React.createElement("button",{onClick:()=>setShowGlossario(g=>!g),style:{padding:"7px 13px",background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:7,color:Au,fontSize:12,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}},"📖 Glossário")
            ))),window.NavTabs?React.createElement(window.NavTabs,{activePage:"simulador",commentCount:commentTotal,onOpenComments:()=>setShowComments(c=>!c)}):null,React.createElement("div",{style:{paddingBottom:8}},React.createElement("span",{style:{fontSize:11,color:"#4b5563"}},"Compara prestações de 14 bancos com Euribor actualizado, spreads, seguros, TAEG e DSTI · Indicativo, não substitui a FINE")))), React.createElement("div", {style: {maxWidth:1440,margin:"0 auto",padding:"10px 14px"}}, React.createElement("div", {style: {display:"flex",borderRadius:9,overflow:"hidden",border:"1px solid rgba(0,0,0,0.07)",marginBottom:10}}, [{id:false,icon:"🏦",label:"Crédito Normal",c:Au},{id:true,icon:"🎓",label:"Crédito Jovem ≤35 anos",c:G}].map(({id,icon,label,c})=>(
            React.createElement("button", {key: String(id), onClick: ()=>{setModoJovem(id);if(!id)setPct(Math.min(pct,90));}, style: {flex:1,padding:"9px",border:"none",background:modoJovem===id?"rgba("+(id?"74,222,128":"201,168,76")+",0.08)":"rgba(255,255,255,1)",borderBottom:"2px solid "+(modoJovem===id?c:"transparent"),color:modoJovem===id?c:"#4b5563",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}}, icon+" "+label)
          ))), React.createElement("div", {style: {background:"rgba(0,0,0,0.03)",border:"1px solid rgba(37,99,235,0.16)",borderRadius:11,padding:"13px 14px 10px",marginBottom:10}}, React.createElement("div", {style: {fontSize:11,letterSpacing:3,color:Au,fontFamily:"monospace",marginBottom:10}}, "PARÂMETROS GLOBAIS"), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:11,marginBottom:12,alignItems:"start"}}, React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "VALOR DO IMÓVEL (Aquisição)"), React.createElement(SliderInput, {min: 50000, max: modoJovem?450000:1500000, step: 1000, value: Math.min(valorImovel,modoJovem?450000:1500000), onChange: v=>setValorImovel(v), color: Au, suffix: "€", formatFn: v=>v.toLocaleString('pt-PT')})), React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "AVALIAÇÃO (opcional)"), React.createElement(SliderInput, {min: 0, max: modoJovem?450000:1500000, step: 1000, value: valorAvaliacao, onChange: v=>setValorAvaliacao(v), color: avalAbaixo?R:"#4b5563", suffix: "€", formatFn: v=>v===0?"= Valor de aquisição":v.toLocaleString('pt-PT')}), avalAbaixo&&(
                React.createElement("div", {style: {fontSize:10,color:R,fontFamily:"sans-serif",marginTop:2}}, "⚠️ Avaliação abaixo do preço → LTV real: "+ltvReal+"% · spread pode subir")
              ), !avalAbaixo&&valorAvaliacao===0&&(
                React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"sans-serif",marginTop:2}}, "Deixar em 0 = assume igual ao preço de compra")
              )), React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "FINANCIAMENTO (máx. "+maxPctFin+"%)"), React.createElement(SliderInput, {min: 10, max: maxPctFin, step: 1, value: pctR, onChange: v=>setPct(v), color: modoJovem?G:Au, suffix: "%", formatFn: v=>v.toString()}), React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"sans-serif",marginTop:2}}, "= "+fE(capital)+" · Entrada: "+fE(entrada))), React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "PRAZO (máx. "+prazoMax+"a)"), React.createElement(SliderInput, {min: 10, max: prazoMax, step: 1, value: prazoR, onChange: v=>setPrazo(v), color: Au, suffix: " anos", formatFn: v=>v.toString()}), React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"sans-serif",marginTop:2}}, prazoLimLabel)), React.createElement("div", {style:{display:"flex",flexWrap:"wrap",gap:11}}, React.createElement("div", {style:{flex:"1 1 110px"}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "TIPO DE TAXA"), ["variável","mista","fixa"].map(t=>(
                React.createElement("button", {key: t, onClick: ()=>setTipoTaxa(t), style: {display:"block",width:"100%",marginBottom:3,padding:"5px 7px",border:"1px solid "+(tipoTaxa===t?Au:"rgba(0,0,0,0.06)"),borderRadius:5,background:tipoTaxa===t?"rgba(37,99,235,0.1)":"transparent",color:tipoTaxa===t?Au:"#4b5563",fontSize:11,fontFamily:"sans-serif",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap"}}, t==="variável"?"Variável — Euribor":t==="mista"?"Mista — fixa inicial":"Fixa — todo o prazo")
              ))), React.createElement("div", {style:{flex:"1 1 110px"}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "FINALIDADE"), [["hpp","🏠 HPP (1.ª habitação)"],["hab2","🏖️ 2.ª habitação"],["arrendamento","🔑 Arrendamento"]].map(([v,l])=>(
                React.createElement("button", {key: v, onClick: ()=>setFinalidade(v), style: {display:"block",width:"100%",marginBottom:3,padding:"5px 7px",border:"1px solid "+(finalidade===v?Au:"rgba(0,0,0,0.06)"),borderRadius:5,background:finalidade===v?"rgba(37,99,235,0.1)":"transparent",color:finalidade===v?Au:"#4b5563",fontSize:11,fontFamily:"sans-serif",cursor:"pointer",textAlign:"left",whiteSpace:"nowrap"}}, l)
              )), finalidade!=="hpp"&&React.createElement("div", {style: {fontSize:10,color:R,fontFamily:"sans-serif",marginTop:2}}, "Spread +"+((FINALIDADE_ADDON[finalidade]||0)*100).toFixed(0)+"pp · LTV máx. "+FINALIDADE_MAX_LTV[finalidade]+"%"))), React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "OPÇÕES ADICIONAIS"), React.createElement("label", {style: {display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:11,color:"#4b5563",fontFamily:"sans-serif",cursor:"pointer"}}, React.createElement("input", {type: "checkbox", checked: certA, onChange: e=>setCertA(e.target.checked), style: {accentColor:G}}), "🏠 Cert. A/B (-0,15% spread)"), React.createElement("label", {style: {display:"flex",alignItems:"center",gap:5,marginBottom:6,fontSize:11,color:"#4b5563",fontFamily:"sans-serif",cursor:"pointer"}}, React.createElement("input", {type: "checkbox", checked: segProtecao, onChange: e=>setSegProtecao(e.target.checked), style: {accentColor:Sky}}), "🛡️ Seg. Protecção Crédito (+"+fE(Math.round(capital*0.00012))+"/mês)"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "CARÊNCIA DE CAPITAL (meses)"), React.createElement(SliderInput, {min: 0, max: 24, step: 1, value: carencia, onChange: setCarencia, color: Sky, suffix: " meses", formatFn: v=>v===0?"0":v.toString()}), React.createElement("div", {style: {fontSize:12,color:carencia>0?Sky:"#4b5563",fontFamily:"sans-serif",marginTop:2}}, carencia===0?"Sem carência":"Só juros durante "+carencia+"m"))), React.createElement("div", {style: {borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:11,marginBottom:11}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:10,marginBottom:9}}, React.createElement("div", {style: {fontSize:11,color:Au,fontFamily:"monospace",letterSpacing:3}}, "TITULARES"), [1,2].map(t=>(
                React.createElement("button", {key: t, onClick: ()=>setTitulares(t), style: {padding:"4px 14px",border:"1px solid "+(titulares===t?Au:"rgba(0,0,0,0.08)"),borderRadius:20,background:titulares===t?"rgba(37,99,235,0.12)":"transparent",color:titulares===t?Au:"#4b5563",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:titulares===t?700:400}}, t+" Titular"+(t>1?"es":""))
              )), is2&&React.createElement("span", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}}, "Rend. conjunto considerado: ", React.createElement("strong", {style: {color:G}}, fE(rendT)+"/mês"))), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12,alignItems:"start"}}, React.createElement(TCard, {n: 1, idade: idade1, setIdade: setIdade1, rend: rend1, setRend: setRend1, tipoC: tipoC1, setTipoC: setTipoC1, colorStr: "201,168,76"}), is2?React.createElement(TCard, {n: 2, idade: idade2, setIdade: setIdade2, rend: rend2, setRend: setRend2, tipoC: tipoC2, setTipoC: setTipoC2, colorStr: "74,222,128"}):React.createElement("div", null), React.createElement("div", {style:{display:"grid",gap:11,paddingTop:33}}, React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "DEPENDENTES (−€400/dep.)"), React.createElement(SliderInput, {min: 0, max: 10, step: 1, value: dependentes, onChange: setDependentes, color: "#f97316", suffix: " dep.", formatFn: v=>v.toString()}), dependentes>0&&React.createElement("div", {style: {fontSize:10,color:"#f97316",fontFamily:"sans-serif",marginTop:2}}, "−"+fE(dependentes*400)+"/mês no DSTI")), React.createElement("div", null, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "OUTROS ENCARGOS MENSAIS"), React.createElement(SliderInput, {min: 0, max: 50000, step: 50, value: outros, onChange: setOutros, color: "#f97316", suffix: "€/mês", formatFn: v=>v.toLocaleString('pt-PT')}), React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"sans-serif",marginTop:2,lineHeight:1.5}}, "Inclui todos os encargos mensais fixos existentes: outros créditos (automóvel, pessoal, estudante), rendas, pensões de alimentos, avales, etc. O banco considera estes encargos no cálculo da taxa de esforço (DSTI)."))))), React.createElement("div", {style: {display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}, [
              {l:"Capital",v:fE(capital)},
              {l:"LTV real",v:ltvReal+"%",c:ltvReal>80?R:Au},
              {l:"Prazo",v:prazoR+"a",c:Au},
              {l:"Rend. considerado",v:fE(rendT)+"/mês",c:rendT>0?G:R},
              ...(carencia>0?[{l:"Prestação carência",v:melhor?fE(melhor.pCarenciaC||0)+"/mês":"—",c:Sky}]:[]),
              {l:"IS juros/mês",v:finalidade==="hpp"?"€0 (HPP isento)":melhor?fE(melhor.isM)+"/mês":"—",c:finalidade==="hpp"?G:"#4b5563"},
              {l:"Melhor banco",v:melhor?(melhor.name+" (Eur."+melhor.ref+")"):"—",c:Au},
              {l:"TAN c/prod",v:melhor?fP(melhor.tanC):"—",c:Au},
              {l:"Prestação capital",v:melhor?fE(melhor.pC)+"/mês":"—",c:Au},
              {l:"Conta banco/mês",v:melhor?fE(melhor.contaM||0)+"/mês":"—",c:"#4b5563"},
              {l:"TOTAL (c/ tudo)",v:melhor?fE(melhor.ptC)+"/mês":"—",c:Au},
              {l:"TAEG",v:melhor?(melhor.taeg||0).toFixed(2).replace(".",",")+"%":"—",c:melhor?ecC((melhor.taeg||0)*8):undefined},
              {l:"MTIC",v:melhor?fE(melhor.mtic):"—",c:"#4b5563"},
              {l:"Taxa esforço",v:melhor&&rendT>0?melhor.efC.toFixed(1)+"%":"—",c:melhor?ecC(melhor.efC):undefined},
            ].map(({l,v,c="#111827"})=>(
              React.createElement("div", {key: l, style: {background:"rgba(37,99,235,0.05)",border:"1px solid rgba(37,99,235,0.14)",borderRadius:7,padding:"3px 9px"}}, React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"monospace",letterSpacing:1}}, l.toUpperCase()), React.createElement("div", {style: {fontSize:12,fontWeight:700,color:c}}, v))
            )))), showHist&&histSaved.length>0&&React.createElement("div", {style:{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"},onClick:()=>setShowHist(false)},
            React.createElement("div", {style:{background:"#fff",borderRadius:14,padding:20,maxWidth:520,width:"calc(100% - 32px)",maxHeight:"80vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"},onClick:e=>e.stopPropagation()},
              React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}},
                React.createElement("div", {style:{fontSize:12,letterSpacing:2,color:Sky,fontFamily:"monospace",fontWeight:700}}, "HISTÓRICO — ÚLTIMAS SIMULAÇÕES GUARDADAS"),
                React.createElement("button", {onClick:()=>setShowHist(false),style:{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#6b7280",padding:"0 4px",lineHeight:1}}, "✕")
              ),
              histSaved.map((h,i)=>React.createElement("div", {key:h.ts,style:{display:"flex",alignItems:"center",gap:8,padding:"10px 0",borderBottom:i<histSaved.length-1?"1px solid rgba(0,0,0,0.08)":"none"}},
                React.createElement("div", {style:{flex:1,fontSize:12,color:"#111827"}},
                  React.createElement("div", {style:{fontWeight:500,marginBottom:2}}, h.label),
                  React.createElement("div", {style:{fontSize:11,color:"#6b7280"}}, new Date(h.ts).toLocaleString("pt-PT"))
                ),
                React.createElement("a", {href:h.url,style:{padding:"5px 12px",background:"rgba(2,132,199,0.1)",border:"1px solid rgba(2,132,199,0.3)",borderRadius:6,color:Sky,fontSize:12,textDecoration:"none",cursor:"pointer",whiteSpace:"nowrap"}}, "Restaurar"),
                React.createElement("button", {onClick:()=>{const n=histSaved.filter((_,j)=>j!==i);setHistSaved(n);try{localStorage.setItem(HIST_KEY,JSON.stringify(n));}catch(_){}},style:{padding:"5px 8px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:6,color:R,fontSize:12,cursor:"pointer"},"aria-label":"Apagar simulação"}, "✕")
              ))
            )
          ),

          React.createElement("div", {style: {display:"flex",gap:3,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}, NAV.map(({id,icon,label})=>(
            React.createElement("button", {key: id, onClick: ()=>setNav(id), style: {padding:"5px 11px",border:"1px solid "+(nav===id?Au:"rgba(0,0,0,0.07)"),borderRadius:7,background:nav===id?"rgba(37,99,235,0.1)":"transparent",color:nav===id?Au:"#4b5563",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:nav===id?700:400}}, icon+" "+label)
          )), nav==="comp"&&(
            React.createElement("div", {style: {marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}, React.createElement("label", {style: {display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif",whiteSpace:"nowrap"}}, React.createElement("span", null, "Indexante"), React.createElement("select", {"aria-label":"Filtrar bancos por Euribor oferecida", value: filtroEuribor, onChange: e=>setFiltroEuribor(e.target.value), style: {background:"#ffffff",border:"1px solid rgba(37,99,235,0.26)",color:"#111827",borderRadius:6,padding:"3px 7px",fontSize:12,cursor:"pointer",maxWidth:200}}, React.createElement("option", {value: "all"}, "Todas (3m / 6m / 12m)"), React.createElement("option", {value: "3m"}, "Só Euribor 3 meses"), React.createElement("option", {value: "6m"}, "Só Euribor 6 meses"), React.createElement("option", {value: "12m"}, "Só Euribor 12 meses"))), React.createElement("select", {value: sortBy, onChange: e=>setSortBy(e.target.value), style: {background:"#ffffff",border:"1px solid rgba(37,99,235,0.26)",color:"#111827",borderRadius:6,padding:"3px 7px",fontSize:12,cursor:"pointer"}}, React.createElement("option", {value: "prestTotal"}, "Prestação TOTAL"), React.createElement("option", {value: "comProd"}, "Capital c/ produtos"), React.createElement("option", {value: "semProd"}, "Capital s/ produtos"), React.createElement("option", {value: "taeg"}, "TAEG (custo real)"), React.createElement("option", {value: "mtic"}, "MTIC (total pago)"), React.createElement("option", {value: "poupanca"}, "Maior poupança"), React.createElement("option", {value: "spread"}, "Spread"), React.createElement("option", {value: "esforco"}, "Taxa de Esforço"), React.createElement("option", {value: "seguros"}, "Seguros mais baratos")), React.createElement("button", {onClick:()=>window.print(),"aria-label":"Imprimir ou exportar PDF", style:{padding:"4px 10px",background:"rgba(37,99,235,0.1)",border:"1px solid rgba(37,99,235,0.3)",borderRadius:6,color:Au,fontSize:12,fontFamily:"sans-serif",cursor:"pointer"}}, "🖨️ Imprimir"))
          )), nav==="comp"&&(
          React.createElement("div", {style:{background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.15)",borderRadius:11,padding:16}}, tipoTaxa==="variável"&&(
              React.createElement("div", {style: {padding:"7px 12px",background:"rgba(2,132,199,0.06)",border:"1px solid rgba(2,132,199,0.2)",borderRadius:8,marginBottom:8,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}}, filtroEuribor==="all"?React.createElement(React.Fragment,null,"💡 Filtro «Indexante» na Comparação: com «Todas (3m / 6m / 12m)», cada linha é um par banco + Euribor; quem oferece mais do que um indexante aparece várias vezes. Com «Só Euribor …» ficam só os bancos com esse tenor no CH (precário), uma linha por banco. A ordem do quadro segue o critério do menu ao lado.",React.createElement("br",null),"✓ = spread confirmado pela API. Spread inclui ajuste LTV ("+pctR+"%) e finalidade."):React.createElement(React.Fragment,null,"💡 Com «Só Euribor ",React.createElement("strong",null,filtroEuribor),"» seleccionado: só entram bancos que disponibilizam esse indexante no CH (precário), uma linha por banco. Ordenação: critério do menu ao lado.",React.createElement("br",null),"✓ = spread confirmado pela API. Spread inclui ajuste LTV ("+pctR+"%) e finalidade."))
            ), filtroEuribor!=="all"&&tipoTaxa!=="variável"&&React.createElement("div", {style: {padding:"7px 12px",background:"rgba(2,132,199,0.06)",border:"1px solid rgba(2,132,199,0.2)",borderRadius:8,marginBottom:8,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}}, "💡 Taxa ",React.createElement("strong",null,tipoTaxa),": a coluna Euribor mostra ",React.createElement("strong",null,filtroEuribor)," como referência; só entram bancos que oferecem este indexante em variável (precário)."), resultados.length===0&&React.createElement("div", {style: {padding:"14px 16px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.35)",borderRadius:8,marginBottom:10,fontSize:12,color:"#991b1b",fontFamily:"sans-serif"}}, "Sem resultados para este filtro e tipo de taxa. Escolha «Todas» ou outro indexante, ou mude o tipo de taxa (variável / mista / fixa)."), React.createElement("div", {style: {overflowX:"auto"}}, React.createElement("table", {style: {width:"100%",borderCollapse:"separate",borderSpacing:"0 3px",fontFamily:"sans-serif",fontSize:11}}, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {rowSpan: 2, style: thSC}, "#"), React.createElement("th", {rowSpan: 2, style: thSC}, "BANCO"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:"#4b5563"}}, "EUR."), React.createElement("th", {colSpan: 2, style: {...thSC,textAlign:"center"}}, "SPREAD", React.createElement("br", null), React.createElement("span", {style: {fontSize:8,fontWeight:600,color:modoJovem?G:Au,letterSpacing:0.2}}, modoJovem?"Medida jovem":"Crédito normal")), React.createElement("th", {colSpan: 2, style: {...thSC,textAlign:"center"}}, "TAN"), carencia>0&&React.createElement("th", {rowSpan: 2, style: {...thSC,color:Sky,textAlign:"center"}}, "⚡CARÊNCIA", React.createElement("br", null), "/mês"), React.createElement("th", {colSpan: 2, style: {...thSC,textAlign:"center"}}, "PRESTAÇÃO CAPITAL"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:"#14532d"}}, "SEGUROS+IS"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:"#4b5563"}}, "CONTA"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:Au,fontWeight:700}}, "★ TOTAL"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:G}}, "POUPAR"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:Au}}, "DSTI"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:"#f97316"}}, "STRESS"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:Sky,fontWeight:700}}, "TAEG"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:"#4b5563"}}, "MTIC"), React.createElement("th", {rowSpan: 2, style: {...thSC,color:"#4b5563"}}, "CAPITAL", React.createElement("br", null), "OK?")), React.createElement("tr", null, React.createElement("th", {style: {...thSC,color:G,textAlign:"center"}}, "c/prod."), React.createElement("th", {style: {...thSC,color:R,textAlign:"center"}}, "s/prod."), React.createElement("th", {style: {...thSC,color:G,textAlign:"center"}}, "c/prod."), React.createElement("th", {style: {...thSC,color:R,textAlign:"center"}}, "s/prod."), React.createElement("th", {style: {...thSC,color:G,textAlign:"center"}}, "c/prod."), React.createElement("th", {style: {...thSC,color:R,textAlign:"center"}}, "s/prod."))), React.createElement("tbody", null, resultados.map((b,i)=>{
                    const prevBank = i>0 ? resultados[i-1].s : null;
                    const isContinuation = prevBank === b.s;
                    const distinctBanks = new Set(resultados.slice(0,i).map(r=>r.s)).size;
                    const bg=rbg(isContinuation?distinctBanks-1:distinctBanks);
                    const top=i===0;
                    const mPrec=margemVsOficial(b.ptC);
                    return(
                      React.createElement("tr", {key: b.rowKey, style: {background:bg}}, React.createElement("td", {style: {...tdBC,borderRadius:"6px 0 0 6px",background:bg,borderLeft:top?"3px solid "+Au:undefined}}, React.createElement("span", {style: {width:22,height:22,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:i===0?Au:i===1?"rgba(192,192,192,0.85)":i===2?"rgba(160,108,50,0.85)":"rgba(0,0,0,0.06)",color:i<=2?N:"#111827"}}, i+1)), React.createElement("td", {style: {...tdBC,background:bg,whiteSpace:"nowrap"}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:5}}, React.createElement("div", {style:{width:28,height:24,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+b.color+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}, React.createElement("img", {src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.s]||"bank.pt")+"&sz=32",width:20,height:20,style:{objectFit:"contain",display:"block"},alt:b.s,onError:function(e){const d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+b.color+'">'+b.s+'</span>';e.currentTarget.onError=null;}})), React.createElement("div", null, React.createElement("span", {style: {fontWeight:700,color:top?"#2563eb":"#111827",fontSize:13}}, b.name), b.spreadUpdated&&React.createElement("span", {style: {fontSize:8,color:G,marginLeft:3}}, "✓"), modoJovem&&React.createElement("span", {style: {fontSize:10,background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.25)",color:G,borderRadius:3,padding:"1px 4px",marginLeft:3}}, "JOVEM"), !b.capitalOk&&React.createElement("div", {style: {fontSize:8,color:R}}, capital<b.capitalMin?"⚠️ mín. "+fE(b.capitalMin):"⚠️ máx. "+fE(b.capitalMax)))), b.ltvAddon>0&&React.createElement("div", {style: {fontSize:8,color:Au,fontFamily:"monospace"}}, "LTV +"+b.ltvAddon.toFixed(2)+"pp")), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center"}}, React.createElement(RefBadge, {refKey: b.ref}), React.createElement("div", {style: {fontSize:10,color:"#111827",marginTop:1}}, b.ev.toFixed(3).replace(".",",")+"%")), React.createElement("td", {style: {...tdGC(i),fontWeight:700}}, fP(b.sCom)), React.createElement("td", {style: tdRC(i)}, fP(b.sSem)), React.createElement("td", {style: {...tdGC(i),fontWeight:700}}, fP(b.tanC)), React.createElement("td", {style: tdRC(i)}, fP(b.tanS)), carencia>0&&React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center",color:Sky,fontWeight:600}}, b.pCarenciaC?fE(b.pCarenciaC)+"/mês":"—"), React.createElement("td", {style: {...tdGC(i),fontSize:13,fontWeight:700,color:top?Au:G}}, fE(b.pC)), React.createElement("td", {style: {...tdRC(i),fontSize:13,fontWeight:700,color:R}}, fE(b.pS)), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center",color:"#14532d"}}, React.createElement("div", {style: {fontWeight:600,fontSize:12}}, fE(b.seg.tot+b.isM+(segProtecao?segProtMensal:0))+"/mês"), is2&&React.createElement("div", {style: {fontSize:8,color:"#4b5563"}}, "V1:"+fE(b.seg.v1)+" V2:"+fE(b.seg.v2)), b.isM>0&&React.createElement("div", {style: {fontSize:8,color:"#f97316"}}, "IS juros: "+fE(b.isM)+"/mês")), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center",color:"#4b5563"}}, React.createElement("div", {style: {fontSize:12}}, fE(b.contaM||0)+"/mês"), b.contaM>0&&React.createElement("div", {style: {fontSize:8,color:"#4b5563"}}, (b.contaNota||CONTA_MES[b.s]?.nota||"").split(" ")[0])), React.createElement("td", {style: {...tdBC,background:top?"rgba(37,99,235,0.1)":bg,textAlign:"center",borderLeft:"2px solid "+(top?Au:"rgba(37,99,235,0.15)"),borderRight:"2px solid "+(top?Au:"rgba(37,99,235,0.15)")}}, React.createElement("div", {style: {fontSize:top?18:14,fontWeight:700,color:top?Au:"#111827"}}, fE(b.ptC)+"/mês"), React.createElement("div", {style: {fontSize:9,color:"#6b7280",marginTop:1,fontFamily:"monospace",whiteSpace:"nowrap"}}, fE(b.ptC-mPrec)+"–"+fE(b.ptC+mPrec)), !b.capitalOk&&React.createElement("div", {style: {fontSize:8,color:R}}, capital<b.capitalMin?"Capital abaixo do mín.":"Capital acima do máx.")), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center"}}, React.createElement("div", {style: {fontWeight:700,color:G,fontSize:13}}, "+" + fE(b.diff)+"/mês"), React.createElement("div", {style: {fontSize:10,color:"#4b5563"}}, fE(b.diffTot)+" total")), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center"}}, rendT>0?React.createElement("div", null, React.createElement("div", {style: {fontWeight:700,color:ecC(b.efC),fontSize:13}}, b.efC.toFixed(1)+"%"), React.createElement("div", {style: {fontSize:10,color:ecC(b.efC)}}, ecL(b.efC))):React.createElement("span", {style: {color:"#4b5563"}}, "—")), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center"}}, rendT>0?React.createElement("div", null, React.createElement("div", {style: {fontWeight:700,color:ecC(b.efSt),fontSize:13}}, b.efSt.toFixed(1)+"%"), React.createElement("div", {style: {fontSize:10,color:"#f97316"}}, fE(b.pSt)+"/mês")):React.createElement("span", {style: {color:"#4b5563"}}, "—")), React.createElement("td", {style: {...tdBC,background:top?"rgba(2,132,199,0.08)":bg,textAlign:"center"}}, React.createElement("div", {style: {fontWeight:700,color:top?Sky:ecC((b.taeg||0)*8),fontSize:top?15:12}}, (b.taeg||0).toFixed(2).replace(".",",")+"%")), React.createElement("td", {style: {...tdBC,background:bg,textAlign:"center",color:"#4b5563"}}, React.createElement("div", {style: {fontSize:12}}, fE(b.mtic||0))), React.createElement("td", {style: {...tdBC,borderRadius:"0 6px 6px 0",background:bg,textAlign:"center"}}, b.capitalOk?React.createElement("span", {style: {color:G,fontSize:13}}, "✅"):React.createElement("span", {style: {color:R,fontSize:11}}, capital<b.capitalMin?"⚠️ mín."+fE(b.capitalMin):"⚠️ máx."+fE(b.capitalMax))))
                    );
                  }))))
        ,React.createElement("div",{style:{marginTop:14,padding:"10px 14px",background:"rgba(37,99,235,0.10)",border:"1px solid rgba(37,99,235,0.35)",borderRadius:9,fontFamily:"sans-serif"}},
          React.createElement("div",{style:{fontSize:12,fontWeight:700,color:Au,marginBottom:4}},"⚠️ Precisão"),
          React.createElement("div",{style:{fontSize:11,color:"#6b7280",lineHeight:1.7}},"Checagens com os simuladores online da CGD, Millennium BCP, Santander, BPI e Novo Banco (HPP, mesmos capital/prazo/indexante; Mai. 2026) encaixam no quadro interno: até ±5% na prestação mensal total, até ±0,30 p.p. na TAEG e até ±5% no MTIC quando o pacote de produtos e seguros coincide. Os maiores desvios vêm dos prémios de vida e multirriscos (saúde, tabaco, risco do imóvel). A parcela capital+juros (PMT) segue a anuidade usual. Na coluna ★ TOTAL, o intervalo é ±5% da estimativa (mín. 25 €); não substitui a proposta do banco.")
        ))
        ), nav==="seg"&&(
          React.createElement("div", null, React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:16,marginBottom:14}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "SEGUROS POR BANCO — "+titulares+" TITULAR"+(is2?"ES":"")+" · T1:"+idade1+"a"+(is2?" · T2:"+idade2+"a":"")+" · Capital: "+fE(capital)), React.createElement("div", {style: {overflowX:"auto"}}, React.createElement("table", {style: {width:"100%",borderCollapse:"separate",borderSpacing:"0 6px",fontFamily:"sans-serif",fontSize:13}}, React.createElement("thead", null, React.createElement("tr", null, ["Banco","Vida T1","Vida T2","Total Vida","Multirriscos","IS Juros/mês","Seg. Prot.","TOTAL/mês","Seguradoras"].map(h=>React.createElement("th", {key: h, style: {...thS,textAlign:"center"}}, h.toUpperCase())))), React.createElement("tbody", null, segChart.map((b,i)=>{
                      const bk=BANKS_STATIC.find(x=>x.s===b.name)||{};
                      const r2=resultados.find(x=>x.s===b.name);
                      const sg=r2?.seg||{v1:0,v2:0,vTot:0,m:0,tot:0};
                      const isM=r2?.isM||0;
                      return(
                        React.createElement("tr", {key: b.name, style: {background:i===0?"rgba(74,222,128,0.06)":rbg(i)}}, React.createElement("td", {style: {...tdB,borderRadius:"6px 0 0 6px",whiteSpace:"nowrap",borderLeft:i===0?"3px solid "+G:"3px solid transparent"}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:6}}, React.createElement("div", {style:{width:28,height:24,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+(bk.color||"#555")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}, React.createElement("img", {src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[bk.s]||"bank.pt")+"&sz=32",width:20,height:20,style:{objectFit:"contain",display:"block"},alt:bk.s||"",onError:function(e){const d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:8px;font-weight:700;font-family:monospace;color:'+(bk.color||"#aaa")+'">'+(bk.s||"")+"</span>";e.currentTarget.onError=null;}})), React.createElement("span", {style:{fontWeight:700,color:i===0?"#111827":"#374151",fontSize:13}}, bk.name||b.name))), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#14532d",fontWeight:600}}, fE2(sg.v1)+"/mês"), is2?React.createElement("td", {style: {...tdB,textAlign:"center",color:G,fontWeight:600}}, fE2(sg.v2)+"/mês"):React.createElement("td", {style: {...tdB,textAlign:"center",color:"#4b5563"}}, "—"), React.createElement("td", {style: {...tdB,textAlign:"center",color:G,fontWeight:700}}, fE2(sg.vTot)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#14532d"}}, fE2(sg.m)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#4b5563"}}, fE2(isM)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:segProtecao?Sky:"#4b5563"}}, segProtecao?fE2(segProtMensal)+"/mês":"—"), React.createElement("td", {style: {...tdB,textAlign:"center",fontWeight:700,color:i===0?G:"#111827",fontSize:i===0?15:12,borderLeft:"1px solid rgba(74,222,128,0.15)",borderRight:"1px solid rgba(74,222,128,0.15)"}}, fE2(sg.tot+isM+(segProtecao?segProtMensal:0))+"/mês"), React.createElement("td", {style: {...tdB,borderRadius:"0 6px 6px 0",color:"#4b5563",fontSize:11,whiteSpace:"nowrap"}}, ((r2?.insV||SEG[b.name]?.insV||"?")+" / "+(r2?.insM||SEG[b.name]?.insM||"?"))))
                      );
                    })))), React.createElement("div", {style: {marginTop:10,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:11,color:"#4b5563",fontFamily:"sans-serif",lineHeight:1.7}}, "ℹ️", React.createElement("strong", {style: {color:"#111827"}}, "IS sobre juros"), ": Imposto do Selo de 0,4% sobre os juros de cada prestação (art.º 1.º Tabela Geral TGIS). Todos os bancos cobram este imposto — está incluído na TAEG oficial mas raramente mostrado nos simuladores informais.", React.createElement("strong", {style: {color:"#111827"}}, "Seg. Protecção ao Crédito"), ": cobre prestações em caso de desemprego ou incapacidade temporária (opcional, ≈0,12%/ano sobre capital).")), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.12)",borderRadius:11,padding:14}}, React.createElement("div", {style: {fontSize:11,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "COMPOSIÇÃO SEGUROS POR BANCO"), (function(){
  var maxT=Math.max.apply(null,segChart.map(function(b){return (b["Vida T1"]||0)+(b["Vida T2"]||0)+(b["Multirriscos"]||0);}));
  if(!maxT)maxT=1;
  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",gap:16,marginBottom:10,flexWrap:"wrap",alignItems:"center"}},
      React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:"#c9a84c",borderRadius:2,opacity:0.85}}),"Vida T1"),
      is2&&React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:G,borderRadius:2,opacity:0.85}}),"Vida T2"),
      React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:Sky,borderRadius:2,opacity:0.8}}),"Multirriscos")
    ),
    React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:7}},
      segChart.map(function(b){
        var v1=b["Vida T1"]||0,v2=b["Vida T2"]||0,vm=b["Multirriscos"]||0,tot=v1+v2+vm;
        var bw=tot/maxT*100;
        var p1=tot?v1/tot*100:0,p2=tot?v2/tot*100:0,pm=tot?vm/tot*100:0;
        return React.createElement("div",{key:b.name,style:{display:"flex",alignItems:"center",gap:8}},
          React.createElement("div",{style:{width:130,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5,flexShrink:0}},
            React.createElement("span",{style:{fontSize:11,color:"#374151",fontFamily:"sans-serif",fontWeight:600,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
              (BANKS_STATIC.find(function(bk){return bk.s===b.name;})||{name:b.name}).name
            ),
            React.createElement("div",{style:{width:18,height:18,borderRadius:3,background:"rgba(0,0,0,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},
              React.createElement("img",{src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.name]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:b.name,onError:function(e){var d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:7px;font-weight:700;font-family:monospace;color:#666">'+b.name+'</span>';e.currentTarget.onError=null;}})
            )
          ),
          React.createElement("div",{style:{flex:1,height:18,background:"rgba(0,0,0,0.06)",borderRadius:4,overflow:"hidden"}},
            React.createElement("div",{style:{width:bw+"%",height:"100%",display:"flex"}},
              v1>0&&React.createElement("div",{style:{width:p1+"%",background:"#c9a84c",opacity:0.9,height:"100%"}}),
              v2>0&&React.createElement("div",{style:{width:p2+"%",background:G,opacity:0.85,height:"100%"}}),
              vm>0&&React.createElement("div",{style:{width:pm+"%",background:Sky,opacity:0.8,height:"100%"}})
            )
          ),
          React.createElement("span",{style:{width:56,fontSize:11,color:"#4b5563",fontFamily:"monospace",flexShrink:0,textAlign:"right"}},tot.toFixed(0)+"€/mês")
        );
      })
    ),
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginLeft:146,paddingRight:64,marginTop:5,fontSize:10,color:"#9bb4cc",fontFamily:"monospace"}},
      [0,0.25,0.5,0.75,1].map(function(f,i){return React.createElement("span",{key:i},Math.round(maxT*f)+"€");})
    ),
    React.createElement("div",{style:{marginTop:10,fontSize:11,color:"#6b7280",fontFamily:"sans-serif",lineHeight:1.6,background:"rgba(37,99,235,0.04)",border:"1px solid rgba(37,99,235,0.12)",borderRadius:6,padding:"6px 10px"}},
      "📊 ",React.createElement("strong",{style:{color:"#374151"}},"Como ler: "),
      "Cada barra representa o prémio mensal total de seguros obrigatórios do banco, proporcional ao máximo da lista. A parte ",React.createElement("strong",{style:{color:"#c9a84c"}},"dourada")," é o seguro de vida T1",is2&&React.createElement("span",null," (e ",React.createElement("strong",{style:{color:G}},"verde")," para T2)")," e a parte ",React.createElement("strong",{style:{color:Sky}},"azul-celeste")," é o seguro multirriscos. Os valores são estimativas baseadas nos prémios de referência de cada banco — variam com a idade dos titulares, capital seguro e valor de avaliação do imóvel."
    )
  );
})()))
        ), nav==="cust"&&(
          React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}}, React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:11,padding:16}}, React.createElement("div", {style: {marginBottom:12}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:8}}, "CUSTOS INICIAIS — "+(finalidade==="hpp"?"HPP":finalidade==="hab2"?"2.ª Habitação":"Arrendamento")), React.createElement("div", {style: {display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}, React.createElement("span", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif",flexShrink:0}}, "Banco:"), React.createElement("select", {value: bancoSCustos, onChange: e=>{setBancoCustos(e.target.value);}, style: {flex:1,minWidth:140,background:"#ffffff",border:"1px solid rgba(37,99,235,0.35)",color:"#111827",borderRadius:7,padding:"5px 9px",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}}, BANKS_STATIC.filter(b=>modoJovem?b.jOk:true).map(b=>(
                      React.createElement("option", {key: b.s, value: b.s}, b.name+(melhor&&melhor.s===b.s?" ⭐ (melhor)":""))
                    ))), melhor&&bancoSCustos!==melhor.s&&(
                    React.createElement("button", {onClick: ()=>setBancoCustos(melhor.s), style: {padding:"4px 10px",background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.35)",borderRadius:6,color:Au,fontSize:11,fontFamily:"sans-serif",cursor:"pointer"}}, "⭐ "+melhor.name)
                  )), comB.jovemIsenta&&modoJovem&&(
                  React.createElement("div", {style: {fontSize:10,color:G,fontFamily:"sans-serif",marginTop:4}}, "✅ "+bancoNomeCustos+" isenta comissão de dossier para jovens")
                )), [
                {k:"imovel",   l:"Valor do Imóvel",                      v:valorImovel},
                {k:"capital",  l:"Capital Emprestado",                    v:capital,      note:"LTV "+pctR+"%"},
                {k:"entrada",  l:"Entrada necessária",                    v:entrada,      c:entrada===0?G:Au, note:entrada===0?"100% financiado (garantia Estado)":null},
                {k:"sep1",     l:null},
                {k:"imt",      l:"IMT",                                   v:imt,          c:imt===0?G:R,  note:modoJovem&&finalidade==="hpp"&&imt===0?"Isento ≤35a (HPP ≤330.539€)":modoJovem&&finalidade==="hpp"&&imt>0&&valorImovel<=660982?"IMT parcial OE2026: 8% sobre (valor − 330.539€)":imt===0?"Isento":finalidade!=="hpp"?"Taxa progressiva 1-8% (Portaria 352/2024)":null},
                {k:"isesc",    l:"Imp. Selo escritura (0,8%)",            v:isEsc,        c:isEsc===0?G:undefined, note:modoJovem&&isEsc===0?"✅ Isento ≤35a":null},
                {k:"iscred",   l:"Imp. Selo crédito (0,6%)",             v:isCred,       c:undefined, note:modoJovem?"ℹ️ Não isento (só IS escritura é isento ≤35a)":null},
                {k:"sep2",     l:null},
                {k:"dossier",  l:"Comissão de dossier",                  v:comDossier,   c:comDossier===0?G:"#4b5563", note:comDossier===0?"✅ Banco isenta (jovem/promoção)":null},
                {k:"aval",     l:"Comissão de avaliação",                 v:comAval,      c:"#4b5563", note:"Perito independente (CMVM) — obrigatório"},
                ...(comMinutas>0?[{k:"minutas", l:"Preparação de minutas", v:comMinutas, c:"#4b5563"}]:[]),
                {k:"dpa",      l:"Documento Particular Autenticado (DPA)",v:dpa,          c:"#4b5563", note:"Alternativa à escritura notarial"},
                {k:"registo",  l:"Registo de hipoteca",                   v:registoHipoteca, c:registoHipoteca===0?G:"#4b5563", note:registoHipoteca===0?"✅ Isento ≤35a HPP (DL 48-D/2024)":"Emolumentos registo predial"},
                {k:"sep3",     l:null},
                {k:"total",    l:"TOTAL CUSTOS INICIAIS",                 v:totalCustos,  bold:true, c:R},
                {k:"nec",      l:"TOTAL NECESSÁRIO (entrada + custos)",   v:entrada+totalCustos, bold:true, c:Au, note:"Dinheiro líquido no dia da escritura"},
                {k:"sep4",     l:null},
                {k:"notario",  l:"Alternativa: escritura notarial",       v:notario,      c:"#4b5563", note:"Em vez do DPA — diferença: "+fE(notario-dpa)},
              ].map((item)=>{
                if (!item.l) return (React.createElement("div", {key: item.k, style: {height:1,background:"rgba(0,0,0,0.06)",margin:"8px 0"}}));
                const k=item.k, l=item.l, v=item.v, note=item.note, bold=item.bold;
                const clr=item.c||"#111827";
                return (
                  React.createElement("div", {key: k, style: {display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}}, React.createElement("div", null, React.createElement("div", {style: {fontSize:13,color:bold?"#111827":"#374151",fontFamily:"sans-serif",fontWeight:bold?700:400}}, l), note&&React.createElement("div", {style: {fontSize:10,color:clr,fontFamily:"sans-serif"}}, note)), React.createElement("div", {style: {fontSize:bold?16:14,fontWeight:bold?700:600,color:clr,fontFamily:"sans-serif",whiteSpace:"nowrap",marginLeft:12}}, fE(v)))
                );
              })), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "COMISSÕES POR BANCO"+(bancoSCustos?" — "+bancoNomeCustos+" em destaque":"")), React.createElement("div", {style: {overflowX:"auto"}}, React.createElement("table", {style: {width:"100%",borderCollapse:"separate",borderSpacing:"0 4px",fontFamily:"sans-serif",fontSize:12}}, React.createElement("thead", null, React.createElement("tr", null, ["Banco","Capital Mín.","Capital Máx.","Dossier","Avaliação","Jovem?"].map(h=>(
                      React.createElement("th", {key: h, style: {...thS,textAlign:"center"}}, h.toUpperCase())
                    )))), React.createElement("tbody", null, BANKS_STATIC.filter(b=>modoJovem?b.jOk:true).map((b,i)=>{
                      const limFb=CAPITAL_LIMITS[b.s]||{min:0,max:999999};
                      const lim={min:bankData[b.s]?.capMin??limFb.min,max:bankData[b.s]?.capMax??limFb.max};
                      const com2Fb=COM[b.s]||{dossier:300,avaliacao:230,minutas:0};
                      const com2={...com2Fb,dossier:bankData[b.s]?.dossier??com2Fb.dossier,avaliacao:bankData[b.s]?.avaliacao??com2Fb.avaliacao};
                      const capOk=capital>=(lim.min||0)&&capital<=(lim.max||9999999);
                      const isSelected=b.s===bancoSCustos;
                      const isBest=melhor&&b.s===melhor.s;
                      return(
                        React.createElement("tr", {key: b.s, onClick: ()=>setBancoCustos(b.s), style: {background:isSelected?"rgba(37,99,235,0.10)":rbg(i),cursor:"pointer"}}, React.createElement("td", {style: {...tdB,borderRadius:"6px 0 0 6px",borderLeft:isSelected?"3px solid "+Au:"3px solid transparent"}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:6}}, React.createElement("div", {style:{width:26,height:22,borderRadius:4,background:"rgba(0,0,0,0.05)",border:"1px solid "+(b.color||"#555")+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}, React.createElement("img", {src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.s]||"bank.pt")+"&sz=32",width:18,height:18,style:{objectFit:"contain",display:"block"},alt:b.s,onError:function(e){const d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:7px;font-weight:700;font-family:monospace;color:'+(b.color||"#aaa")+'">'+(b.s||"")+"</span>";e.currentTarget.onError=null;}})), React.createElement("span", {style: {fontWeight:isSelected?700:600,color:capOk?(isSelected?"#1e40af":"#111827"):R}}, b.name), isBest&&React.createElement("span", {style: {fontSize:10,color:Au,marginLeft:2}}, "⭐"), isSelected&&React.createElement("span", {style: {fontSize:8,background:"rgba(37,99,235,0.2)",color:Au,borderRadius:3,padding:"1px 4px",marginLeft:2}}, "SELEC."))), React.createElement("td", {style: {...tdB,textAlign:"center",color:capital<(lim.min||0)?R:"#4b5563"}}, fE(lim.min||0)), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#4b5563"}}, fE(lim.max||999999)), React.createElement("td", {style: {...tdB,textAlign:"center",color:(com2.dossier||0)===0?G:isSelected?Au:"#4b5563",fontWeight:isSelected?700:400}}, (com2.dossier||0)===0?"✅ 0€":fE(com2.dossier||0)), React.createElement("td", {style: {...tdB,textAlign:"center",color:isSelected?Au:"#4b5563",fontWeight:isSelected?700:400}}, fE(com2.avaliacao||0)), React.createElement("td", {style: {...tdB,borderRadius:"0 6px 6px 0",textAlign:"center"}}, b.jOk ? (React.createElement("span", {style: {color:G,fontSize:13}}, "✅")) : (React.createElement("span", {style: {color:R,fontSize:13}}, "❌"))))
                      );
                    })))), React.createElement("div", {style: {marginTop:12,padding:"8px 12px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:8,fontSize:11,color:"#4b5563",fontFamily:"sans-serif",lineHeight:1.7}}, "DPA (Documento Particular Autenticado) = formalização pelo advogado do banco, sem necessidade de notário. Custo típico: €150-200. Escritura notarial = alternativa mais cara (€500-900) mas obrigatória em alguns casos. Registo de hipoteca: emolumentos a pagar no registo predial (isento para jovens HPP, DL 48-D/2024).")))
        ), nav==="viab"&&(
          React.createElement("div", null, React.createElement("div", {style: {background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:10,padding:"12px 16px",marginBottom:12,fontFamily:"sans-serif",fontSize:12}}, React.createElement("div", {style: {fontWeight:700,color:Au,marginBottom:8}}, "📅 Regras de Prazo — BdP (Aviso 4/2022) · todos os bancos"), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:7,lineHeight:1.7}}, React.createElement("div", {style: {color:idadeMax<=30?G:"#4b5563"}}, "≤ 30a → máx. ", React.createElement("strong", {style: {color:idadeMax<=30?G:"#111827"}}, "40 anos")), React.createElement("div", {style: {color:idadeMax>30&&idadeMax<=35?G:"#4b5563"}}, "30-35a → máx. ", React.createElement("strong", {style: {color:idadeMax>30&&idadeMax<=35?G:"#111827"}}, "37 anos")), React.createElement("div", {style: {color:idadeMax>35?G:"#4b5563"}}, "&gt; 35a → máx. ", React.createElement("strong", {style: {color:idadeMax>35?G:"#111827"}}, "35 anos")), React.createElement("div", {style: {color:"#4b5563"}}, "Limite: idade + prazo ≤ ", React.createElement("strong", {style: {color:"#111827"}}, "75 anos"))), React.createElement("div", {style: {marginTop:7,padding:"5px 10px",background:"rgba(0,0,0,0.2)",borderRadius:5,fontSize:11}}, "Titular mais velho: ", React.createElement("strong", {style: {color:Au}}, idadeMax+"a"), " · BdP: ", React.createElement("strong", {style: {color:Au}}, prazoMaxBdP+"a"), " · 75a: ", React.createElement("strong", {style: {color:prazoMax75<=prazoMaxBdP?R:Au}}, prazoMax75+"a"), " → Efectivo: ", React.createElement("strong", {style: {color:G}}, prazoR+"a"), " · ", React.createElement("span", {style: {color:"#4b5563"}}, prazoLimLabel)), is2&&React.createElement("div", {style: {marginTop:5,fontSize:11,color:"#4b5563"}}, "👥 Rend. conjunto considerado: ", React.createElement("strong", {style: {color:G}}, fE(rendT)+"/mês"), " = T1 "+fE(rendAdj1)+(tipoC1!=="efetivo"?" ("+Math.round(CONTRATO_FACTOR[tipoC1]*100)+"%)":"")+(is2?" + T2 "+fE(rendAdj2)+(tipoC2!=="efetivo"?" ("+Math.round(CONTRATO_FACTOR[tipoC2]*100)+"%)":""):"")+( dependentes>0?" − dependentes "+fE(dependentes*400):""))), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:11,padding:"18px 16px"}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:12}}, "DSTI — POR BANCO / INDEXANTE (inclui seguros + IS + seg. protecção)"), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}, resultados.map(b=>{
                  const ok=b.efC<=40;
                  return(
                    React.createElement("div", {key: b.rowKey, style: {background:"rgba("+(ok?"74,222,128":"248,113,113")+",0.05)",border:"1px solid rgba("+(ok?"74,222,128":"248,113,113")+",0.25)",borderRadius:10,padding:"14px 15px"}}, React.createElement("div", {style: {display:"flex",alignItems:"center",gap:5,marginBottom:8,flexWrap:"wrap"}}, React.createElement("div", {style: {width:3,height:15,borderRadius:2,background:b.color,flexShrink:0}}), React.createElement("div", {style: {fontSize:12,fontWeight:700,color:"#111827",fontFamily:"sans-serif",flex:1}}, b.name), React.createElement(RefBadge, {refKey: b.ref})), React.createElement("div", {style: {fontSize:28,fontWeight:700,color:ecC(b.efC),fontFamily:"sans-serif",lineHeight:1,marginBottom:3}}, b.efC.toFixed(1)+"%"), React.createElement("div", {style: {fontSize:11,color:ecC(b.efC),fontFamily:"sans-serif",marginBottom:10,fontWeight:600}}, ecL(b.efC)), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr auto",rowGap:5,columnGap:10}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}}, "Prestação"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif",fontWeight:600,textAlign:"right"}}, fE(b.pC)+"/mês"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}}, "Seguros+IS"), React.createElement("div", {style: {fontSize:11,color:"#14532d",fontFamily:"sans-serif",fontWeight:600,textAlign:"right"}}, fE(b.seg.tot+b.isM)+"/mês"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}}, "Stress +1,5pp"), React.createElement("div", {style: {fontSize:11,color:"#f97316",fontFamily:"sans-serif",fontWeight:600,textAlign:"right"}}, b.efSt.toFixed(1)+"%")), !b.capitalOk&&React.createElement("div", {style: {fontSize:10,color:R,fontFamily:"sans-serif",marginTop:6}}, capital<b.capitalMin?"⚠️ mín. "+fE(b.capitalMin):"⚠️ máx. "+fE(b.capitalMax)), React.createElement("div", {style: {marginTop:10,height:6,background:"rgba(0,0,0,0.08)",borderRadius:3,overflow:"hidden"}}, React.createElement("div", {style: {height:"100%",width:Math.min(b.efC,60)/60*100+"%",background:ecC(b.efC),borderRadius:3}})))
                  );
                }))))
        ), nav==="cen"&&(
          React.createElement("div", null, tipoTaxa!=="variável" ? (
              React.createElement("div", {style: {padding:"10px 14px",background:"rgba(37,99,235,0.06)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:9,fontFamily:"sans-serif",fontSize:12,color:"#4b5563"}}, "ℹ️ Selecione taxa variável para ver os cenários de Euribor.")
            ) : melhor&&(
                React.createElement("div", null, React.createElement("div", {style:{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}, React.createElement("span", {style:{fontSize:11,color:"#4b5563",fontFamily:"sans-serif",flexShrink:0}}, "Banco:"), React.createElement("select", {value:bancoCenS,onChange:e=>setBancoCen(e.target.value),style:{flex:1,minWidth:140,background:"#ffffff",border:"1px solid rgba(37,99,235,0.35)",color:"#111827",borderRadius:7,padding:"5px 9px",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}}, resultados.filter((r,i,arr)=>arr.findIndex(x=>x.s===r.s)===i).map(r=>(React.createElement("option", {key:r.s,value:r.s}, r.name+(melhor&&r.s===melhor.s?" ⭐ (melhor)":"")+" · Eur."+r.ref+" · TAN "+fP(r.tanC))))), melhor&&bancoCenS!==melhor.s&&React.createElement("button", {onClick:()=>setBancoCen(melhor.s),style:{padding:"4px 10px",background:"rgba(37,99,235,0.12)",border:"1px solid rgba(37,99,235,0.35)",borderRadius:6,color:Au,fontSize:11,fontFamily:"sans-serif",cursor:"pointer"}}, "⭐ "+melhor.name)), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:11,padding:16,marginBottom:14}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:8}}, "CENÁRIOS — "+(bancoCenRow?.name||melhor.name)+" · spread "+fP(bancoCenRow?.sCom||melhor.sCom)+" · Eur.actual "+(bancoCenRow?.ev||melhor.ev).toFixed(3).replace(".",",")+"%  (inclui IS juros + seguros)"), React.createElement("div", {style: {overflowX:"auto"}}, React.createElement("table", {style: {width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",fontFamily:"sans-serif",fontSize:13}}, React.createElement("thead", null, React.createElement("tr", null, ["Cenário","Euribor","TAN","Capital","IS Juros","+ Seguros","TOTAL","DSTI","Stress","DSTI Stress"].map(h=>React.createElement("th", {key: h, style: {...thS,textAlign:"center"}}, h.toUpperCase())))), React.createElement("tbody", null, cenarios.map(c=>(
                            React.createElement("tr", {key: c.label, style: {background:c.delta===0?"rgba(37,99,235,0.11)":c.delta<0?"rgba(74,222,128,0.055)":"rgba(248,113,113,0.055)"}}, React.createElement("td", {style: {...tdB,borderRadius:"6px 0 0 6px",borderLeft:c.delta===0?"3px solid "+Au:c.delta<0?"3px solid rgba(74,222,128,0.35)":"3px solid rgba(248,113,113,0.3)",fontWeight:c.delta===0?700:400,color:c.delta===0?Au:c.delta<0?G:R,textAlign:"center"}}, c.label), React.createElement("td", {style: {...tdB,textAlign:"center",fontFamily:"monospace",color:"#111827"}}, c.eur.toFixed(3).replace(".",",")+"%"), React.createElement("td", {style: {...tdB,textAlign:"center",fontFamily:"monospace",color:"#111827"}}, c.tan.toFixed(3).replace(".",",")+"%"), React.createElement("td", {style: {...tdB,textAlign:"center",fontWeight:700,color:c.delta===0?Au:c.delta<0?G:R,fontSize:c.delta===0?15:12}}, fE(c.p)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#4b5563"}}, fE(isJurosMedioMensal(capital,c.tan,prazoR,finalidade))+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#14532d"}}, fE(melhor.seg.tot)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center",fontWeight:700,fontSize:c.delta===0?17:13,color:c.delta===0?Au:c.delta<0?G:R}}, fE(c.pt)+"/mês"), React.createElement("td", {style: {...tdB,textAlign:"center"}}, rendT>0?React.createElement("span", {style: {color:ecC(c.ef),fontWeight:700}}, c.ef.toFixed(1)+"%"):React.createElement("span", {style: {color:"#4b5563"}}, "—")), React.createElement("td", {style: {...tdB,textAlign:"center",color:"#f97316"}}, fE(c.st)+"/mês"), React.createElement("td", {style: {...tdB,borderRadius:"0 6px 6px 0",textAlign:"center"}}, rendT>0?React.createElement("span", {style: {color:ecC(c.efSt),fontWeight:700}}, c.efSt.toFixed(1)+"%"):React.createElement("span", {style: {color:"#4b5563"}}, "—")))
                          )))))), React.createElement("div",{style:{background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.1)",borderRadius:11,padding:14,marginBottom:14}},React.createElement("div",{style:{fontSize:11,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:10}},"PRESTAÇÃO TOTAL POR BANCO · EURIBOR ACTUAL"),(function(){var rr=resultados.filter(function(r,i,arr){return arr.findIndex(function(x){return x.s===r.s;})===i;}).slice().sort(function(a,b){return (a.ptC||0)-(b.ptC||0);});var maxT=Math.max.apply(null,rr.map(function(b){return (b.pC||0)+(b.isM||0)+((b.seg&&b.seg.tot)||0)+(b.contaM||0)+(segProtecao?segProtMensal:0);}));if(!maxT)maxT=1;return React.createElement("div",null,React.createElement("div",{style:{display:"flex",gap:16,marginBottom:10,flexWrap:"wrap",alignItems:"center"}},React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:"#c9a84c",borderRadius:2}}),"Capital"),React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:"#f97316",borderRadius:2}}),"IS Juros"),React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:G,borderRadius:2}}),"Seguros"),React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:Sky,borderRadius:2,opacity:0.8}}),"Conta"),segProtecao&&React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:"#4b5563",fontFamily:"sans-serif"}},React.createElement("span",{style:{display:"inline-block",width:12,height:12,background:"#8b5cf6",borderRadius:2,opacity:0.8}}),"Protecção")),React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:7}},rr.map(function(b,i){var pc=b.pC||0,im=b.isM||0,sg=(b.seg&&b.seg.tot)||0,cm=b.contaM||0,pr=segProtecao?segProtMensal:0;var tot=pc+im+sg+cm+pr;var bw=tot/maxT*100;var pp=tot?pc/tot*100:0,ip=tot?im/tot*100:0,sp=tot?sg/tot*100:0,cp=tot?cm/tot*100:0,prp=tot?pr/tot*100:0;var isTop=i===0;return React.createElement("div",{key:b.s,style:{display:"flex",alignItems:"center",gap:8}},React.createElement("div",{style:{width:130,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5,flexShrink:0}},React.createElement("span",{style:{fontSize:11,color:isTop?"#2563eb":"#374151",fontFamily:"sans-serif",fontWeight:700,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},b.name),React.createElement("div",{style:{width:18,height:18,borderRadius:3,background:"rgba(0,0,0,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}},React.createElement("img",{src:"https://www.google.com/s2/favicons?domain="+(BANK_DOMAINS[b.s]||"bank.pt")+"&sz=32",width:16,height:16,style:{objectFit:"contain",display:"block"},alt:b.s,onError:function(e){var d=e.currentTarget.parentElement;d.innerHTML='<span style="font-size:7px;font-weight:700;font-family:monospace;color:#666">'+b.s+'</span>';e.currentTarget.onError=null;}}))),React.createElement("div",{style:{flex:1,height:18,background:"rgba(0,0,0,0.06)",borderRadius:4,overflow:"hidden"}},React.createElement("div",{style:{width:bw+"%",height:"100%",display:"flex"}},pc>0&&React.createElement("div",{style:{width:pp+"%",background:"#c9a84c",height:"100%"}}),im>0&&React.createElement("div",{style:{width:ip+"%",background:"#f97316",opacity:0.85,height:"100%"}}),sg>0&&React.createElement("div",{style:{width:sp+"%",background:G,opacity:0.85,height:"100%"}}),cm>0&&React.createElement("div",{style:{width:cp+"%",background:Sky,opacity:0.8,height:"100%"}}),pr>0&&React.createElement("div",{style:{width:prp+"%",background:"#8b5cf6",opacity:0.8,height:"100%"}}))),React.createElement("span",{style:{width:60,fontSize:11,color:isTop?Au:"#4b5563",fontFamily:"monospace",flexShrink:0,textAlign:"right",fontWeight:isTop?700:400}},fE(tot)+"/mês"));})),React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginLeft:146,paddingRight:68,marginTop:5,fontSize:10,color:"#9bb4cc",fontFamily:"monospace"}},[0,0.25,0.5,0.75,1].map(function(f,i){return React.createElement("span",{key:i},Math.round(maxT*f)+"€");})),React.createElement("div",{style:{marginTop:10,fontSize:11,color:"#6b7280",fontFamily:"sans-serif",lineHeight:1.6,background:"rgba(37,99,235,0.04)",border:"1px solid rgba(37,99,235,0.12)",borderRadius:6,padding:"6px 10px"}},"📊 ",React.createElement("strong",{style:{color:"#374151"}},"Como ler: "),"Cada barra representa a prestação mensal total de cada banco ao Euribor actual, proporcional ao máximo da lista. A componente ",React.createElement("strong",{style:{color:"#c9a84c"}},"dourada")," é a prestação de capital, a ",React.createElement("strong",{style:{color:"#f97316"}},"laranja")," o Imposto de Selo sobre juros, a ",React.createElement("strong",{style:{color:G}},"verde")," os seguros obrigatórios e a ",React.createElement("strong",{style:{color:Sky}},"azul-celeste")," a comissão de conta. Os valores incluem domiciliação de ordenado."));})()), fixaB&&(
                    React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(2,132,199,0.25)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Sky,fontFamily:"monospace",marginBottom:8}}, "FIXA vs. VARIÁVEL — PONTO DE EQUILÍBRIO"), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}, [{l:"Taxa Fixa ("+fixaB.name+")",v:fP(fixaB.fCom),c:Sky,note:null},{l:"Taxa Variável actual",v:fP(fixaB.tanC),c:G,note:"Eur."+fixaB.ev.toFixed(3).replace(".",",")+"%"},{l:"Euribor break-even",v:brkEur?fP(brkEur):"—",c:brkEur&&fixaB.ev>brkEur?R:Au,note:brkEur&&fixaB.ev>brkEur?"⚠ já acima — fixa vantajosa":brkEur?"actual abaixo — variável melhor":null}].map(({l,v,c,note})=>React.createElement("div", {key:l,style:{background:"rgba(255,255,255,1)",border:"1px solid rgba(0,0,0,0.06)",borderRadius:8,padding:"10px 12px"}}, React.createElement("div", {style:{fontSize:10,color:"#4b5563",fontFamily:"monospace",letterSpacing:1,marginBottom:4}}, l.toUpperCase()), React.createElement("div", {style:{fontSize:18,fontWeight:700,color:c,fontFamily:"sans-serif"}}, v), note&&React.createElement("div", {style:{fontSize:10,color:c,fontFamily:"sans-serif",marginTop:2,opacity:0.85}}, note)))), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}, ["variável","fixa"].map(tipo=>{
                          const tan=tipo==="variável"?fixaB.tanC:fixaB.fCom;
                          const p=calcP(capital,tan,prazoR), isM2=isJurosMedioMensal(capital,tan,prazoR,finalidade);
                          const pt=p+fixaB.seg.tot+isM2+segProtMensal;
                          const clr=tipo==="variável"?G:Sky;
                          return(
                            React.createElement("div", {key: tipo, style: {background:"rgba("+(tipo==="variável"?"74,222,128":"125,211,252")+",0.06)",border:"1px solid rgba("+(tipo==="variável"?"74,222,128":"125,211,252")+",0.25)",borderRadius:9,padding:"12px 14px"}}, React.createElement("div", {style: {fontSize:12,fontWeight:700,color:clr,fontFamily:"sans-serif",textTransform:"uppercase",marginBottom:6}}, "Taxa "+tipo), React.createElement("div", {style: {fontSize:20,fontWeight:700,color:"#111827",fontFamily:"sans-serif",lineHeight:1}}, fE(p)+"/mês"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginBottom:4}}, "capital"), React.createElement("div", {style: {fontSize:14,fontWeight:700,color:clr,fontFamily:"sans-serif"}}, fE(pt)+"/mês total"), React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"sans-serif",marginTop:4}}, "IS juros: "+fE(isM2)+" · Juros totais: "+fE(p*prazoR*12-capital)))
                          );
                        })))
                  ))
              ))
        ), nav==="amort"&&(
          React.createElement("div", null, carencia>0&&(
              React.createElement("div", {style: {background:"rgba(2,132,199,0.06)",border:"1px solid rgba(2,132,199,0.25)",borderRadius:10,padding:"9px 14px",marginBottom:12,fontFamily:"sans-serif",fontSize:12,color:"#4b5563"}}, "⚡ Carência de capital: ", React.createElement("strong", {style: {color:Sky}}, carencia+" meses"), " · Prestação durante a carência (só juros): ", React.createElement("strong", {style: {color:Sky}}, bancoAmortRow?fE(bancoAmortRow.pCarenciaC||0)+"/mês":"—"), " · Após carência: ", React.createElement("strong", {style: {color:Au}}, bancoAmortRow?fE(bancoAmortRow.pC)+"/mês":"—"))
            ), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:14}}, React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:Au,fontFamily:"monospace",marginBottom:10}}, "AMORTIZAÇÃO ANTECIPADA ANUAL"), React.createElement("div", {style: {marginBottom:12}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:5,fontFamily:"sans-serif"}}, "BANCO"), React.createElement("select", {value: bancoAmortS, onChange: e=>setBancoAmort(e.target.value), style: {width:"100%",background:"#ffffff",border:"1px solid rgba(37,99,235,0.35)",color:"#111827",borderRadius:7,padding:"6px 9px",fontSize:13,fontFamily:"sans-serif",cursor:"pointer",fontWeight:600}}, resultados.filter((r,i,arr)=>arr.findIndex(x=>x.s===r.s)===i).map(r=>(
                      React.createElement("option", {key: r.s, value: r.s}, r.name+(melhor&&r.s===melhor.s?" ⭐":"")+" · Eur."+r.ref+" · TAN "+fP(r.tanC))
                    )))), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12,padding:"10px 12px",background:"rgba(37,99,235,0.05)",border:"1px solid rgba(37,99,235,0.2)",borderRadius:8}}, [
                    {l:"Banco",    v:bancoAmortNome,  c:"#111827"},
                    {l:"Indexante",v:bancoAmortRef,    c:"#111827", badge:true},
                    {l:"TAN",      v:fP(tanBest),      c:Au},
                    {l:"Prestação capital", v:bancoAmortRow?fE(bancoAmortRow.pC)+"/mês":"—", c:Au},
                    {l:"Seguros banco", v:bancoAmortRow?fE(bancoAmortRow.seg.tot)+"/mês":"—", c:G},
                    {l:"TOTAL/mês", v:bancoAmortRow?fE(bancoAmortRow.ptC)+"/mês":"—", c:Au, big:true},
                  ].map(({l,v,c,badge,big})=>(
                    React.createElement("div", {key: l}, React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}, l.toUpperCase()), React.createElement("div", {style: {fontSize:big?17:13,fontWeight:700,color:c||"#111827",fontFamily:"sans-serif"}}, badge?(React.createElement(RefBadge, {refKey: v})):v))
                  ))), React.createElement("div", {style: {fontSize:10,color:"#4b5563",fontFamily:"sans-serif",marginBottom:10}}, "ℹ️ HPP taxa variável: ", React.createElement("strong", {style: {color:G}}, "sem comissão de reembolso antecipado"), " (Lei 1/2025). Taxa fixa: 2% sobre capital amortizado."), React.createElement("div", {style: {fontSize:11,color:"#4b5563",marginBottom:3,fontFamily:"sans-serif"}}, "AMORTIZAÇÃO EXTRA / ANO"), React.createElement(SliderInput, {min: 0, max: 50000, step: 500, value: amortExtra, onChange: setAmortExtra, color: G, suffix: "€/ano", formatFn: v=>v===0?"0":v.toLocaleString('pt-PT')}), React.createElement("div", {style: {fontSize:13,fontWeight:700,color:amortExtra>0?G:"#4b5563",marginTop:2}}, amortExtra===0?"Sem amortização extra":"")), React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:11,padding:16}}, React.createElement("div", {style: {fontSize:12,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:12}}, "IMPACTO DA AMORTIZAÇÃO"), [{label:"Sem amortização",d:amSem,ex:0},...(amCom?[{label:"Com "+fE(amortExtra)+"/ano",d:amCom,ex:amortExtra}]:[])].map(({label,d,ex})=>(
                  React.createElement("div", {key: label, style: {marginBottom:10,padding:"12px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba("+(ex>0?"74,222,128":"255,255,255")+",0.08)",borderRadius:8}}, React.createElement("div", {style: {fontSize:12,fontWeight:700,color:ex>0?G:Au,fontFamily:"sans-serif",marginBottom:10}}, label), React.createElement("div", {style: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}, [{l:"Prazo efetivo",v:Math.floor(d.meses/12)+"a "+d.meses%12+"m"},{l:"Total juros",v:fE(d.juros)},{l:"Prazo poupado",v:ex>0?d.poupados+" meses":"—"},{l:"Poupança juros",v:ex>0?fE(d.economia):"—"}].map(({l,v})=>(
                        React.createElement("div", {key: l}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",fontFamily:"monospace",letterSpacing:1,marginBottom:2}}, l.toUpperCase()), React.createElement("div", {style: {fontSize:15,fontWeight:700,color:ex>0&&v!=="—"&&(l.includes("Poupança")||l.includes("Prazo p"))?G:"#111827",fontFamily:"sans-serif"}}, v))
                      ))), ex>0&&amCom&&(
                      React.createElement("div", {style: {marginTop:10,padding:"10px 14px",background:"rgba(74,222,128,0.09)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:8}}, React.createElement("div", {style: {fontSize:10,color:"rgba(74,222,128,0.6)",fontFamily:"monospace",letterSpacing:1,marginBottom:3}}, "POUPANÇA TOTAL"), React.createElement("div", {style: {fontSize:22,fontWeight:700,color:G,fontFamily:"sans-serif",lineHeight:1}}, fE(amCom.economia)), React.createElement("div", {style: {fontSize:12,color:"#4b5563",fontFamily:"sans-serif",marginTop:5}}, "Termina "+amCom.poupados+" meses mais cedo · ROI: "+((amCom.economia/amortExtra/prazoR)*100).toFixed(1)+"%/ano"))
                    ))
                )))), amortExtra>0&&amCh.length>0&&(
              React.createElement("div", {style: {background:"rgba(255,255,255,1)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:11,padding:14}}, React.createElement("div", {style: {fontSize:11,letterSpacing:2,color:G,fontFamily:"monospace",marginBottom:10}}, "CAPITAL EM DÍVIDA AO LONGO DO TEMPO"), React.createElement(ResponsiveContainer, {width: "100%", height: 250}, React.createElement(LineChart, {data: amCh, margin: {top:5,right:10,left:5,bottom:5}}, React.createElement(CartesianGrid, {strokeDasharray: "3 3", stroke: "rgba(0,0,0,0.05)"}), React.createElement(XAxis, {dataKey: "ano", tick: {fill:"#4b5563",fontSize:11}, axisLine: false, tickLine: false}), React.createElement(YAxis, {tick: {fill:"#4b5563",fontSize:11}, axisLine: false, tickLine: false, tickFormatter: v=>Math.round(v/1000)+"k€"}), React.createElement(Tooltip, {formatter: (v,n)=>[fE(v),n], contentStyle: {background:"#ffffff",border:"1px solid "+Au,borderRadius:8,color:"#111827",fontFamily:"sans-serif",fontSize:12}, labelFormatter: l=>"Ano "+l}), React.createElement(Legend, {wrapperStyle: {color:"#4b5563",fontSize:12,fontFamily:"sans-serif"}}), React.createElement(Line, {type: "monotone", dataKey: "Sem amort.", stroke: R, strokeWidth: 2, dot: false}), React.createElement(Line, {type: "monotone", dataKey: "Com amort.", stroke: G, strokeWidth: 2.5, dot: false}))))
            ))
        ), React.createElement("div", {style: {marginTop:14,padding:"10px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,fontFamily:"sans-serif"}}, React.createElement("div", {style: {fontSize:12,fontWeight:700,color:Au,marginBottom:4}}, "⚠️ Simulação indicativa — não substitui a FINE"), React.createElement("div", {style: {fontSize:11,color:"#6b7280",lineHeight:1.7}}, "Os valores apresentados são estimativas com base em spreads e comissões publicadas. As condições efectivas dependem da análise de risco de cada banco. Consulte sempre a Ficha de Informação Normalizada Europeia (FINE) antes de contratar.")), React.createElement("div", {style: {marginTop:6,padding:"10px 14px",background:"rgba(255,255,255,1)",border:"1px solid rgba(37,99,235,0.25)",borderRadius:9,fontFamily:"sans-serif"}}, React.createElement("div", {style: {fontSize:11,color:"#4b5563",lineHeight:1.7}}, "🔄 Euribor via BCE · Cache 8h. 📊 Spread: LTV + finalidade + cert. energético. 🧮 TAEG: Directiva 2014/17/UE. 💰 MTIC = total pago. 🛡️ Seg. vida sobre capital médio. 🏠 IS HPP: €0 (art. 7º CIS). 📅 Prazo: BdP Aviso 4/2022."))))
  ,showComments&&React.createElement("div", {onClick:()=>setShowComments(false),style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}},
            React.createElement("div", {onClick:e=>e.stopPropagation(),style:{background:"#ffffff",borderRadius:14,width:"100%",maxWidth:580,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",fontFamily:"'Inter',system-ui,sans-serif"}},
              React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid rgba(0,0,0,0.07)"}},
                React.createElement("div", null,
                  React.createElement("div", {style:{fontSize:15,fontWeight:700,color:"#111827"}}, "💬 Comentários da Comunidade"),
                  React.createElement("div", {style:{fontSize:11,color:"#6b7280",marginTop:2}}, "Partilha a tua experiência: quanto calculou o simulador vs o que conseguiste")
                ),
                React.createElement("button", {onClick:()=>setShowComments(false),style:{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#6b7280",padding:"0 4px",lineHeight:1}}, "✕")
              ),
              React.createElement("div", {style:{flex:1,overflowY:"auto",padding:"14px 18px"}},
                React.createElement("form", {onSubmit:submitComment,style:{background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.18)",borderRadius:10,padding:14,marginBottom:16}},
                  React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:1,marginBottom:10,fontFamily:"monospace"}}, "DEIXA O TEU COMENTÁRIO"),
                  React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
                    React.createElement("div", null,
                      React.createElement("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Nome (opcional)"),
                      React.createElement("input", {value:commentForm.name,onChange:e=>setCommentForm(f=>({...f,name:e.target.value})),placeholder:"Anónimo",maxLength:50,style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
                    ),
                    React.createElement("div", null,
                      React.createElement("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Banco (opcional)"),
                      React.createElement("input", {value:commentForm.bank,onChange:e=>setCommentForm(f=>({...f,bank:e.target.value})),placeholder:"ex: CGD, BPI...",maxLength:40,style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
                    )
                  ),
                  React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
                    React.createElement("div", null,
                      React.createElement("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Simulador calculou (€/mês)"),
                      React.createElement("input", {value:commentForm.simPt,onChange:e=>setCommentForm(f=>({...f,simPt:e.target.value})),placeholder:"ex: 850",type:"text",inputMode:"decimal",style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
                    ),
                    React.createElement("div", null,
                      React.createElement("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Real conseguido (€/mês)"),
                      React.createElement("input", {value:commentForm.realPt,onChange:e=>setCommentForm(f=>({...f,realPt:e.target.value})),placeholder:"ex: 870",type:"text",inputMode:"decimal",style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}})
                    )
                  ),
                  React.createElement("div", {style:{marginBottom:8}},
                    React.createElement("label", {style:{fontSize:10,color:"#6b7280",display:"block",marginBottom:3}}, "Comentário *"),
                    React.createElement("textarea", {value:commentForm.text,onChange:e=>setCommentForm(f=>({...f,text:e.target.value})),placeholder:"Partilha a tua experiência com o simulador ou com o banco...",required:true,maxLength:500,rows:3,style:{width:"100%",padding:"6px 9px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",resize:"vertical",boxSizing:"border-box"}})
                  ),
                  commentErr&&React.createElement("div", {style:{fontSize:11,color:"#dc2626",marginBottom:8,padding:"5px 9px",background:"rgba(220,38,38,0.06)",borderRadius:5}}, "⚠️ "+commentErr),
                  commentOk&&React.createElement("div", {style:{fontSize:11,color:"#059669",marginBottom:8,padding:"5px 9px",background:"rgba(5,150,105,0.06)",borderRadius:5}}, "✅ Comentário publicado!"),
                  React.createElement("button", {type:"submit",disabled:commentSubmit||commentForm.text.trim().length<5,style:{padding:"7px 18px",background:commentSubmit?"rgba(0,0,0,0.05)":"rgba(139,92,246,0.9)",border:"none",borderRadius:7,color:commentSubmit?"#9b9b9b":"#ffffff",fontSize:12,fontWeight:700,cursor:commentSubmit?"not-allowed":"pointer",fontFamily:"sans-serif"}}, commentSubmit?"A publicar...":"Publicar comentário")
                ),
                commentLoad?React.createElement("div", {style:{textAlign:"center",color:"#6b7280",fontSize:13,padding:20}}, "⏳ A carregar..."):
                comments.length===0?React.createElement("div", {style:{textAlign:"center",color:"#9ca3af",fontSize:13,padding:20}}, "Ainda não há comentários. Sê o primeiro!"):
                React.createElement("div", null, comments.map(c=>
                  React.createElement("div", {key:c.id,style:{borderBottom:"1px solid rgba(0,0,0,0.06)",paddingBottom:12,marginBottom:12}},
                    React.createElement("div", {style:{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}},
                      React.createElement("span", {style:{fontWeight:700,fontSize:13,color:"#111827"}}, c.name),
                      c.bank&&React.createElement("span", {style:{fontSize:11,background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.2)",color:"#2563eb",borderRadius:4,padding:"1px 6px"}}, c.bank),
                      React.createElement("span", {style:{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}, new Date(c.ts).toLocaleDateString("pt-PT"))
                    ),
                    (c.simPt||c.realPt)&&React.createElement("div", {style:{display:"flex",gap:10,marginBottom:6}},
                      c.simPt!=null&&c.simPt!==""&&Number.isFinite(Number(c.simPt))&&React.createElement("div", {style:{fontSize:11,background:"rgba(201,168,76,0.1)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:5,padding:"2px 8px",color:"#92400e"}}, "🧮 Simulado: "+Number(c.simPt).toFixed(2).replace(".",",")+"/mês"),
                      c.realPt!=null&&c.realPt!==""&&Number.isFinite(Number(c.realPt))&&React.createElement("div", {style:{fontSize:11,background:"rgba(5,150,105,0.08)",border:"1px solid rgba(5,150,105,0.25)",borderRadius:5,padding:"2px 8px",color:"#065f46"}}, "✅ Real: "+Number(c.realPt).toFixed(2).replace(".",",")+"/mês")
                    ),
                    React.createElement("div", {style:{fontSize:13,color:"#374151",lineHeight:1.5}}, c.text),
                    React.createElement("div", {style:{display:"flex",alignItems:"center",gap:8,marginTop:8}},
                      React.createElement("button", {type:"button",onClick:()=>{setReplyTo(replyTo===c.id?null:c.id);setReplyErr("");setReplyForm({name:"",text:""});},style:{background:"rgba(37,99,235,0.08)",border:"1px solid rgba(37,99,235,0.18)",borderRadius:6,color:"#2563eb",fontSize:11,fontWeight:700,padding:"4px 9px",cursor:"pointer",fontFamily:"sans-serif"}}, replyTo===c.id?"Cancelar":"Responder"),
                      replyOk===c.id&&React.createElement("span", {style:{fontSize:11,color:"#059669"}}, "Resposta publicada!")
                    ),
                    replyTo===c.id&&React.createElement("form", {onSubmit:e=>submitReply(e,c.id),style:{marginTop:8,background:"rgba(37,99,235,0.04)",border:"1px solid rgba(37,99,235,0.14)",borderRadius:8,padding:10}},
                      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8,marginBottom:8}},
                        React.createElement("input", {value:replyForm.name,onChange:e=>setReplyForm(f=>({...f,name:e.target.value})),placeholder:"Nome (opcional)",maxLength:50,style:{width:"100%",padding:"6px 8px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",boxSizing:"border-box"}}),
                        React.createElement("textarea", {value:replyForm.text,onChange:e=>setReplyForm(f=>({...f,text:e.target.value})),placeholder:"Escreve a tua resposta...",required:true,maxLength:500,rows:2,style:{width:"100%",padding:"6px 8px",border:"1px solid rgba(0,0,0,0.12)",borderRadius:6,fontSize:12,fontFamily:"sans-serif",resize:"vertical",boxSizing:"border-box"}})
                      ),
                      replyErr&&React.createElement("div", {style:{fontSize:11,color:"#dc2626",marginBottom:8}}, "⚠️ "+replyErr),
                      React.createElement("button", {type:"submit",disabled:replySubmit||replyForm.text.trim().length<5,style:{padding:"6px 13px",background:replySubmit?"rgba(0,0,0,0.05)":"#2563eb",border:"none",borderRadius:6,color:replySubmit?"#9b9b9b":"#ffffff",fontSize:12,fontWeight:700,cursor:replySubmit?"not-allowed":"pointer",fontFamily:"sans-serif"}}, replySubmit?"A responder...":"Publicar resposta")
                    ),
                    (c.replies||[]).length>0&&React.createElement("div", {style:{marginTop:10,marginLeft:14,paddingLeft:12,borderLeft:"2px solid rgba(37,99,235,0.16)"}}, c.replies.map(reply=>
                      React.createElement("div", {key:reply.id,style:{background:"rgba(37,99,235,0.035)",borderRadius:8,padding:"8px 10px",marginTop:8}},
                        React.createElement("div", {style:{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}},
                          React.createElement("span", {style:{fontWeight:700,fontSize:12,color:"#111827"}}, reply.name),
                          React.createElement("span", {style:{fontSize:10,color:"#9ca3af",marginLeft:"auto"}}, new Date(reply.ts).toLocaleDateString("pt-PT"))
                        ),
                        React.createElement("div", {style:{fontSize:12,color:"#374151",lineHeight:1.5}}, reply.text)
                      )
                    ))
                  )
                ))
              )
            )
  ),showGlossario&&window.GlossarioModal&&React.createElement(window.GlossarioModal,{onClose:()=>setShowGlossario(false)}));
}
window._App=App;
}catch(e){
var _d=document.getElementById('root');if(_d){_d.style.cssText='color:#f87171;padding:40px;background:#e5e7eb;min-height:100vh';var _h=document.createElement('h2');_h.textContent='Erro ao iniciar';var _p=document.createElement('p');_p.textContent=e.message;_d.appendChild(_h);_d.appendChild(_p);}
}
})();
