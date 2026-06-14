const path  = require("path");
const { GoogleGenAI } = require("@google/genai");
const { openSqliteDb } = require(path.join(__dirname, "..", "lib", "open-sqlite.js"));
const { fetchEuribor } = require("./euribor.js");

const banksModuleCache = { mod: undefined, tried: false };
function getBanksModule() {
  if (!banksModuleCache.tried) {
    banksModuleCache.tried = true;
    try {
      banksModuleCache.mod = require(path.join(__dirname, "banks.js"));
    } catch (e) {
      console.error("spreads.js: require banks.js failed:", e.message);
      banksModuleCache.mod = null;
    }
  }
  return banksModuleCache.mod;
}

// ── SQLite cache ──────────────────────────────────────────────────────────
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "spreads.sqlite");
const SPREADS_KV_SCHEMA = `
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expiresAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_kv_store_expires ON kv_store(expiresAt);
  `;
const { db: sqliteDb } = openSqliteDb(dbPath, { label: "spreads.js", schema: SPREADS_KV_SCHEMA });

const KV_CACHE_KEY   = "spreads:cache:v1";
const KV_CALLS_PFX   = "spreads:calls:";   // + "YYYY-MM-DD"
const KV_CACHE_TTL   = 25 * 60 * 60;       // 25 h (segundos)
const KV_CALLS_TTL   = 49 * 60 * 60;       // 49 h


async function kvGet(key) {
  if (!sqliteDb) return null;
  try {
    const now = Date.now();
    const row = sqliteDb.prepare("SELECT value, expiresAt FROM kv_store WHERE key = ?").get(key);
    if (!row) return null;
    if (row.expiresAt !== null && row.expiresAt <= now) {
      sqliteDb.prepare("DELETE FROM kv_store WHERE key = ?").run(key);
      return null;
    }
    return JSON.parse(row.value);
  } catch (_) {
    return null;
  }
}

async function kvSet(key, value, ttlSeconds) {
  if (!sqliteDb) return;
  try {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    sqliteDb
      .prepare(`
        INSERT INTO kv_store(key, value, expiresAt) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, expiresAt = excluded.expiresAt
      `)
      .run(key, JSON.stringify(value), expiresAt);
  } catch (_) {}
}

async function kvIncr(key, ttlSeconds) {
  if (!sqliteDb) return null;
  try {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const tx = sqliteDb.transaction((k) => {
      const row = sqliteDb.prepare("SELECT value, expiresAt FROM kv_store WHERE key = ?").get(k);
      let current = 0;
      if (row && (row.expiresAt === null || row.expiresAt > now)) {
        current = Number(JSON.parse(row.value)) || 0;
      }
      const next = current + 1;
      sqliteDb
        .prepare(`
          INSERT INTO kv_store(key, value, expiresAt) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, expiresAt = excluded.expiresAt
        `)
        .run(k, JSON.stringify(next), expiresAt);
      return next;
    });
    return tx(key);
  } catch (_) {
    return null;
  }
}

async function kvDecr(key) {
  if (!sqliteDb) return false;
  try {
    const now = Date.now();
    const tx = sqliteDb.transaction((k) => {
      const row = sqliteDb.prepare("SELECT value, expiresAt FROM kv_store WHERE key = ?").get(k);
      if (!row || (row.expiresAt !== null && row.expiresAt <= now)) {
        sqliteDb.prepare("DELETE FROM kv_store WHERE key = ?").run(k);
        return true;
      }
      const current = Number(JSON.parse(row.value)) || 0;
      const next = Math.max(0, current - 1);
      sqliteDb
        .prepare("UPDATE kv_store SET value = ? WHERE key = ?")
        .run(JSON.stringify(next), k);
      return true;
    });
    return tx(key);
  } catch (_) {
    return false;
  }
}

// ── In-memory L1 — evita round-trips KV dentro da mesma instância quente.
const MEM = { data: null, fetchedAt: 0, callsToday: 0, dayKey: "" };

function utcDayKey() { return new Date().toISOString().slice(0, 10); }

// ── Limites
const MAX_CALLS_PER_DAY = 2;
const MIN_INTERVAL_MS   = Math.floor(24 / MAX_CALLS_PER_DAY) * 60 * 60 * 1000; // 12 h

// ── Rate limiter (in-memory, best-effort por instância)
const rateMap  = new Map();
const RATE_WIN = 60 * 60 * 1000; // 1 h
const RATE_MAX = 20;

function isRateLimited(ip) {
  const now = Date.now();
  for (const [k, v] of rateMap) if (now > v.reset) rateMap.delete(k);
  const e = rateMap.get(ip) || { count: 0, reset: now + RATE_WIN };
  if (now > e.reset) { e.count = 0; e.reset = now + RATE_WIN; }
  e.count++;
  rateMap.set(ip, e);
  return e.count > RATE_MAX;
}

// ── Google Gemini API ─────────────────────────────────────────────────────
const BANK_CODES = ["CA", "CTT", "BNKTR", "ABANCA", "BCP", "ACTVO", "BPI", "MNTPO", "SANTR", "NB", "CGD", "UCI", "BNI", "BEST"];

const GEMINI_MODEL  = process.env.GEMINI_MODEL || "gemini-2.5-pro";
// A URL context tool aceita no máximo 20 URLs por pedido. Mantemos os lotes
// pequenos (menos PDFs + menos JSON por chamada): reduz as respostas vazias do
// gemini-2.5-pro (finishReason STOP sem texto) que ocorrem em lotes grandes.
// O nº de chamadas por refresh não conta para o limite diário (esse é por POST).
const URL_BATCH_MAX = 8;
// Modo de teste: devolve dados canónicos sem chamar a API (não gasta tokens/rede).
const SPREADS_MOCK  = process.env.SPREADS_MOCK === "1";

// Auto-aplicar o resultado da AI sem revisão no admin (compatibilidade com o fluxo antigo).
// Por defeito o resultado fica PENDENTE e só vai a "live" depois de aprovação no painel admin.
const SPREADS_AUTO_APPLY = process.env.SPREADS_AUTO_APPLY === "1";

// Preçários oficiais por banco: [taxas §18.1, comissões §18.2].
// A URL context tool do Gemini lê estes URLs directamente (servidores Google
// evitam bloqueios de IP e gerem cookies). Bancos cujo site bloqueia o fetcher
// (ABANCA, BEST) usam o preçário combinado do Portal do Cliente Bancário (BdP).
const BANK_SOURCES = {
  CA:     ["https://www.creditoagricola.pt/-/media/files/precario/documents-site/taxas-de-juro-_aviso-8-2009-do-bdp/pre-ft-202605.pdf",
           "https://www.creditoagricola.pt/-/media/files/precario/documents-site/comissoes-e-despesas-_aviso-8-2009-do-bdp/pre-fc-20260501.pdf"],
  CTT:    ["https://www.bancoctt.pt/application/themes/pdfs/precario.pdf?language_id=1555597541833"],
  BNKTR:  ["https://banco.bankinter.pt/particulares/pdfs/precario/p_ftj_operacoes_credito.pdf",
           "https://banco.bankinter.pt/particulares/pdfs/precario/p_fcd_operacoes_credito.pdf"],
  // abanca.pt bloqueia o fetcher da URL context tool; usamos o preçário combinado
  // do Portal do Cliente Bancário (BdP), código 0170, alias "_1" = filing mais recente.
  ABANCA: ["https://clientebancario.bportugal.pt/sites/default/files/precario/0170_/0170_PRE_1.pdf"],
  BCP:    ["https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf"],
  // O preçário do BCP não cobre o ActivoBank; usamos o preçário do BdP (código 0023).
  ACTVO:  ["https://clientebancario.bportugal.pt/sites/default/files/precario/0023_/0023_PRE.pdf"],
  BPI:    ["https://www.bancobpi.pt/contentservice/getContent?documentName=PR_WCS01_UCM01004994",
           "https://www.bancobpi.pt/contentservice/getContent?documentName=PR_WCS01_UCM01004993"],
  MNTPO:  ["https://www.bancomontepio.pt/content/dam/montepio/pdf/geral/precario/folheto-taxas-juro/folheto-taxas-juro.pdf",
           "https://www.bancomontepio.pt/content/dam/montepio/pdf/geral/precario/folheto-comissoes-despesas/folheto-comissoes-despesas.pdf"],
  SANTR:  ["https://www.santander.pt/pdfs/particulares/credito-habitacao/CH_Informacao_Pre-Contratual_Geral.pdf",
           "https://www.santander.pt/pdfs/precario-banco/folheto-taxas-juro/outros-clientes/20-operacoes-credito/20_precariofolhetotaxasjuro_oc_opscredito.pdf"],
  NB:     ["https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/PRE-FT.pdf.coredownload.inline.pdf",
           "https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/PRE-FC.pdf.coredownload.inline.pdf"],
  // 18.pdf = taxas §18; o folheto completo de comissões cobre particulares
  // (o anterior 10.pdf era de "Outros Clientes"/não-particulares).
  CGD:    ["https://www.cgd.pt/Precario/Documents/18.pdf",
           "https://www.cgd.pt/Precario/Documents/Folheto-Completo-Comissoes-Despesas.pdf"],
  UCI:    ["https://www.uci.pt/-/media/Files/Portugal/precario/PRE-FT-202606.pdf",
           "https://www.uci.pt/-/media/Files/Portugal/precario/PRE-FC-20260301.pdf"],
  BNI:    ["https://bnieuropa.pt/wp-content/themes/responsive/pdf/precario/taxas-juro-particulares-credito-habitacao-e-contratos-conexos.pdf",
           "https://bnieuropa.pt/wp-content/themes/responsive/pdf/precario/particulares-credito-habitacao-e-contratos-conexos.pdf"],
  // bancobest.pt bloqueia o fetcher; usamos o preçário combinado do BdP (código 0065).
  BEST:   ["https://clientebancario.bportugal.pt/sites/default/files/precario/0065_/0065_PRE.pdf"],
};

// JSON schema para structured outputs — garante a forma exacta da resposta.
// Forma: {bancos:[{codigo,...}]} (array, não mapa por código) — um mapa com 14
// chaves obrigatórias × 22 campos é rejeitado pela API com "Schema is too
// complex for compilation" quando combinado com web_search.
// Nota: structured outputs não suporta minimum/maximum; gamas numéricas em validateSpreads().
const SPREADS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["bancos"],
  properties: {
    bancos: {
      type: "array",
      description: "Exactamente 14 entradas, uma por banco (campo codigo)",
      items: { $ref: "#/$defs/bank" },
    },
  },
  $defs: {
    bank: {
      type: "object",
      additionalProperties: false,
      required: [
        "codigo",
        "sCom", "sSem", "mCom", "mSem", "fCom", "fSem", "jsCom", "jsSem",
        "promoPeriodo", "promoSpread", "dossier", "avaliacao", "contaMes",
        "capMin", "capMax", "vRef", "mAno", "insV", "insM", "contaNota",
        "minutas", "jovemIsenta",
      ],
      properties: {
        codigo:       { type: "string", enum: BANK_CODES, description: "Código do banco" },
        sCom:         { type: "number", description: "Spread da taxa variável COM produtos associados, contratual fora do período promocional (pontos percentuais)" },
        sSem:         { type: "number", description: "Spread da taxa variável SEM produtos associados (pontos percentuais); ≥ sCom" },
        mCom:         { type: "number", description: "TAN do período fixo da taxa mista COM produtos (%)" },
        mSem:         { type: "number", description: "TAN do período fixo da taxa mista SEM produtos (%); ≥ mCom" },
        fCom:         { type: "number", description: "TAN da taxa fixa COM produtos (%)" },
        fSem:         { type: "number", description: "TAN da taxa fixa SEM produtos (%); ≥ fCom" },
        jsCom:        { type: "number", description: "Spread do Crédito Habitação Jovem COM produtos (pontos percentuais)" },
        jsSem:        { type: "number", description: "Spread do Crédito Habitação Jovem SEM produtos (pontos percentuais); ≥ jsCom" },
        promoPeriodo: { type: "integer", description: "Duração do período promocional em meses; 0 se não existir campanha" },
        promoSpread:  { anyOf: [{ type: "number" }, { type: "null" }], description: "Spread reduzido durante a promoção (≤ sCom); null se não existir campanha" },
        dossier:      { type: "number", description: "Comissão de dossier/abertura de processo, em EUR" },
        avaliacao:    { type: "number", description: "Comissão de avaliação do imóvel, em EUR" },
        contaMes:     { type: "number", description: "Custo mensal da conta à ordem exigida, em EUR; 0 se inexistente" },
        capMin:       { type: "number", description: "Capital mínimo financiável, em EUR" },
        capMax:       { type: "number", description: "Capital máximo financiável, em EUR" },
        vRef:         { type: "number", description: "Prémio mensal do seguro de vida para titular de 30 anos e capital de 150.000 €, em EUR" },
        mAno:         { type: "number", description: "Prémio anual do seguro multirriscos para imóvel de 200.000 €, em EUR" },
        insV:         { type: "string", description: "Seguradora do seguro de vida (nome curto)" },
        insM:         { type: "string", description: "Seguradora do multirriscos (nome curto)" },
        contaNota:    { type: "string", description: "Fonte/nota da comissão de conta, ex.: \"Estimativa\" ou \"Preçário jun.2026\"" },
        minutas:      { type: "number", description: "Comissão de preparação de minutas/formalização, em EUR; 0 se não existir" },
        jovemIsenta:  { type: "boolean", description: "true se o banco isenta as comissões de dossier e avaliação no Crédito Habitação Jovem" },
      },
    },
  },
};

// Contrato de saída derivado de SPREADS_SCHEMA (fonte única). Como a URL context
// tool é incompatível com responseSchema, o modelo não recebe o schema e, sem
// isto, inventa nomes de campos (ex.: "bancoCodigo", "cEstudo") e omite campos.
// Injectamos a lista exacta de chaves + tipos + descrições no prompt.
function schemaContractText() {
  const props = SPREADS_SCHEMA.$defs.bank.properties;
  const order = SPREADS_SCHEMA.$defs.bank.required;
  const typeStr = (p) => {
    if (p.enum) return `string (um de: ${p.enum.join(", ")})`;
    if (p.anyOf) return p.anyOf.map((a) => a.type).join(" ou ");
    return p.type;
  };
  return order.map((k) => `- ${k} (${typeStr(props[k])}): ${props[k].description}`).join("\n");
}

// Exemplo de UMA entrada (valores ilustrativos da CGD) para fixar a forma exacta.
const SCHEMA_EXAMPLE = JSON.stringify({
  codigo: "CGD", sCom: 0.65, sSem: 1.35, mCom: 3.80, mSem: 4.50, fCom: 4.65, fSem: 5.35,
  jsCom: 0.65, jsSem: 1.35, promoPeriodo: 0, promoSpread: null, dossier: 226.20,
  avaliacao: 239.20, contaMes: 6.55, capMin: 5000, capMax: 3000000, vRef: 29.82, mAno: 110,
  insV: "Fidelidade", insM: "Fidelidade Casa", contaNota: "Preçário mai.2026", minutas: 0,
  jovemIsenta: false,
});

const SYSTEM_PROMPT = `És um analista de crédito habitação em Portugal. A tua tarefa é apurar as condições ACTUAIS de crédito habitação para aquisição de habitação própria permanente (HPP) praticadas pelos bancos portugueses indicados na mensagem, lendo os preçários oficiais em PDF cujos URLs são fornecidos (a ferramenta de URL context busca-os por ti, incluindo as tabelas).

Bancos a apurar (código = nome oficial):
- CA = Crédito Agrícola
- CTT = Banco CTT
- BNKTR = Bankinter Portugal
- ABANCA = ABANCA Portugal
- BCP = Millennium BCP
- ACTVO = ActivoBank
- BPI = Banco BPI
- MNTPO = Banco Montepio
- SANTR = Santander Portugal
- NB = novobanco
- CGD = Caixa Geral de Depósitos
- UCI = UCI Portugal
- BNI = BNI Europa
- BEST = Banco Best

Regras de apuramento:
- sCom é SEMPRE o spread contratual em vigor FORA do período promocional — nunca o spread reduzido da campanha. O spread de campanha vai em promoSpread.
- Os valores "sem produtos" (sSem, mSem, fSem, jsSem) são ≥ aos valores "com produtos".
- jsCom/jsSem são o spread do Crédito Habitação Jovem (regime com garantia do Estado). Inclui-os SEMPRE. Se o preçário não indicar um spread próprio para jovens, usa o mesmo spread comercial (jsCom = sCom, jsSem = sSem).
- Quando não há campanha: promoPeriodo = 0 e promoSpread = null.
- Para cada banco, lê os PDFs do preçário indicados na mensagem (taxas §18.1 e comissões §18.2).
- Os campos vRef, mAno, insV, insM e capMax NÃO constam dos preçários (são prémios de seguros e limites preenchidos a partir de dados curados). Dá o teu melhor valor aproximado, mas NÃO menciones "Estimativa" na contaNota por causa destes campos — eles são substituídos depois.
- A contaNota só deve conter "Estimativa" se os SPREADS/TAN (sCom, sSem, mCom, mSem, fCom, fSem, jsCom, jsSem) OU as comissões (dossier, avaliacao, minutas) tiverem de ser estimados por o preçário não os cobrir ou o URL falhar. Caso contrário, indica apenas a fonte (ex.: "Preçário jun.2026").
- Para bancos sem URL (caso existam), estima com base em bancos comparáveis e indica "Estimativa".
- Indica o mês/ano da fonte em contaNota quando confirmares o valor (ex.: "Preçário mai.2026").
- Valores monetários em EUR; spreads e TANs em pontos percentuais (ex.: 0.70 = 0,70%).

Cada entrada do array "bancos" DEVE ter EXACTAMENTE estas chaves, com estes nomes literais (não inventes, não renomeies, não omitas nenhuma; o código vai SEMPRE no campo "codigo"):
${schemaContractText()}

Exemplo de UMA entrada (apenas para fixar a forma; usa os valores reais de cada banco):
${SCHEMA_EXAMPLE}

Responde apenas com o objecto JSON pedido — {"bancos":[...]} com uma entrada por cada banco pedido na mensagem, cada uma com TODAS as chaves acima — sem texto adicional.`;

// Reparte os bancos por lotes cujo total de URLs ≤ URL_BATCH_MAX (limite da
// URL context tool). Bancos sem URL não pesam no orçamento de URLs.
function buildBatches() {
  const batches = [];
  let cur = [], curUrls = 0;
  for (const code of BANK_CODES) {
    const n = (BANK_SOURCES[code] || []).length;
    if (cur.length && curUrls + n > URL_BATCH_MAX) {
      batches.push(cur);
      cur = []; curUrls = 0;
    }
    cur.push(code); curUrls += n;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// Texto do pedido (contents) com os URLs de preçário dos bancos do lote.
function buildPrompt(codes) {
  const linhas = codes.map((code) => {
    const urls = BANK_SOURCES[code] || [];
    if (!urls.length) return `- ${code}: (sem URL — estima)`;
    return `- ${code}: ${urls.join(" + ")}`;
  }).join("\n");
  return `Apura as condições de crédito habitação HPP para ${codes.length} banco(s): ${codes.join(", ")}.\n\nURLs (taxas §18.1 + comissões §18.2):\n${linhas}`;
}

// ── Health-check dos URLs de preçário ─────────────────────────────────────
// Audita BANK_SOURCES via a URL context tool: confirma que o Gemini consegue
// obter cada PDF (urlContextMetadata.urlRetrievalStatus === SUCCESS). Pensado
// para correr periodicamente (admin/Jenkins) e avisar quando um URL parte —
// p.ex. nomes com data como UCI "PRE-FT-AAAAMM" ou CA "pre-ft-AAAAMM" que
// mudam quando o banco publica nova versão. Faz pedidos baratos (prompt mínimo)
// repartidos pelo limite de URLs por chamada; não escreve em cache nem live.
async function auditUrls(apiKey, { model = GEMINI_MODEL } = {}) {
  const ai = new GoogleGenAI({ apiKey });
  // Um URL pode servir vários bancos (ex.: BCP e ACTVO partilham SECCAO_18.pdf),
  // por isso guardamos a lista de códigos por URL.
  const urlCodes = {};
  for (const [code, urls] of Object.entries(BANK_SOURCES)) {
    urls.forEach((u) => { (urlCodes[u] = urlCodes[u] || []).push(code); });
  }
  const allUrls = Object.keys(urlCodes);

  // Estado de retrieval de um conjunto de URLs numa só chamada (urlContextMetadata).
  async function checkBatch(urls) {
    const resp = await ai.models.generateContent({
      model,
      contents: 'Lê cada um destes URLs (PDFs de preçários) e responde apenas "OK":\n' + urls.map((u) => "- " + u).join("\n"),
      config: { tools: [{ urlContext: {} }], maxOutputTokens: 1000, thinkingConfig: { thinkingBudget: 512 } },
    });
    const meta = resp.candidates?.[0]?.urlContextMetadata?.urlMetadata || [];
    const byRetrieved = {};
    for (const m of meta) byRetrieved[m.retrievedUrl] = String(m.urlRetrievalStatus || "").replace("URL_RETRIEVAL_STATUS_", "");
    const out = {};
    for (const u of urls) {
      // Casa exacto e, em fallback, por sufixo (redirects normalizam o URL).
      let st = byRetrieved[u];
      if (!st) { const hit = Object.keys(byRetrieved).find((k) => k === u || k.endsWith(u) || u.endsWith(k)); if (hit) st = byRetrieved[hit]; }
      out[u] = st || "UNKNOWN";
    }
    return out;
  }

  // 1ª passagem em lote (≤ URL_BATCH_MAX por pedido).
  const statusByUrl = {};
  for (let i = 0; i < allUrls.length; i += URL_BATCH_MAX) {
    Object.assign(statusByUrl, await checkBatch(allUrls.slice(i, i + URL_BATCH_MAX)));
  }
  // 2ª passagem: re-verifica individualmente os não-SUCCESS. Em lotes grandes o
  // modelo nem sempre obtém todos os URLs (devolve UNKNOWN); a verificação 1-a-1
  // distingue um URL realmente partido de um simplesmente não-obtido no lote.
  for (const u of allUrls) {
    if (statusByUrl[u] === "SUCCESS") continue;
    const retry = await checkBatch([u]);
    statusByUrl[u] = retry[u] || statusByUrl[u];
  }

  const results = allUrls.map((url) => ({ codes: urlCodes[url], url, status: statusByUrl[url], ok: statusByUrl[url] === "SUCCESS" }));
  const failed = results.filter((r) => !r.ok);
  return {
    checkedAt: new Date().toISOString(),
    total: results.length,
    ok: results.length - failed.length,
    failed,
    results,
    banksWithoutUrl: BANK_CODES.filter((c) => !(BANK_SOURCES[c] || []).length),
  };
}

// Registo canónico usado pelo modo mock (passa em validateSpreads).
const MOCK_BANK = {
  sCom: 0.8, sSem: 1.6, mCom: 3.0, mSem: 3.5, fCom: 3.2, fSem: 3.7,
  jsCom: 0.8, jsSem: 1.6, promoPeriodo: 0, promoSpread: null,
  dossier: 280, avaliacao: 240, contaMes: 6, capMin: 25000, capMax: 1500000,
  vRef: 22, mAno: 160, insV: "—", insM: "—", contaNota: "Mock", minutas: 0,
  jovemIsenta: true,
};

// Resposta simulada (mesma forma do generateContent: { text }) para SPREADS_MOCK.
function mockResp(codes) {
  const bancos = codes.map((codigo) => ({ codigo, ...MOCK_BANK }));
  return { text: JSON.stringify({ bancos }) };
}

// Uma chamada Gemini por lote de bancos. A URL context tool lê os PDFs dos URLs
// presentes no prompt. Sem responseSchema: é incompatível com tools, por isso o
// JSON é instruído no prompt e extraído de forma robusta (ver parseBatchSpreads).
async function callGemini(ai, codes) {
  if (SPREADS_MOCK) return mockResp(codes);
  return ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(codes),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ urlContext: {} }],
      maxOutputTokens: 48000,
      // gemini-2.5-pro pensa por defeito e o thinking consome o orçamento de
      // output; sem cap, a resposta pode atingir MAX_TOKENS antes de emitir
      // qualquer JSON ("Resposta Gemini vazia"). Limitamos o thinking para
      // deixar a maior parte do orçamento para o texto da resposta.
      thinkingConfig: { thinkingBudget: 8192 },
    },
  });
}

// Extrai o texto da resposta Gemini (resp.text, com fallback para candidates/parts).
function geminiText(resp) {
  if (!resp) throw new Error("Gemini sem resposta");
  let txt = typeof resp.text === "string" ? resp.text : "";
  if (!txt && Array.isArray(resp.candidates)) {
    txt = resp.candidates
      .flatMap((c) => c?.content?.parts || [])
      .map((p) => p?.text || "")
      .join("\n");
  }
  if (!txt || !txt.trim()) {
    const blocked = resp.promptFeedback?.blockReason;
    const finish  = resp.candidates?.[0]?.finishReason;
    const detail  = [
      blocked ? "bloqueada: " + blocked : "",
      finish  ? "finishReason: " + finish : "",
    ].filter(Boolean).join(", ");
    throw new Error("Resposta Gemini vazia" + (detail ? " (" + detail + ")" : ""));
  }
  return txt;
}

// ── Validação da resposta antes de cachear/servir
function assertNum(bank, field, v, min, max) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new Error(`Spreads inválidos: ${bank}.${field}=${v} (esperado ${min}–${max})`);
  }
}

// Converte a forma do schema ({bancos:[{codigo,...}]}) num mapa por código;
// aceita também o mapa directo (fallback sem structured outputs).
function toSpreadsMap(parsed) {
  if (parsed && Array.isArray(parsed.bancos)) {
    const map = {};
    for (const entry of parsed.bancos) {
      if (entry && typeof entry === "object" && entry.codigo != null) {
        const { codigo, ...rest } = entry;
        // Normalizar o código (o modelo pode devolver "ca"/" CA ") para casar com BANK_CODES.
        map[String(codigo).trim().toUpperCase()] = rest;
      }
    }
    return map;
  }
  return parsed;
}

// Alguns preçários não distinguem um spread próprio para o Crédito Habitação
// Jovem, pelo que o modelo pode omitir jsCom/jsSem (responseSchema não é
// aplicável com a URL context tool, logo a forma não é garantida). Como o regime
// jovem costuma usar o mesmo spread comercial (jovemSameSpread), herdamo-los de
// sCom/sSem em vez de rejeitar o lote inteiro. Bancos com spread jovem próprio
// (ex.: CGD) são corrigidos na revisão do admin antes de irem a "live".
function normalizeSpreads(spreads) {
  if (!spreads || typeof spreads !== "object") return spreads;
  for (const code of Object.keys(spreads)) {
    const b = spreads[code];
    if (!b || typeof b !== "object") continue;
    if (!Number.isFinite(b.jsCom) && Number.isFinite(b.sCom)) {
      console.warn(`spreads.js: ${code}.jsCom em falta — herdado de sCom (${b.sCom})`);
      b.jsCom = b.sCom;
    }
    if (!Number.isFinite(b.jsSem) && Number.isFinite(b.sSem)) {
      console.warn(`spreads.js: ${code}.jsSem em falta — herdado de sSem (${b.sSem})`);
      b.jsSem = b.sSem;
    }
  }
  return spreads;
}

// Campos que NÃO constam dos preçários §18.1/§18.2 (prémios de seguros e, por
// vezes, o capital máximo). O modelo só os pode estimar; em vez disso mantemos o
// valor canónico/manual já existente na BD (vindo do FINE/curadoria), que é mais
// fiável. Aplicado antes da validação para que a revisão do admin já mostre estes
// campos inalterados.
const SEED_FALLBACK_FIELDS = ["vRef", "mAno", "insV", "insM", "capMax"];

function applySeedFallbacks(spreads) {
  if (!spreads || typeof spreads !== "object") return spreads;
  const bm = getBanksModule();
  let current = {};
  try { current = bm && bm.getLatestSpreads ? bm.getLatestSpreads() : {}; } catch (_) { current = {}; }
  for (const code of Object.keys(spreads)) {
    const b = spreads[code]; const cur = current[code];
    if (!b || typeof b !== "object" || !cur) continue;
    for (const f of SEED_FALLBACK_FIELDS) {
      if (cur[f] !== null && cur[f] !== undefined && cur[f] !== "") b[f] = cur[f];
    }
  }
  return spreads;
}

function validateSpreads(spreads) {
  if (!spreads || typeof spreads !== "object") throw new Error("Spreads inválidos: resposta não é um objecto");
  for (const code of BANK_CODES) {
    const b = spreads[code];
    if (!b || typeof b !== "object") throw new Error(`Spreads inválidos: falta o banco ${code}`);
    for (const f of ["sCom", "sSem", "jsCom", "jsSem"]) assertNum(code, f, b[f], 0, 6);
    for (const f of ["mCom", "mSem", "fCom", "fSem"]) assertNum(code, f, b[f], 0, 12);
    for (const f of ["dossier", "avaliacao", "minutas"]) assertNum(code, f, b[f], 0, 2000);
    assertNum(code, "contaMes", b.contaMes, 0, 25);
    assertNum(code, "promoPeriodo", b.promoPeriodo, 0, 120);
    assertNum(code, "capMin", b.capMin, 0, 500000);
    assertNum(code, "capMax", b.capMax, 100000, 10000000);
    if (b.capMin >= b.capMax) throw new Error(`Spreads inválidos: ${code}.capMin >= capMax`);
    assertNum(code, "vRef", b.vRef, 1, 150);
    assertNum(code, "mAno", b.mAno, 20, 800);
    if (b.promoSpread !== null) {
      assertNum(code, "promoSpread", b.promoSpread, 0, 6);
      if (b.promoSpread > b.sCom) throw new Error(`Spreads inválidos: ${code}.promoSpread > sCom`);
    }
    if (typeof b.jovemIsenta !== "boolean") throw new Error(`Spreads inválidos: ${code}.jovemIsenta não é boolean`);
    for (const f of ["insV", "insM", "contaNota"]) {
      if (typeof b[f] !== "string" || !b[f].trim()) throw new Error(`Spreads inválidos: ${code}.${f} vazio`);
    }
  }
  return spreads;
}

function parseSpreadsText(txt) {
  // Fallback de parsing quando a resposta não é JSON puro (sem structured outputs).
  const clean = txt.replace(/```(?:json)?/g, "").trim();
  // Preferir o objecto que contém "bancos" (resposta do schema); senão, o 1.º objecto.
  const idx = clean.indexOf('"bancos"');
  const start = idx >= 0 ? clean.lastIndexOf("{", idx) : clean.indexOf("{");
  if (start < 0) throw new Error("Formato inválido: " + txt.slice(0, 60));
  const end = clean.lastIndexOf("}");
  if (end <= start) throw new Error("Formato inválido: " + txt.slice(0, 60));
  const slice = clean.slice(start, end + 1);
  try { return JSON.parse(slice); } catch (_) { throw new Error("JSON inválido: " + slice.slice(0, 80)); }
}

// Devolve um candidato a mapa de spreads se contiver pelo menos um dos códigos.
function asSpreadsMap(parsed) {
  const map = toSpreadsMap(parsed);
  if (map && typeof map === "object" && BANK_CODES.some(code => map[code])) return map;
  return null;
}

// Extrai o mapa (por código) de UM lote a partir da resposta Gemini.
// O texto pode vir com cercas ```json``` ou alguma narração; o parsing é robusto
// (tenta JSON.parse directo e, em fallback, isola o objecto que contém "bancos").
function parseBatchSpreads(resp) {
  const txt = geminiText(resp);
  const raw = txt.replace(/```(?:json)?/g, "").trim();
  for (const fn of [() => JSON.parse(raw), () => parseSpreadsText(txt)]) {
    try { const m = asSpreadsMap(fn()); if (m) return m; } catch (_) {}
  }
  throw new Error("Não encontrei o JSON dos bancos na resposta Gemini. Início: " + txt.slice(0, 200));
}

// Compat (testes/admin): extrai e valida uma resposta completa (14 bancos).
function extractSpreads(resp) {
  const parsed = normalizeSpreads(parseBatchSpreads(resp));
  try {
    return validateSpreads(parsed);
  } catch (err) {
    console.error("spreads.js: validação falhou — chaves=[" + Object.keys(parsed).join(",") + "]");
    throw err;
  }
}

// ── Refresh assíncrono (background) ──────────────────────────────────────
// Os PDFs dos preçários são lidos pela URL context tool do Gemini (servidores
// Google buscam os URLs, evitando bloqueios de IP). Uma ou duas chamadas
// generateContent (repartidas pelo limite de 20 URLs/pedido) correm em
// background (Promise não awaited pelo handler). O resultado fica PENDENTE até
// aprovação no admin (ou auto-aplicado se SPREADS_AUTO_APPLY=1).
const REFRESH = { running: false, startedAt: 0, finishedAt: 0, error: null, batchId: null, _kvSlot: null, _today: "" };
let PENDING = null; // { spreads, eur, eurLabel, fetchedAt }

function refreshStatus() {
  return {
    running:    REFRESH.running,
    startedAt:  REFRESH.startedAt  ? new Date(REFRESH.startedAt).toISOString()  : null,
    finishedAt: REFRESH.finishedAt ? new Date(REFRESH.finishedAt).toISOString() : null,
    error:      REFRESH.error,
    batchId:    REFRESH.batchId || null,
    updatedAt:  MEM.fetchedAt ? new Date(MEM.fetchedAt).toISOString() : null,
    pending:    PENDING ? {
      bancos:    Object.keys(PENDING.spreads).length,
      fetchedAt: new Date(PENDING.fetchedAt).toISOString(),
      eurLabel:  PENDING.eurLabel || "",
      spreads:   PENDING.spreads,
    } : null,
  };
}

// Promove os dados PENDENTES para "live" (L1 + L2 + banks.sqlite).
// A aprovação explícita pelo admin (ou auto-apply) implica sempre persistência.
// onlyCodes (opcional): aprova só esses bancos; os restantes ficam em revisão.
function applyPending(today, kvSlot, onlyCodes) {
  if (!PENDING) return false;
  const all = Object.keys(PENDING.spreads);
  const codes = (Array.isArray(onlyCodes) && onlyCodes.length)
    ? all.filter((c) => onlyCodes.includes(c))
    : all;
  if (!codes.length) return false;

  // Mapa base servido publicamente: o último aplicado (MEM) ou, se ainda não há,
  // o estado canónico actual dos bancos (banks.sqlite). Sobrepomos só os aprovados,
  // para que aprovações parciais não apaguem os bancos não seleccionados.
  let base = (MEM.data && MEM.data.spreads) ? { ...MEM.data.spreads } : null;
  if (!base) {
    const bm = getBanksModule();
    try { base = bm?.getLatestSpreads ? { ...bm.getLatestSpreads() } : {}; }
    catch (_) { base = {}; }
  }
  const subset = {};
  for (const c of codes) { base[c] = PENDING.spreads[c]; subset[c] = PENDING.spreads[c]; }

  const freshData = { spreads: base, eur: PENDING.eur, eurLabel: PENDING.eurLabel };
  const fetchedAt = PENDING.fetchedAt || Date.now();
  MEM.data       = freshData;
  MEM.fetchedAt  = fetchedAt;
  MEM.dayKey     = today;
  MEM.callsToday = kvSlot != null ? Number(kvSlot) : MEM.callsToday + 1;
  const banksModule = getBanksModule();
  if (banksModule?.bulkInsertSpreads) {
    try { banksModule.bulkInsertSpreads(subset, "gemini"); }
    catch (e) { console.error("spreads.js: bulkInsertSpreads failed:", e.message); }
  }
  kvSet(KV_CACHE_KEY, { data: freshData, fetchedAt }, KV_CACHE_TTL).catch(() => {});

  // Mantém em revisão os bancos não aprovados; limpa PENDING se nada sobra.
  const remaining = {};
  for (const c of all) if (!codes.includes(c)) remaining[c] = PENDING.spreads[c];
  PENDING = Object.keys(remaining).length ? { ...PENDING, spreads: remaining } : null;
  return true;
}

// Obtém os spreads de um lote com robustez: o gemini-2.5-pro com a URL context
// tool devolve ocasionalmente uma resposta vazia (finishReason STOP, sem texto),
// sobretudo em lotes grandes (muitos PDFs + muito JSON). Faz retries e, se
// persistir, divide o lote ao meio (chamadas mais pequenas são bem mais fiáveis
// e isolam um banco/URL problemático). Lotes de 1 banco que falhem propagam o erro.
// Deteta uma contaNota em que o modelo sinaliza que NÃO conseguiu ler o preçário
// (ex.: "Estimativa (URL inválido)") — falha de retrieval, distinta de uma
// estimativa legítima (ex.: "Estimativa (Preçário mai.2026)").
function urlFailedNote(note) {
  const s = String(note || "").toLowerCase();
  if (!s.includes("url")) return false;
  return /(inv[aá]lid|invalid|erro|inacess|n[aã]o\s+acess|indispon|falh|bloque|403|404|timeout|n[aã]o\s+foi\s+poss)/.test(s);
}

async function fetchBatchSpreads(ai, codes) {
  const MAX_RETRY = 2;
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      const resp = await callGemini(ai, codes);
      const u = resp.usageMetadata || {};
      console.log(`spreads.js: lote [${codes.join(",")}] tent.${attempt + 1} — prompt=${u.promptTokenCount || "?"} output=${u.candidatesTokenCount || "?"}`);
      return parseBatchSpreads(resp);
    } catch (e) {
      lastErr = e;
      console.warn(`spreads.js: lote [${codes.join(",")}] falhou (tent.${attempt + 1}): ${e.message}`);
      if (attempt < MAX_RETRY) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (codes.length > 1) {
    const mid = Math.ceil(codes.length / 2);
    console.warn(`spreads.js: a dividir o lote [${codes.join(",")}] em dois após retries esgotados`);
    const left = await fetchBatchSpreads(ai, codes.slice(0, mid));
    const right = await fetchBatchSpreads(ai, codes.slice(mid));
    return { ...left, ...right };
  }
  throw lastErr;
}

// Inicia o refresh em background: chama o Gemini com a URL context tool (servidor
// Google busca os preçários directamente, evitando bloqueios de IP).
// O POST HTTP responde imediatamente; o admin faz polling ao GET até running=false.
function startRefresh(apiKey, kvSlot, today) {
  if (REFRESH.running) return false;
  REFRESH.running    = true;
  REFRESH.startedAt  = Date.now();
  REFRESH.finishedAt = 0;
  REFRESH.error      = null;
  REFRESH.batchId    = null;
  REFRESH._kvSlot    = kvSlot;
  REFRESH._today     = today;

  (async () => {
    try {
      const ai = SPREADS_MOCK ? null : new GoogleGenAI({ apiKey });
      const batches = buildBatches();
      console.log(`spreads.js: a chamar Gemini (${GEMINI_MODEL}) com URL context — ${batches.length} lote(s)...`);
      // responseSchema é incompatível com tools (URL context); o JSON é instruído
      // no prompt e parseBatchSpreads faz parsing robusto. Os lotes são fundidos.
      const merged = {};
      for (const codes of batches) {
        Object.assign(merged, await fetchBatchSpreads(ai, codes));
      }
      // Re-tenta individualmente os bancos cuja contaNota indica falha de URL
      // (retrieval transitório). Uma chamada por banco é mais fiável; se mesmo
      // assim falhar, mantém a estimativa (melhor esforço).
      const flagged = Object.keys(merged).filter((c) => urlFailedNote(merged[c] && merged[c].contaNota));
      if (flagged.length) {
        console.log(`spreads.js: a re-tentar bancos com falha de URL: ${flagged.join(",")}`);
        for (const code of flagged) {
          try {
            const retry = await fetchBatchSpreads(ai, [code]);
            if (retry[code] && !urlFailedNote(retry[code].contaNota)) {
              merged[code] = retry[code];
              console.log(`spreads.js: ${code} recuperado na re-tentativa individual`);
            } else {
              console.warn(`spreads.js: ${code} continua com falha de URL após re-tentativa`);
            }
          } catch (e) {
            console.warn(`spreads.js: re-tentativa de ${code} falhou: ${e.message}`);
          }
        }
      }
      const spreads = validateSpreads(applySeedFallbacks(normalizeSpreads(merged)));

      let eur = null, eurLabel = "";
      try { const e = await fetchEuribor(); eur = e.eur; eurLabel = e.eurLabel; }
      catch (e) { console.error("spreads.js: fetchEuribor falhou:", e.message); }
      if (eur && getBanksModule()?.setEuribor) {
        try { getBanksModule().setEuribor(eur, eurLabel); } catch (_) {}
      }

      PENDING = { spreads, eur, eurLabel, fetchedAt: Date.now() };
      REFRESH.error = null;
      if (SPREADS_AUTO_APPLY) applyPending(today, kvSlot);
      console.log("spreads.js: refresh concluído —", SPREADS_AUTO_APPLY ? "auto-aplicado" : "pendente de aprovação");
    } catch (e) {
      REFRESH.error = e?.message || "Erro desconhecido";
      console.error("spreads.js: refresh falhou:", REFRESH.error);
    } finally {
      REFRESH.running    = false;
      REFRESH.finishedAt = Date.now();
    }
  })();

  return true;
}

function withMeta(payload, source, fetchedAt) {
  return {
    ...payload,
    meta: {
      updatedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
      source,
      note: "Prestação/TAEG/MTIC podem diferir do oficial se o cenário não for exatamente igual (prazo, comissões, seguros, idade, finalidade, LTV e tipo de taxa).",
    },
  };
}

module.exports = async function handler(req, res) {
  const apiKeyEnv = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  // GET — estado do refresh (polling do admin). Também faz avançar o batch:
  // consulta o estado do job e, quando termina, valida e fica PENDENTE.
  if (req.method === "GET") {
    return res.status(200).json(refreshStatus());
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });

  // Admin override — bypassa rate limits e cache (token válido = acesso irrestrito)
  const adminToken = process.env.ADMIN_TOKEN;
  const reqToken   = req.headers["x-admin-token"] || "";
  const isAdmin    = !!(adminToken && reqToken === adminToken);

  // Aprovação / rejeição dos dados PENDENTES (admin, via header x-spreads-action)
  const action = String(req.headers["x-spreads-action"] || "").toLowerCase();
  if (action === "approve" || action === "reject") {
    if (!isAdmin) return res.status(403).json({ error: "Requer x-admin-token" });
    if (action === "approve") {
      // x-spreads-codes (opcional): lista separada por vírgulas para aprovar só
      // alguns bancos; ausente = aprovar todos.
      const codesHdr  = String(req.headers["x-spreads-codes"] || "").trim();
      const onlyCodes = codesHdr
        ? codesHdr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : null;
      const applied = applyPending(utcDayKey(), null, onlyCodes);
      return res.status(applied ? 200 : 409).json({ applied, ...refreshStatus() });
    }
    PENDING = null;
    return res.status(200).json({ rejected: true, ...refreshStatus() });
  }

  // Variáveis partilhadas entre o bloco de limites e o bloco de API
  const today    = utcDayKey();
  let kvCached   = null;
  let kvSlot     = null;

  if (!isAdmin) {
    // Rate limit (in-memory, por instância — suficiente para protecção básica)
    const forwardedFor = req.headers["x-forwarded-for"] || "";
    const realIp       = req.headers["x-real-ip"] || "";
    const ip = forwardedFor.split(",")[0]?.trim() || realIp || req.socket?.remoteAddress || "unknown";
    if (isRateLimited(ip)) return res.status(429).json({ error: "Demasiados pedidos — tenta mais tarde" });

    // ── 1. L1: in-memory (evita round-trip KV na mesma instância quente)
    if (MEM.dayKey !== today) { MEM.callsToday = 0; MEM.dayKey = today; }
    const memAge = Date.now() - MEM.fetchedAt;
    if (MEM.data && (MEM.callsToday >= MAX_CALLS_PER_DAY || memAge < MIN_INTERVAL_MS)) {
      res.setHeader("X-Cache",           "MEM-HIT");
      res.setHeader("X-Cache-Age",       Math.floor(memAge / 60000) + "min");
      res.setHeader("X-Calls-Today",     MEM.callsToday + "/" + MAX_CALLS_PER_DAY);
      res.setHeader("X-Data-Updated-At", new Date(MEM.fetchedAt).toISOString());
      return res.status(200).json(withMeta(MEM.data, "mem-cache", MEM.fetchedAt));
    }

    // ── 2. L2: SQLite KV cache
    kvCached = await kvGet(KV_CACHE_KEY);
    if (kvCached) {
      const kvAge    = Date.now() - (kvCached.fetchedAt || 0);
      const kvCalls  = Number(await kvGet(KV_CALLS_PFX + today) || 0);
      const kvLimitOk = kvCalls < MAX_CALLS_PER_DAY && kvAge >= MIN_INTERVAL_MS;

      if (!kvLimitOk) {
        // Promover para L1 e servir
        MEM.data       = kvCached.data;
        MEM.fetchedAt  = kvCached.fetchedAt || 0;
        MEM.callsToday = kvCalls;
        MEM.dayKey     = today;
        res.setHeader("X-Cache",           "KV-HIT");
        res.setHeader("X-Cache-Age",       Math.floor(kvAge / 60000) + "min");
        res.setHeader("X-Calls-Today",     kvCalls + "/" + MAX_CALLS_PER_DAY);
        res.setHeader("X-Data-Updated-At", new Date(MEM.fetchedAt).toISOString());
        return res.status(200).json(withMeta(kvCached.data, "kv-cache", MEM.fetchedAt));
      }
    }

    // ── 3. Reservar slot atomicamente com INCR antes de chamar a API.
    kvSlot = await kvIncr(KV_CALLS_PFX + today, KV_CALLS_TTL);

    if (kvSlot !== null && kvSlot > MAX_CALLS_PER_DAY) {
      kvDecr(KV_CALLS_PFX + today).catch(() => {});
      const staleD  = kvCached?.data || MEM.data || null;
      const staleTs = kvCached?.fetchedAt || MEM.fetchedAt || 0;
      if (staleD) {
        res.setHeader("X-Cache",       "KV-LIMIT");
        res.setHeader("X-Calls-Today", (kvSlot - 1) + "/" + MAX_CALLS_PER_DAY);
        return res.status(200).json(withMeta(staleD, "kv-cache", staleTs));
      }
    }
    if (kvSlot === null && MEM.callsToday >= MAX_CALLS_PER_DAY) {
      const staleD = MEM.data || null;
      if (staleD) {
        res.setHeader("X-Cache",       "MEM-LIMIT");
        res.setHeader("X-Calls-Today", MEM.callsToday + "/" + MAX_CALLS_PER_DAY);
        return res.status(200).json(withMeta(staleD, "mem-cache", MEM.fetchedAt));
      }
    }
  }

  const apiKey = apiKeyEnv;
  if (!apiKey && !SPREADS_MOCK) return res.status(503).json({ error: "GEMINI_API_KEY não configurada" });

  // ── 4. Iniciar o refresh em background e responder de imediato. O resultado
  // fica PENDENTE até aprovação no admin (ou auto-aplicado se SPREADS_AUTO_APPLY=1).
  const started = startRefresh(apiKey, kvSlot, today);
  // Já havia um refresh em curso — devolver o slot reservado em ── 3
  if (!started && kvSlot !== null) kvDecr(KV_CALLS_PFX + today).catch(() => {});

  const staleData      = kvCached?.data || MEM.data || null;
  const staleFetchedAt = kvCached?.fetchedAt || MEM.fetchedAt || 0;
  if (staleData) {
    res.setHeader("X-Cache", "REFRESHING");
    return res.status(200).json(withMeta(staleData, "stale-cache", staleFetchedAt));
  }
  return res.status(202).json({ status: "refreshing", ...refreshStatus() });
};

// Exposto para testes/admin (não usado pelo router)
module.exports.validateSpreads = validateSpreads;
module.exports.normalizeSpreads = normalizeSpreads;
module.exports.applySeedFallbacks = applySeedFallbacks;
module.exports.toSpreadsMap    = toSpreadsMap;
module.exports.SPREADS_SCHEMA  = SPREADS_SCHEMA;
module.exports.BANK_SOURCES    = BANK_SOURCES;
module.exports.extractSpreads  = extractSpreads;
module.exports.parseBatchSpreads = parseBatchSpreads;
module.exports.buildPrompt     = buildPrompt;
module.exports.buildBatches    = buildBatches;
module.exports.SYSTEM_PROMPT   = SYSTEM_PROMPT;
module.exports.auditUrls       = auditUrls;
