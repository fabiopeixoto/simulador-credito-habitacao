const fs = require("fs");
const path = require("path");

let banksModule = null;
try {
  banksModule = require(path.join(__dirname, "banks.js"));
} catch (_) {}

// ── SQLite cache ──────────────────────────────────────────────────────────
let sqliteDb = null;
try {
  const Database = require("better-sqlite3");
  const dbDir = path.join(__dirname, "..", "data");
  const dbPath = path.join(dbDir, "spreads.sqlite");
  fs.mkdirSync(dbDir, { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expiresAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_kv_store_expires ON kv_store(expiresAt);
  `);
} catch (_) {}

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

// ── BCE Euribor
async function fetchEuribor() {
  const BASE   = "https://data-api.ecb.europa.eu/service/data/FM/";
  const SERIES = {
    "3m":  "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
    "6m":  "M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
    "12m": "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
  };
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  function parseCSV(csv) {
    const lines   = csv.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) throw new Error("CSV vazio");
    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const dateIdx = headers.indexOf("TIME_PERIOD");
    const valIdx  = headers.indexOf("OBS_VALUE");
    if (dateIdx < 0 || valIdx < 0) throw new Error("Colunas não encontradas");
    const cols = lines[lines.length - 1].split(",").map(c => c.trim().replace(/"/g, ""));
    const val  = parseFloat(cols[valIdx]);
    const date = cols[dateIdx] || "";
    if (isNaN(val)) throw new Error("Valor inválido");
    return { val, date };
  }
  const eur = {};
  let eurLabel = "";
  const settled = await Promise.allSettled(
    Object.entries(SERIES).map(async ([key, series]) => {
      const r = await fetch(BASE + series + "?format=csvdata&lastNObservations=1", { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("BCE " + key + " HTTP " + r.status);
      const { val, date } = parseCSV(await r.text());
      eur[key] = val;
      if (!eurLabel && date) {
        const [y, m] = date.split("-");
        eurLabel = (MESES[parseInt(m, 10) - 1] || m) + ". " + y;
      }
    })
  );
  if (settled.every(r => r.status === "rejected"))
    throw new Error(settled[0].reason?.message || "BCE indisponível");
  return { eur, eurLabel };
}

// ── Anthropic API
async function callAnthropicAPI(apiKey, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body:    JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
    signal:  AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.error?.message || "Erro API"), { httpStatus: response.status });
  }
  const data = await response.json().catch(() => null);
  if (!data) throw new Error("Resposta inválida da API");
  const txt   = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const clean = txt.replace(/```(?:json)?/g, "").trim();
  const m     = clean.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Formato inválido: " + txt.slice(0, 60));
  try { return JSON.parse(m[0]); } catch (_) { throw new Error("JSON inválido: " + m[0].slice(0, 80)); }
}

const PROMPT = `Com base no teu conhecimento de treino, indica para cada banco português (CA, CTT, BNKTR, ABANCA, BCP, ACTVO, BPI, MNTPO, SANTR, NB, CGD, UCI, BNI) os seguintes dados actuais de crédito habitação HPP: sCom/sSem (spread variável com/sem produtos — sCom deve ser SEMPRE o spread normal FORA do período promocional ou após a promoção, nunca o spread reduzido da campanha), mCom/mSem (TAN misto com/sem produtos, em %), fCom/fSem (TAN fixo com/sem produtos, em %), jsCom/jsSem (spread Jovem com/sem produtos), promoPeriodo (meses de período promocional, 0 se não existir), promoSpread (spread durante promoção em %, em geral inferior ou igual a sCom; null se não existir), dossier/avaliacao (comissões iniciais em EUR), contaMes (comissão mensal de conta em EUR, 0 se inexistente), capMin/capMax (capital mínimo e máximo em EUR), vRef (prémio mensal seguro vida para titular de 30 anos e 150.000€ capital, em EUR), mAno (prémio anual seguro multirriscos para imóvel de 200.000€, em EUR), insV (nome da seguradora de vida, string curta), insM (nome da seguradora multirriscos, string curta), contaNota (fonte/nota da comissão de conta, string curta, ex: "Estimativa" ou "Confirmado preçário mai.2026"), minutas (comissão de preparação de minutas em EUR, inteiro, 0 se não existe), jovemIsenta (boolean, true se banco isenta comissões dossier e avaliação no CH Jovem, false caso contrário). Usa estimativas razoáveis quando não souberes o valor exacto. Responde APENAS com JSON puro e compacto (sem espaços, sem newlines, sem markdown, sem explicações): {"CA":{"sCom":0.75,"sSem":1.65,"mCom":2.90,"mSem":3.80,"fCom":3.00,"fSem":3.80,"jsCom":0.75,"jsSem":1.65,"promoPeriodo":24,"promoSpread":0.45,"dossier":250,"avaliacao":200,"contaMes":3.50,"capMin":25000,"capMax":2000000,"vRef":22.68,"mAno":160,"insV":"CA Seguros","insM":"CA Seguros","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"CTT":{"sCom":0.85,"sSem":1.70,"mCom":3.40,"mSem":3.40,"fCom":3.95,"fSem":4.55,"jsCom":0.85,"jsSem":1.70,"promoPeriodo":0,"promoSpread":null,"dossier":0,"avaliacao":200,"contaMes":0,"capMin":25000,"capMax":1000000,"vRef":15.71,"mAno":170,"insV":"CTT Seguros","insM":"CTT Seguros","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"BNKTR":{"sCom":0.70,"sSem":1.05,"mCom":2.90,"mSem":3.25,"fCom":3.45,"fSem":3.80,"jsCom":0.62,"jsSem":0.97,"promoPeriodo":24,"promoSpread":null,"dossier":350,"avaliacao":250,"contaMes":0,"capMin":100000,"capMax":3000000,"vRef":33.28,"mAno":196,"insV":"Bankinter Seguros","insM":"Bankinter Seguros","contaNota":"Estimativa","minutas":0,"jovemIsenta":false},"ABANCA":{"sCom":0.70,"sSem":1.70,"mCom":3.45,"mSem":4.45,"fCom":2.70,"fSem":3.50,"jsCom":0.58,"jsSem":1.58,"promoPeriodo":0,"promoSpread":null,"dossier":520,"avaliacao":286,"contaMes":6.24,"capMin":5000,"capMax":2000000,"vRef":16.76,"mAno":154,"insV":"Abanca Seguros","insM":"Abanca Seguros","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"BCP":{"sCom":0.70,"sSem":1.50,"mCom":3.45,"mSem":4.25,"fCom":4.10,"fSem":4.65,"jsCom":0.85,"jsSem":1.50,"promoPeriodo":24,"promoSpread":0,"dossier":300,"avaliacao":250,"contaMes":5.00,"capMin":20000,"capMax":3000000,"vRef":19.92,"mAno":256,"insV":"Ocidental Vida","insM":"Ageas/Ocidental","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"ACTVO":{"sCom":0.80,"sSem":1.50,"mCom":3.50,"mSem":4.25,"fCom":4.05,"fSem":5.05,"jsCom":0.68,"jsSem":1.38,"promoPeriodo":24,"promoSpread":0,"dossier":300,"avaliacao":250,"contaMes":0,"capMin":20000,"capMax":3000000,"vRef":19.84,"mAno":256,"insV":"Ocidental Vida","insM":"Ageas/Ocidental","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"BPI":{"sCom":0.75,"sSem":1.50,"mCom":3.20,"mSem":3.95,"fCom":4.10,"fSem":4.85,"jsCom":0.75,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":290,"avaliacao":230,"contaMes":4.90,"capMin":25000,"capMax":3000000,"vRef":13.12,"mAno":195,"insV":"BPI Vida","insM":"BPI Seguros","contaNota":"Estimativa","minutas":190,"jovemIsenta":true},"MNTPO":{"sCom":0.70,"sSem":2.30,"mCom":3.15,"mSem":4.75,"fCom":3.10,"fSem":5.80,"jsCom":0.58,"jsSem":1.38,"promoPeriodo":0,"promoSpread":null,"dossier":312,"avaliacao":239,"contaMes":3.11,"capMin":10000,"capMax":2000000,"vRef":8.29,"mAno":79,"insV":"Lusitania Vida","insM":"Lusitania","contaNota":"Estimativa","minutas":0,"jovemIsenta":false},"SANTR":{"sCom":0.80,"sSem":1.90,"mCom":3.25,"mSem":4.35,"fCom":4.40,"fSem":4.40,"jsCom":0.80,"jsSem":1.90,"promoPeriodo":36,"promoSpread":0,"dossier":725,"avaliacao":230,"contaMes":2.90,"capMin":30000,"capMax":3000000,"vRef":22.55,"mAno":246,"insV":"Santander Seguros","insM":"Santander Seguros","contaNota":"Estimativa","minutas":0,"jovemIsenta":false},"NB":{"sCom":0.75,"sSem":1.70,"mCom":3.65,"mSem":4.60,"fCom":3.71,"fSem":5.99,"jsCom":0.65,"jsSem":1.60,"promoPeriodo":0,"promoSpread":null,"dossier":333,"avaliacao":322,"contaMes":8.22,"capMin":10000,"capMax":3000000,"vRef":17.55,"mAno":98,"insV":"GamaLife","insM":"Mudum","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"CGD":{"sCom":0.70,"sSem":2.90,"mCom":3.15,"mSem":5.35,"fCom":4.75,"fSem":6.95,"jsCom":0.65,"jsSem":1.35,"promoPeriodo":24,"promoSpread":null,"dossier":250,"avaliacao":200,"contaMes":6.30,"capMin":5000,"capMax":3000000,"vRef":29.82,"mAno":110,"insV":"Fidelidade","insM":"Fidelidade Casa","contaNota":"Estimativa","minutas":0,"jovemIsenta":true},"UCI":{"sCom":1.64,"sSem":2.14,"mCom":4.35,"mSem":4.85,"fCom":4.85,"fSem":5.35,"jsCom":1.64,"jsSem":2.14,"promoPeriodo":0,"promoSpread":null,"dossier":300,"avaliacao":230,"contaMes":0,"capMin":30000,"capMax":2000000,"vRef":19.00,"mAno":150,"insV":"(est.)","insM":"(est.)","contaNota":"Estimativa","minutas":0,"jovemIsenta":false},"BNI":{"sCom":1.00,"sSem":1.50,"mCom":3.10,"mSem":3.60,"fCom":3.70,"fSem":4.20,"jsCom":1.00,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":400,"avaliacao":250,"contaMes":3.00,"capMin":25000,"capMax":1000000,"vRef":19.00,"mAno":150,"insV":"(est.)","insM":"(est.)","contaNota":"Estimativa","minutas":0,"jovemIsenta":false}}`;

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
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });

  // Admin override — bypassa rate limits e cache (token válido = acesso irrestrito)
  const adminToken = process.env.ADMIN_TOKEN;
  const reqToken   = req.headers["x-admin-token"] || "";
  const isAdmin    = !!(adminToken && reqToken === adminToken);

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY não configurada" });

  // ── 4. Chamar APIs (Anthropic + BCE)
  try {
    const [eurResult, spreadsResult] = await Promise.allSettled([
      fetchEuribor(),
      callAnthropicAPI(apiKey, PROMPT),
    ]);

    const eur      = eurResult.status === "fulfilled" ? eurResult.value.eur      : null;
    const eurLabel = eurResult.status === "fulfilled" ? eurResult.value.eurLabel : "";

    // Persistir Euribor em banks.sqlite para ser servido via GET /api/banks
    if (eur && banksModule && banksModule.setEuribor) {
      try { banksModule.setEuribor(eur, eurLabel); } catch (_) {}
    }

    const staleData = kvCached?.data || MEM.data || null;
    const staleFetchedAt = kvCached?.fetchedAt || MEM.fetchedAt || 0;

    if (spreadsResult.status === "rejected") {
      if (staleData) {
        res.setHeader("X-Cache", "STALE");
        return res.status(200).json(withMeta(eur ? { ...staleData, eur, eurLabel } : staleData, "stale-cache", staleFetchedAt));
      }
      const err = spreadsResult.reason;
      return res.status(err.httpStatus || 500).json({ error: err.message });
    }

    const freshData  = { spreads: spreadsResult.value, eur, eurLabel };
    const fetchedAt  = Date.now();

    // Actualizar L1 (in-memory)
    MEM.data       = freshData;
    MEM.fetchedAt  = fetchedAt;
    MEM.dayKey     = today;
    MEM.callsToday = kvSlot !== null ? Number(kvSlot) : MEM.callsToday + 1;

    // Opcional: persistir na SQLite do simulador (desactivado por defeito — evita sobrescrever dados auditados)
    if (PERSIST_ANTHROPIC_SPREADS_TO_SQLITE && banksModule && banksModule.bulkInsertSpreads && spreadsResult.value) {
      try { banksModule.bulkInsertSpreads(spreadsResult.value, "anthropic"); } catch (_) {}
    }

    // Actualizar L2 (KV) — fire-and-forget, não bloqueia a resposta
    kvSet(KV_CACHE_KEY, { data: freshData, fetchedAt }, KV_CACHE_TTL).catch(() => {});
    // kvIncr já foi chamado atomicamente em ── 3 (se KV disponível); só repetir em fallback
    if (kvSlot === null) kvIncr(KV_CALLS_PFX + today, KV_CALLS_TTL).catch(() => {});

    res.setHeader("X-Cache",           "MISS");
    res.setHeader("X-Calls-Today",     MEM.callsToday + "/" + MAX_CALLS_PER_DAY);
    res.setHeader("X-Data-Updated-At", new Date(fetchedAt).toISOString());
    return res.status(200).json(withMeta(freshData, "fresh", fetchedAt));

  } catch (err) {
    const staleData      = kvCached?.data || MEM.data || null;
    const staleFetchedAt = kvCached?.fetchedAt || MEM.fetchedAt || 0;
    if (staleData) {
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(withMeta(staleData, "stale-cache", staleFetchedAt));
    }
    if (err.name === "TimeoutError") return res.status(504).json({ error: "Timeout: API demorou mais de 30s" });
    return res.status(500).json({ error: err.message });
  }
};
