/**
 * Constantes fiscais/regulatórias — FONTE ÚNICA.
 * Este ficheiro é simultaneamente:
 *   (a) o fallback síncrono do browser (window._SIM_DEFAULTS), carregado antes
 *       de sim-shared-constants.js em todas as páginas;
 *   (b) o seed do servidor (require() em api/banks.js), reconciliado para a
 *       tabela kv_store no arranque.
 * Os valores em vigor em runtime vivem em window._SIM.CONST (inicializado a
 * partir daqui e sobreposto pela resposta de /api/banks) — os consumidores
 * leem no momento da chamada, nunca guardam cópias.
 * Editável sem deploy via admin (POST /api/banks {constants:{...}}).
 */
;(function (root, factory) {
  var d = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = d;
  else root._SIM_DEFAULTS = Object.assign(root._SIM_DEFAULTS || {}, d);
})(typeof self !== "undefined" ? self : this, function () {
  return {
    fiscal: {
      // IMT continente, tabelas OE 2026 — escalões {max, rate, ded}: IMT = v*rate − ded.
      // max:null = último escalão (sem limite). hpp = Tabela I; outros = Tabela II.
      imt: {
        hpp: [
          { max: 106346,  rate: 0,     ded: 0 },
          { max: 145470,  rate: 0.02,  ded: 2126.92 },
          { max: 198347,  rate: 0.05,  ded: 6491.02 },
          { max: 330539,  rate: 0.07,  ded: 10457.96 },
          { max: 660982,  rate: 0.08,  ded: 13763.35 },
          { max: 1150853, rate: 0.06,  ded: 0 },
          { max: null,    rate: 0.075, ded: 0 },
        ],
        outros: [
          { max: 106346,  rate: 0.01,  ded: 0 },
          { max: 145470,  rate: 0.02,  ded: 1063.46 },
          { max: 198347,  rate: 0.05,  ded: 5427.56 },
          { max: 330539,  rate: 0.07,  ded: 9394.50 },
          { max: 633931,  rate: 0.08,  ded: 12699.89 },
          { max: 1150853, rate: 0.06,  ded: 0 },
          { max: null,    rate: 0.075, ded: 0 },
        ],
        // IMT Jovem (OE 2026): isenção total até jovemIsencaoTotal; entre esse
        // valor e jovemIsencaoParcial paga jovemTaxaExcedente só sobre o excedente.
        jovemIsencaoTotal: 330539,
        jovemIsencaoParcial: 660982,
        jovemTaxaExcedente: 0.08,
      },
      // Imposto do Selo: verba 1.1 (escritura) e 17.1 (crédito ≥5 anos).
      // Isenção jovem (art. 7.º-A CIS) só na escritura, com os mesmos limiares do IMT Jovem.
      is: {
        escritura: 0.008,
        credito: 0.006,
        jovemIsencaoTotal: 330539,
        jovemIsencaoParcial: 660982,
      },
      ias: 537.13, // IAS 2026
      imi: {
        taxaRustico: 0.008,
        // Limiares de isenção permanente (Art. 48 EBF) derivados do IAS:
        // VPT ≤ ias*isencaoPermVptMult; rendimento ≤ ias*isencaoPermRendMult.
        isencaoPermVptMult: 140,   // 10 × 14
        isencaoPermRendMult: 32.2, // 2.3 × 14
        isencaoTemp: { vpt1: 125000, vpt2: 250000, anosBase: 3, anosDep3: 6 },
      },
    },
    regras: {
      // BdP — Recomendação Macroprudencial n.º 1/2026 (desde 01/08/2026)
      prazoMaxJovem: 40,
      prazoMaxNormal: 35,
      idadeCorteJovem: 35,
      idadeFimMax: 75, // prática bancária: idade no fim do contrato
      stressAddon: 1.5, // choque de taxa (p.p.)
      dstiPrudente: 35, // referência prudente usada nos simuladores
      dstiAmarelo: 40,
      dstiLimite: 45,   // limite regulamentar BdP
      encargoDependente: 400, // €/mês deduzidos ao rendimento por dependente
      finalidadeAddon: { hpp: 0, hab2: 0.20, arrendamento: 0.30 },
      finalidadeMaxLtv: { hpp: 90, hab2: 80, arrendamento: 80, jovemHpp: 100 },
      garantiaPublicaCap: 450000, // DL 44/2024 — valor máximo do imóvel
      amortPenaltyVar: 0.005,  // DL 74-A/2017 — taxa variável
      amortPenaltyFixa: 0.02,  // DL 74-A/2017 — taxa fixa
    },
    custos: {
      dossierDefault: 300,    // fallback quando o banco não tem valor na BD
      avaliacaoDefault: 230,
      registoRate: 0.0008,    // registo de hipoteca: capital*rate + base
      registoBase: 150,
      dpa: 200,
      notario: 750,
      custosFixosEstimativa: 1500, // estimativa agregada (comparacao)
    },
    // Seguro de vida — taxa anual sobre capital por banda etária ({max:null} = resto)
    vida: [
      { max: 25, taxa: 0.0012 },
      { max: 30, taxa: 0.0015 },
      { max: 35, taxa: 0.0020 },
      { max: 40, taxa: 0.0028 },
      { max: 45, taxa: 0.0040 },
      { max: 50, taxa: 0.0060 },
      { max: 55, taxa: 0.0090 },
      { max: 60, taxa: 0.0130 },
      { max: null, taxa: 0.0180 },
    ],
    // Usado quando o fetch ao BCE/API falha — atualizar mensalmente
    euriborFallback: {
      "3m":  { valor: 2.339, data: "junho 2026" },
      "6m":  { valor: 2.596, data: "junho 2026" },
      "12m": { valor: 2.798, data: "junho 2026" },
    },
  };
});
