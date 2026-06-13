const path  = require("path");
const https = require("https");
const http  = require("http");
const { URL: NodeURL } = require("url");
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

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
// PDFs são buscados pelo Node.js e enviados ao modelo como document blocks —
// sem tools, sem Batch API, sem loop de iterações.
const PDF_FETCH_TIMEOUT_MS = 30_000; // por PDF
const PDF_MAX_BYTES        = 6 * 1024 * 1024; // 6 MB

// Auto-aplicar o resultado da AI sem revisão no admin (compatibilidade com o fluxo antigo).
// Por defeito o resultado fica PENDENTE e só vai a "live" depois de aprovação no painel admin.
const SPREADS_AUTO_APPLY = process.env.SPREADS_AUTO_APPLY === "1";

const BANK_NAMES = {
  CA: "Crédito Agrícola", CTT: "Banco CTT", BNKTR: "Bankinter Portugal",
  ABANCA: "ABANCA Portugal", BCP: "Millennium BCP", ACTVO: "ActivoBank",
  BPI: "Banco BPI", MNTPO: "Banco Montepio", SANTR: "Santander Portugal",
  NB: "novobanco", CGD: "Caixa Geral de Depósitos", UCI: "UCI Portugal",
  BNI: "BNI Europa", BEST: "Banco Best",
};

// Preçários oficiais por banco. O Node.js faz os fetches em paralelo e envia
// os PDFs ao modelo como document blocks — sem tools, sem loop de iterações.
// Dois URLs por banco onde disponível: [taxas §18.1, comissões §18.2].
// BEST não tem URL público — fica sem PDF (o modelo estima).
const BANK_SOURCES = {
  CA:     ["https://www.creditoagricola.pt/-/media/files/precario/documents-site/taxas-de-juro-_aviso-8-2009-do-bdp/pre-ft-202605.pdf",
           "https://www.creditoagricola.pt/-/media/files/precario/documents-site/comissoes-e-despesas-_aviso-8-2009-do-bdp/pre-fc-20260501.pdf"],
  CTT:    ["https://www.bancoctt.pt/application/themes/pdfs/precario.pdf?language_id=1555597541833"],
  BNKTR:  ["https://clientebancario.bportugal.pt/sites/default/files/precario/0269_/0269_PRE_20221231000630.pdf"],
  ABANCA: ["https://www.abanca.pt/files/documents/folheto-taxa-juro-precario-e3020223.pdf",
           "https://www.abanca.pt/files/documents/precario-folheto-comissoes-f942c04e.pdf"],
  BCP:    ["https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf"],
  ACTVO:  ["https://ind.millenniumbcp.pt/pt/Articles/Documents/precario/SECCAO_18.pdf"],
  BPI:    ["https://www.bancobpi.pt/contentservice/getContent?documentName=PR_WCS01_UCM01004994",
           "https://www.bancobpi.pt/contentservice/getContent?documentName=PR_WCS01_UCM01004993"],
  MNTPO:  ["https://www.bancomontepio.pt/content/dam/montepio/pdf/geral/precario/folheto-taxas-juro/folheto-taxas-juro.pdf",
           "https://www.bancomontepio.pt/content/dam/montepio/pdf/geral/precario/folheto-comissoes-despesas/folheto-comissoes-despesas.pdf"],
  SANTR:  ["https://www.santander.pt/pdfs/particulares/credito-habitacao/CH_Informacao_Pre-Contratual_Geral.pdf",
           "https://www.santander.pt/pdfs/precario-banco/folheto-taxas-juro/outros-clientes/20-operacoes-credito/20_precariofolhetotaxasjuro_oc_opscredito.pdf"],
  NB:     ["https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/PRE-FT.pdf.coredownload.inline.pdf",
           "https://www.novobanco.pt/content/dam/novobancopublicsites/docs/pdfs/precario/particulares/PRE-FC.pdf.coredownload.inline.pdf"],
  CGD:    ["https://www.cgd.pt/Precario/Documents/18.pdf",
           "https://www.cgd.pt/Precario/Documents/10.pdf"],
  UCI:    ["https://uci.pt/-/media/Files/Portugal/precario/PRE-FT-202605.pdf",
           "https://uci.pt/-/media/Files/Portugal/precario/PRE-FC-20260301.pdf"],
  BNI:    ["https://bnieuropa.pt/wp-content/themes/responsive/pdf/precario/taxas-juro-particulares-credito-habitacao-e-contratos-conexos.pdf",
           "https://bnieuropa.pt/wp-content/themes/responsive/pdf/precario/particulares-credito-habitacao-e-contratos-conexos.pdf"],
  BEST:   [],
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

const SYSTEM_PROMPT = `És um analista de crédito habitação em Portugal. A tua tarefa é extrair as condições ACTUAIS de crédito habitação para aquisição de habitação própria permanente (HPP) a partir dos folhetos de preçário (PDFs) fornecidos como documentos nesta mensagem.

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

Regras de extracção:
- sCom é SEMPRE o spread contratual em vigor FORA do período promocional (ou após a promoção terminar) — nunca o spread reduzido da campanha. O spread de campanha vai em promoSpread.
- Os valores "sem produtos" (sSem, mSem, fSem, jsSem) são as condições sem vendas associadas facultativas, por isso ≥ aos valores "com produtos".
- Quando não há campanha promocional: promoPeriodo = 0 e promoSpread = null.
- "Com produtos" assume o pacote típico exigido (domiciliação de ordenado, seguros no banco, cartões).
- Lê os PDFs fornecidos e extrai spreads variáveis, TAN mista, TAN fixa, crédito jovem e comissões.
- Para bancos sem PDF fornecido (ou cujo PDF esteja ilegível), usa uma estimativa razoável com base em bancos comparáveis e indica "Estimativa" em contaNota.
- Indica o mês/ano da fonte em contaNota quando confirmares o valor (ex.: "Preçário mai.2026").
- Quando não encontrares um valor concreto (ex.: comissão exacta de dossier), usa uma estimativa razoável com base em bancos comparáveis e escreve "Estimativa" em contaNota (e "(est.)" em insV/insM se a seguradora for desconhecida).
- Valores monetários em EUR; spreads e TANs em pontos percentuais (ex.: 0.70 = 0,70%).

Responde apenas com o objecto JSON pedido — {"bancos":[...]} com exactamente 14 entradas, cada uma com o campo "codigo" — sem texto adicional.`;

// ── Fetch PDFs server-side ────────────────────────────────────────────────
// Busca um PDF via HTTP/HTTPS com timeout e limite de tamanho. Segue até 3
// redirects. Devolve Buffer com o conteúdo ou null em caso de falha.
async function fetchPdf(rawUrl, _depth) {
  const depth = _depth || 0;
  if (depth > 3) return null;
  return new Promise((resolve) => {
    let settled = false;
    function done(v) { if (!settled) { settled = true; resolve(v); } }
    let parsed;
    try { parsed = new NodeURL(rawUrl); } catch (_) { return done(null); }
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(rawUrl, { headers: { "User-Agent": "simulador-precarios/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetchPdf(res.headers.location, depth + 1).then(done);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); return done(null); }
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > PDF_MAX_BYTES) { req.destroy(); return done(null); }
        chunks.push(chunk);
      });
      res.on("end", () => done(Buffer.concat(chunks)));
      res.on("error", () => done(null));
    });
    req.on("error", () => done(null));
    req.setTimeout(PDF_FETCH_TIMEOUT_MS, () => { req.destroy(); done(null); });
  });
}

// Busca todos os PDFs em paralelo. Devolve mapa code → Buffer[] (um por URL).
async function fetchBankPdfs() {
  const results = await Promise.all(
    BANK_CODES.map(async (code) => {
      const urls = BANK_SOURCES[code] || [];
      if (!urls.length) return [code, []];
      const bufs = await Promise.all(urls.map((u) => fetchPdf(u)));
      return [code, bufs.filter(Boolean)];
    })
  );
  return Object.fromEntries(results);
}

const DOC_LABELS = ["Taxas de juro §18.1", "Comissões §18.2"];

// Constrói o array `messages` com os PDFs como document blocks.
function buildMessages(pdfMap) {
  const content = [];
  for (const code of BANK_CODES) {
    const bufs = pdfMap[code] || [];
    bufs.forEach((buf, i) => {
      if (buf && buf.length > 0) {
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
          title: `${code} — ${BANK_NAMES[code]} — ${DOC_LABELS[i] || "Preçário"}`,
          context: "Folheto de preçário para crédito habitação HPP",
        });
      }
    });
  }
  const missing = BANK_CODES.filter((c) => !(pdfMap[c] || []).length);
  let userText = "Extrai as condições actuais de crédito habitação HPP para os 14 bancos a partir dos documentos acima, no formato JSON definido.";
  if (missing.length) {
    userText += `\n\nBancos sem PDF disponível — estima com base em bancos comparáveis: ${missing.join(", ")}.`;
  }
  content.push({ type: "text", text: userText });
  return [{ role: "user", content }];
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

// Extrai e valida os spreads a partir da mensagem devolvida pelo batch.
// Com web_fetch/web_search há blocos de texto intermédios (narração entre tools);
// o JSON do schema é normalmente o ÚLTIMO bloco, mas pode haver texto a seguir —
// por isso varre-se do último para o primeiro até encontrar um objecto válido.
function extractSpreads(message) {
  if (!message) throw new Error("Batch sem mensagem");
  if (message.stop_reason === "pause_turn") throw new Error("modelo pausou (pause_turn) — re-tenta a actualização");
  if (message.stop_reason === "refusal") throw new Error("API recusou o pedido");
  const textBlocks = (message.content || []).filter(b => b.type === "text").map(b => b.text).filter(t => t && t.trim());
  if (!textBlocks.length) throw new Error("Resposta vazia (stop_reason: " + message.stop_reason + ")");

  let parsed = null;
  for (let i = textBlocks.length - 1; i >= 0 && !parsed; i--) {
    const raw = textBlocks[i].replace(/```(?:json)?/g, "").trim();
    for (const fn of [() => JSON.parse(raw), () => parseSpreadsText(textBlocks[i])]) {
      try { const m = asSpreadsMap(fn()); if (m) { parsed = m; break; } } catch (_) {}
    }
  }
  // Último recurso: juntar todos os blocos e procurar o objecto "bancos".
  if (!parsed) { try { parsed = asSpreadsMap(parseSpreadsText(textBlocks.join("\n"))); } catch (_) {} }

  if (!parsed) {
    const preview = textBlocks[textBlocks.length - 1].slice(0, 200);
    throw new Error("Não encontrei o JSON dos bancos na resposta. Início do último bloco: " + preview);
  }
  try {
    return validateSpreads(parsed);
  } catch (err) {
    console.error("spreads.js: validação falhou — chaves=[" + Object.keys(parsed).join(",") + "]");
    throw err;
  }
}

// ── Refresh assíncrono (background) ──────────────────────────────────────
// Os PDFs são buscados pelo Node.js em paralelo e enviados ao modelo como
// document blocks. Sem tools, sem Batch API — apenas uma chamada síncrona
// à Messages API que corre em background (Promise não awaited pelo handler).
// O resultado fica PENDENTE até aprovação no admin (ou auto-aplicado se
// SPREADS_AUTO_APPLY=1).
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
function applyPending(today, kvSlot) {
  if (!PENDING) return false;
  const freshData = { spreads: PENDING.spreads, eur: PENDING.eur, eurLabel: PENDING.eurLabel };
  const fetchedAt = PENDING.fetchedAt || Date.now();
  MEM.data       = freshData;
  MEM.fetchedAt  = fetchedAt;
  MEM.dayKey     = today;
  MEM.callsToday = kvSlot != null ? Number(kvSlot) : MEM.callsToday + 1;
  const banksModule = getBanksModule();
  if (banksModule?.bulkInsertSpreads) {
    try { banksModule.bulkInsertSpreads(freshData.spreads, "anthropic"); }
    catch (e) { console.error("spreads.js: bulkInsertSpreads failed:", e.message); }
  }
  kvSet(KV_CACHE_KEY, { data: freshData, fetchedAt }, KV_CACHE_TTL).catch(() => {});
  PENDING = null;
  return true;
}

// Inicia o refresh em background: busca PDFs em paralelo, chama Messages API
// de forma síncrona e actualiza REFRESH/PENDING quando termina. O POST HTTP
// responde imediatamente; o admin faz polling ao GET até running=false.
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
      console.log("spreads.js: a buscar PDFs dos preçários...");
      const pdfMap = await fetchBankPdfs();
      const nFetched = Object.values(pdfMap).filter(Boolean).length;
      console.log(`spreads.js: ${nFetched}/${BANK_CODES.length} PDFs obtidos`);

      const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 120_000 });
      const message = await client.messages.create({
        model:         ANTHROPIC_MODEL,
        max_tokens:    32000,
        output_config: { effort: "medium", format: { type: "json_schema", schema: SPREADS_SCHEMA } },
        system:        SYSTEM_PROMPT,
        messages:      buildMessages(pdfMap),
      });

      const spreads = extractSpreads(message);

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
  const apiKeyEnv = process.env.ANTHROPIC_API_KEY;

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
module.exports.toSpreadsMap    = toSpreadsMap;
module.exports.SPREADS_SCHEMA  = SPREADS_SCHEMA;
module.exports.BANK_SOURCES    = BANK_SOURCES;
module.exports.extractSpreads  = extractSpreads;
module.exports.fetchBankPdfs   = fetchBankPdfs;
module.exports.buildMessages   = buildMessages;
