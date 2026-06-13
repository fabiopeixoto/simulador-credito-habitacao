const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
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

/** Por defeito não gravar respostas LLM na SQLite do simulador (`banks.sqlite`); os spreads servidos vêm de SEED_SPREADS + reconcile + POST /api/banks. Para persistir saídas Anthropic na BD: ANTHROPIC_PERSIST_SPREADS=1 */
const PERSIST_ANTHROPIC_SPREADS_TO_SQLITE = process.env.ANTHROPIC_PERSIST_SPREADS === "1";

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

// ── Anthropic API ─────────────────────────────────────────────────────────
const BANK_CODES = ["CA", "CTT", "BNKTR", "ABANCA", "BCP", "ACTVO", "BPI", "MNTPO", "SANTR", "NB", "CGD", "UCI", "BNI", "BEST"];

const ANTHROPIC_MODEL     = "claude-sonnet-4-6"; // extracção, não raciocínio profundo — Sonnet chega e é mais barato/rápido
const WEB_FETCH_MAX_USES  = 28;                  // ≥1 fetch por preçário (≈25 URLs) + folga
const WEB_SEARCH_MAX_USES = 6;                   // fallback para bancos sem URL (BEST) ou URLs em 404
const BATCH_KV_KEY        = "spreads:batch:v1";  // estado do batch em curso (persiste a reinícios do contentor)
const BATCH_KV_TTL        = 26 * 60 * 60;        // 26 h (batches expiram do lado da Anthropic em 29 dias)

// Auto-aplicar o resultado da AI sem revisão no admin (compatibilidade com o fluxo antigo).
// Por defeito o resultado fica PENDENTE e só vai a "live" depois de aprovação no painel admin.
const SPREADS_AUTO_APPLY = process.env.SPREADS_AUTO_APPLY === "1";

// Preçários oficiais por banco (espelho de reference/precarios-pdf/sources.json).
// O modelo usa web_fetch directo nestes URLs (rápido, fiável, determinístico) e
// só recorre a web_search quando um banco não tem URL (BEST) ou o URL devolve 404.
const BANK_SOURCES = {
  CA:     ["https://www.creditoagricola.pt/-/media/files/precario/documents-site/taxas-de-juro-_aviso-8-2009-do-bdp/pre-ft-202605.pdf", "https://www.creditoagricola.pt/-/media/files/precario/documents-site/comissoes-e-despesas-_aviso-8-2009-do-bdp/pre-fc-20260501.pdf"],
  CTT:    ["https://www.bancoctt.pt/application/themes/pdfs/precario.pdf?language_id=1555597541833"],
  BNKTR:  ["https://clientebancario.bportugal.pt/sites/default/files/precario/0269_/0269_PRE_20221231000630.pdf"],
  ABANCA: ["https://www.abanca.pt/files/documents/folheto-taxa-juro-precario-e3020223.pdf", "https://www.abanca.pt/files/documents/precario-folheto-comissoes-f942c04e.pdf"],
  BCP:    ["https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf"],
  ACTVO:  ["https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf"],
  BPI:    ["https://www.bancobpi.pt/contentservice/getContent?documentName=PR_WCS01_UCM01004994", "https://www.bancobpi.pt/contentservice/getContent?documentName=PR_WCS01_UCM01004993"],
  MNTPO:  ["https://www.bancomontepio.pt/content/dam/montepio/pdf/geral/precario/folheto-taxas-juro/folheto-taxas-juro.pdf", "https://www.bancomontepio.pt/content/dam/montepio/pdf/geral/precario/folheto-comissoes-despesas/folheto-comissoes-despesas.pdf"],
  SANTR:  ["https://www.santander.pt/pdfs/particulares/credito-habitacao/CH_Informacao_Pre-Contratual_Geral.pdf", "https://www.santander.pt/pdfs/precario-banco/folheto-taxas-juro/outros-clientes/20-operacoes-credito/20_precariofolhetotaxasjuro_oc_opscredito.pdf"],
  NB:     ["https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/PRE-FT.pdf.coredownload.inline.pdf", "https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/PRE-FC.pdf.coredownload.inline.pdf"],
  CGD:    ["https://www.cgd.pt/Precario/Documents/18.pdf", "https://www.cgd.pt/Precario/Documents/10.pdf"],
  UCI:    ["https://uci.pt/-/media/Files/Portugal/precario/PRE-FT-202605.pdf", "https://uci.pt/-/media/Files/Portugal/precario/PRE-FC-20260301.pdf"],
  BNI:    ["https://bnieuropa.pt/wp-content/themes/responsive/pdf/precario/taxas-juro-particulares-credito-habitacao-e-contratos-conexos.pdf", "https://bnieuropa.pt/wp-content/themes/responsive/pdf/precario/particulares-credito-habitacao-e-contratos-conexos.pdf"],
  BEST:   [], // sem preçário directo no índice — usar web_search
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

const SYSTEM_PROMPT = `És um analista de crédito habitação em Portugal. A tua tarefa é apurar as condições ACTUAIS de crédito habitação para aquisição de habitação própria permanente (HPP) praticadas por 14 bancos portugueses, pesquisando na web os preçários e páginas oficiais de cada banco.

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
- sCom é SEMPRE o spread contratual em vigor FORA do período promocional (ou após a promoção terminar) — nunca o spread reduzido da campanha. O spread de campanha vai em promoSpread.
- Os valores "sem produtos" (sSem, mSem, fSem, jsSem) são as condições sem vendas associadas facultativas, por isso ≥ aos valores "com produtos".
- Quando não há campanha promocional: promoPeriodo = 0 e promoSpread = null.
- "Com produtos" assume o pacote típico exigido (domiciliação de ordenado, seguros no banco, cartões).
- Para cada banco, usa PRIMEIRO a tool web_fetch nos URLs oficiais indicados na mensagem (são os folhetos de preçário do Banco de Portugal — taxas §18.1 e comissões). Lê o PDF e extrai os valores.
- Se um URL devolver 404, HTML/JS em vez do PDF, ou não cobrir o campo, usa web_search para a página de crédito habitação ou FINE do banco. Para o BEST (sem URL indicado) usa sempre web_search.
- Indica o mês/ano da fonte em contaNota quando confirmares o valor (ex.: "Preçário mai.2026").
- Quando não encontrares um valor concreto, usa uma estimativa razoável com base em bancos comparáveis e escreve "Estimativa" em contaNota (e "(est.)" em insV/insM se a seguradora for desconhecida).
- Valores monetários em EUR; spreads e TANs em pontos percentuais (ex.: 0.70 = 0,70%).

Responde apenas com o objecto JSON pedido — {"bancos":[...]} com exactamente 14 entradas, cada uma com o campo "codigo" — sem texto adicional.`;

function buildUserPrompt() {
  const linhas = BANK_CODES.map((code) => {
    const urls = BANK_SOURCES[code] || [];
    return `- ${code}: ${urls.length ? urls.join(" | ") : "(sem URL — usa web_search)"}`;
  }).join("\n");
  return `Apura as condições actuais de crédito habitação HPP para os 14 bancos, no formato JSON definido.\n\nPreçários oficiais a consultar com web_fetch (taxas §18.1 + comissões):\n${linhas}`;
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
      if (entry && typeof entry === "object" && typeof entry.codigo === "string") {
        const { codigo, ...rest } = entry;
        map[codigo] = rest;
      }
    }
    return map;
  }
  return parsed;
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
  // Fallback de parsing quando a resposta não é JSON puro (sem structured outputs)
  const clean = txt.replace(/```(?:json)?/g, "").trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Formato inválido: " + txt.slice(0, 60));
  try { return JSON.parse(m[0]); } catch (_) { throw new Error("JSON inválido: " + m[0].slice(0, 80)); }
}

// Extrai e valida os spreads a partir da mensagem devolvida pelo batch.
function extractSpreads(message) {
  if (!message) throw new Error("Batch sem mensagem");
  if (message.stop_reason === "pause_turn") throw new Error("modelo pausou (pause_turn) — re-tenta a actualização");
  if (message.stop_reason === "refusal") throw new Error("API recusou o pedido");
  const textBlocks = (message.content || []).filter(b => b.type === "text").map(b => b.text);
  if (!textBlocks.join("").trim()) throw new Error("Resposta vazia (stop_reason: " + message.stop_reason + ")");
  // Com web_fetch/web_search há blocos de texto intermédios; o JSON final
  // (constrangido pelo schema) é o ÚLTIMO bloco de texto.
  let parsed;
  try { parsed = JSON.parse(textBlocks[textBlocks.length - 1]); }
  catch (_) { parsed = parseSpreadsText(textBlocks.join("\n")); }
  parsed = toSpreadsMap(parsed);
  return validateSpreads(parsed);
}

// Parâmetros do pedido Messages, submetidos como uma entrada do batch.
function buildRequestParams() {
  return {
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: SPREADS_SCHEMA } },
    system: SYSTEM_PROMPT,
    tools: [
      { type: "web_fetch_20260209",  name: "web_fetch",  max_uses: WEB_FETCH_MAX_USES },
      { type: "web_search_20260209", name: "web_search", max_uses: WEB_SEARCH_MAX_USES },
    ],
    messages: [{ role: "user", content: buildUserPrompt() }],
  };
}

// ── Refresh via Batch API ──────────────────────────────────────────────────
// A chamada ao modelo (Sonnet + web_fetch dos preçários) corre como um job
// assíncrono na Anthropic (Batch API): 50% mais barato, sem timeouts/overload
// do lado do cliente, e o resultado fica disponível 29 dias. O id do batch é
// guardado em KV, por isso o polling resiste a reinícios do contentor (o
// problema "parou" desaparece). O resultado fica PENDENTE até aprovação no
// admin (ou auto-aplicado se SPREADS_AUTO_APPLY=1).
const REFRESH = { running: false, startedAt: 0, finishedAt: 0, error: null, batchId: null, _polling: false, _kvSlot: null, _today: "" };
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

// Promove os dados PENDENTES para "live" (L1 + L2 + opcionalmente SQLite).
function applyPending(today, kvSlot) {
  if (!PENDING) return false;
  const freshData = { spreads: PENDING.spreads, eur: PENDING.eur, eurLabel: PENDING.eurLabel };
  const fetchedAt = PENDING.fetchedAt || Date.now();
  MEM.data       = freshData;
  MEM.fetchedAt  = fetchedAt;
  MEM.dayKey     = today;
  MEM.callsToday = kvSlot != null ? Number(kvSlot) : MEM.callsToday + 1;
  if (PERSIST_ANTHROPIC_SPREADS_TO_SQLITE && getBanksModule() && getBanksModule().bulkInsertSpreads) {
    try { getBanksModule().bulkInsertSpreads(freshData.spreads, "anthropic"); } catch (e) { console.error("spreads.js: bulkInsertSpreads failed:", e.message); }
  }
  kvSet(KV_CACHE_KEY, { data: freshData, fetchedAt }, KV_CACHE_TTL).catch(() => {});
  PENDING = null;
  return true;
}

// Submete o batch e guarda o estado (memória + KV). Awaitable — a criação do
// batch é rápida (só submete), por isso o POST não fica bloqueado.
async function startBatchRefresh(apiKey, kvSlot, today) {
  if (REFRESH.running) return false;
  REFRESH.running    = true;
  REFRESH.startedAt  = Date.now();
  REFRESH.finishedAt = 0;
  REFRESH.error      = null;
  REFRESH._kvSlot    = kvSlot;
  REFRESH._today     = today;
  try {
    const client = new Anthropic({ apiKey, maxRetries: 4 });
    const batch = await client.messages.batches.create({
      requests: [{ custom_id: "spreads", params: buildRequestParams() }],
    });
    REFRESH.batchId = batch.id;
    await kvSet(BATCH_KV_KEY, { batchId: batch.id, startedAt: REFRESH.startedAt, kvSlot, today }, BATCH_KV_TTL).catch(() => {});
    console.log("spreads.js: batch submetido", batch.id);
    return true;
  } catch (e) {
    REFRESH.running    = false;
    REFRESH.finishedAt = Date.now();
    REFRESH.error      = e?.message || "Erro ao submeter batch";
    console.error("spreads.js: falha ao submeter batch:", REFRESH.error);
    return false;
  }
}

// Reidrata o estado do batch a partir do KV (após reinício do contentor).
async function hydrateBatchState() {
  if (REFRESH.batchId || REFRESH.running) return;
  const saved = await kvGet(BATCH_KV_KEY);
  if (saved && saved.batchId) {
    REFRESH.batchId   = saved.batchId;
    REFRESH.startedAt = saved.startedAt || Date.now();
    REFRESH.running   = true;
    REFRESH._kvSlot   = saved.kvSlot ?? null;
    REFRESH._today    = saved.today || utcDayKey();
  }
}

// Verifica o batch uma vez (chamado a partir do GET de polling do admin).
// Em "ended": extrai/valida → fica PENDENTE (ou auto-aplica). Resiste a
// reinícios porque o id está em KV.
async function pollBatchOnce(apiKey) {
  await hydrateBatchState();
  if (!REFRESH.batchId || REFRESH._polling) return;
  REFRESH._polling = true;
  try {
    const client = new Anthropic({ apiKey, maxRetries: 4 });
    const batch = await client.messages.batches.retrieve(REFRESH.batchId);
    if (batch.processing_status !== "ended") return;

    let spreads = null, err = null;
    for await (const r of await client.messages.batches.results(REFRESH.batchId)) {
      if (r.custom_id !== "spreads") continue;
      if (r.result.type === "succeeded") {
        try { spreads = extractSpreads(r.result.message); }
        catch (e) {
          err = e.message;
          console.error("spreads.js: validação do batch falhou:", err);
        }
      } else if (r.result.type === "errored") {
        err = "batch errored: " + (r.result.error?.error?.message || r.result.error?.type || "?");
      } else {
        err = "batch " + r.result.type;
      }
    }

    // Batch terminou — limpar estado em curso
    const kvSlot = REFRESH._kvSlot;
    const today  = REFRESH._today || utcDayKey();
    REFRESH.batchId    = null;
    REFRESH.running    = false;
    REFRESH.finishedAt = Date.now();
    await kvSet(BATCH_KV_KEY, null, 1).catch(() => {});

    if (!spreads) { REFRESH.error = err || "Erro desconhecido no batch"; return; }
    REFRESH.error = null;

    // Euribor (rápido) — actualizar também a cache do BCE
    let eur = null, eurLabel = "";
    try { const e = await fetchEuribor(); eur = e.eur; eurLabel = e.eurLabel; }
    catch (e) { console.error("spreads.js: fetchEuribor falhou:", e.message); }
    if (eur && getBanksModule() && getBanksModule().setEuribor) {
      try { getBanksModule().setEuribor(eur, eurLabel); } catch (e) { console.error("spreads.js: setEuribor failed:", e.message); }
    }

    PENDING = { spreads, eur, eurLabel, fetchedAt: Date.now() };
    if (SPREADS_AUTO_APPLY) applyPending(today, kvSlot);
  } catch (e) {
    // Erro transitório ao consultar o batch — deixar em curso, tentar no próximo poll
    console.error("spreads.js: pollBatch erro transitório:", e?.message);
  } finally {
    REFRESH._polling = false;
  }
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
  const apiKeyEnv = process.env.ANTHROPIC_API_KEY;

  // GET — estado do refresh (polling do admin). Também faz avançar o batch:
  // consulta o estado do job e, quando termina, valida e fica PENDENTE.
  if (req.method === "GET") {
    if (apiKeyEnv) { try { await pollBatchOnce(apiKeyEnv); } catch (_) {} }
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
      const applied = applyPending(utcDayKey(), null);
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
  if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY não configurada" });

  // ── 4. Submeter o batch (Anthropic) e responder de imediato. O resultado é
  // recolhido pelo polling (GET) e fica PENDENTE até aprovação no admin.
  const started = await startBatchRefresh(apiKey, kvSlot, today);
  // Já havia um batch em curso — devolver o slot reservado em ── 3
  if (!started && kvSlot !== null) kvDecr(KV_CALLS_PFX + today).catch(() => {});
  // Falha na submissão do batch — devolver o slot e reportar o erro
  if (!started && REFRESH.error && !REFRESH.running) {
    if (kvSlot !== null) kvDecr(KV_CALLS_PFX + today).catch(() => {});
    return res.status(502).json({ error: REFRESH.error, ...refreshStatus() });
  }

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
module.exports.toSpreadsMap    = toSpreadsMap;
module.exports.SPREADS_SCHEMA  = SPREADS_SCHEMA;
module.exports.buildRequestParams = buildRequestParams;
module.exports.BANK_SOURCES     = BANK_SOURCES;
