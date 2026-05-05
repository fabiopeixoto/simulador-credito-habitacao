// In-memory rate limiter — best-effort within a warm Vercel instance.
// Cross-instance limiting requires a persistent store (e.g. @vercel/kv).
const rateMap = new Map();
const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_REQ   = 20;

function isRateLimited(ip) {
  const now = Date.now();
  for (const [k, v] of rateMap) if (now > v.reset) rateMap.delete(k);
  const entry = rateMap.get(ip) || { count: 0, reset: now + WINDOW_MS };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + WINDOW_MS; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > MAX_REQ;
}

// Server-side cache — shared across all users on the same warm instance.
// Allows at most MAX_CALLS_PER_DAY real Anthropic API calls per calendar day (UTC).
// All other requests are served from cache. Best-effort: each Vercel instance
// maintains its own cache; cross-instance sharing requires @vercel/kv.
const MAX_CALLS_PER_DAY = 2;
const MIN_INTERVAL_MS   = Math.floor(24 / MAX_CALLS_PER_DAY) * 60 * 60 * 1000; // 12h

const CACHE = {
  data:       null,  // {spreads, eur, eurLabel}
  fetchedAt:  0,
  dayKey:     "",
  callsToday: 0,
};

function utcDayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function resetDayIfNeeded() {
  const today = utcDayKey();
  if (CACHE.dayKey !== today) {
    CACHE.dayKey     = today;
    CACHE.callsToday = 0;
  }
}

async function fetchEuribor() {
  const ECB_BASE = "https://data-api.ecb.europa.eu/service/data/FM/";
  const SERIES = {
    "3m":  "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
    "6m":  "M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
    "12m": "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA"
  };
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  function parseCSV(csv) {
    const lines = csv.trim().split("\n").filter(l => l.trim());
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
  const settled = await Promise.allSettled(Object.entries(SERIES).map(async ([key, series]) => {
    const r = await fetch(ECB_BASE + series + "?format=csvdata&lastNObservations=1", { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("BCE " + key + " HTTP " + r.status);
    const { val, date } = parseCSV(await r.text());
    eur[key] = val;
    if (!eurLabel && date) {
      const [y, m] = date.split("-");
      eurLabel = (MESES[parseInt(m, 10) - 1] || m) + ". " + y;
    }
  }));
  if (settled.every(r => r.status === "rejected")) throw new Error(settled[0].reason?.message || "BCE indisponível");
  return { eur, eurLabel };
}

async function callAnthropicAPI(apiKey, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body:    JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
    signal:  AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.error?.message || "Erro API"), { httpStatus: response.status });
  }
  const data = await response.json().catch(() => null);
  if (!data) throw new Error("Resposta inválida da API");
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const clean = txt.replace(/```(?:json)?/g, "").trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Formato inválido: " + txt.slice(0, 60));
  try { return JSON.parse(m[0]); } catch (_) { throw new Error("JSON inválido: " + m[0].slice(0, 80)); }
}

const PROMPT = `Com base no teu conhecimento de treino, indica para cada banco português (CA, CTT, BNKTR, ABANCA, BCP, ACTVO, BPI, MNTPO, SANTR, NB, CGD, UCI, BIC, BNI) os seguintes dados actuais de crédito habitação HPP: sCom/sSem (spread variável com/sem produtos), mCom/mSem (TAN misto com/sem produtos, em %), fCom/fSem (TAN fixo com/sem produtos, em %), jsCom/jsSem (spread Jovem com/sem produtos), promoPeriodo (meses de período promocional, 0 se não existir), promoSpread (spread durante promoção em % ou null se não existir), dossier/avaliacao (comissões iniciais em EUR), contaMes (comissão mensal de conta em EUR, 0 se inexistente), capMin/capMax (capital mínimo e máximo em EUR), vRef (prémio mensal seguro vida para titular de 30 anos e 150.000€ capital, em EUR), mAno (prémio anual seguro multirriscos para imóvel de 200.000€, em EUR). Usa estimativas razoáveis quando não souberes o valor exacto. Responde APENAS com JSON puro e compacto (sem espaços, sem newlines, sem markdown, sem explicações): {"CA":{"sCom":0.65,"sSem":1.65,"mCom":2.45,"mSem":3.35,"fCom":3.00,"fSem":3.80,"jsCom":0.80,"jsSem":1.65,"promoPeriodo":0,"promoSpread":null,"dossier":250,"avaliacao":200,"contaMes":3.50,"capMin":25000,"capMax":2000000,"vRef":22.68,"mAno":160},"CTT":{"sCom":0.70,"sSem":1.30,"mCom":3.30,"mSem":3.30,"fCom":3.20,"fSem":3.80,"jsCom":0.70,"jsSem":1.30,"promoPeriodo":0,"promoSpread":null,"dossier":0,"avaliacao":200,"contaMes":0,"capMin":25000,"capMax":1000000,"vRef":15.71,"mAno":170},"BNKTR":{"sCom":0.70,"sSem":1.05,"mCom":2.25,"mSem":2.60,"fCom":3.00,"fSem":3.35,"jsCom":0.70,"jsSem":1.05,"promoPeriodo":24,"promoSpread":null,"dossier":350,"avaliacao":250,"contaMes":0,"capMin":100000,"capMax":3000000,"vRef":33.28,"mAno":196},"ABANCA":{"sCom":0.70,"sSem":1.70,"mCom":2.70,"mSem":3.70,"fCom":3.10,"fSem":4.10,"jsCom":0.70,"jsSem":1.70,"promoPeriodo":0,"promoSpread":null,"dossier":300,"avaliacao":230,"contaMes":6.24,"capMin":30000,"capMax":2000000,"vRef":16.76,"mAno":154},"BCP":{"sCom":0.70,"sSem":1.25,"mCom":3.05,"mSem":3.60,"fCom":4.05,"fSem":4.60,"jsCom":0.70,"jsSem":1.25,"promoPeriodo":24,"promoSpread":0,"dossier":300,"avaliacao":250,"contaMes":5.00,"capMin":20000,"capMax":3000000,"vRef":19.92,"mAno":256},"ACTVO":{"sCom":0.75,"sSem":1.50,"mCom":3.10,"mSem":3.85,"fCom":3.85,"fSem":4.85,"jsCom":0.75,"jsSem":1.50,"promoPeriodo":24,"promoSpread":0,"dossier":300,"avaliacao":250,"contaMes":0,"capMin":20000,"capMax":3000000,"vRef":19.84,"mAno":256},"BPI":{"sCom":0.75,"sSem":1.50,"mCom":2.80,"mSem":3.55,"fCom":3.25,"fSem":3.80,"jsCom":0.75,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":290,"avaliacao":230,"contaMes":4.90,"capMin":25000,"capMax":3000000,"vRef":13.12,"mAno":195},"MNTPO":{"sCom":0.70,"sSem":1.50,"mCom":3.05,"mSem":3.85,"fCom":3.30,"fSem":3.90,"jsCom":0.70,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":250,"avaliacao":200,"contaMes":5.41,"capMin":20000,"capMax":2000000,"vRef":8.29,"mAno":79},"SANTR":{"sCom":0.80,"sSem":1.90,"mCom":2.85,"mSem":4.75,"fCom":3.20,"fSem":4.40,"jsCom":0.80,"jsSem":1.90,"promoPeriodo":36,"promoSpread":0,"dossier":280,"avaliacao":250,"contaMes":2.90,"capMin":30000,"capMax":3000000,"vRef":22.55,"mAno":246},"NB":{"sCom":0.80,"sSem":1.50,"mCom":2.84,"mSem":3.54,"fCom":3.64,"fSem":4.24,"jsCom":0.80,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":333,"avaliacao":332,"contaMes":8.22,"capMin":50000,"capMax":3000000,"vRef":17.55,"mAno":98},"CGD":{"sCom":0.85,"sSem":1.35,"mCom":2.50,"mSem":4.60,"fCom":3.30,"fSem":5.40,"jsCom":0.65,"jsSem":1.35,"promoPeriodo":24,"promoSpread":null,"dossier":250,"avaliacao":200,"contaMes":6.30,"capMin":25000,"capMax":3000000,"vRef":29.82,"mAno":110},"UCI":{"sCom":0.85,"sSem":1.30,"mCom":2.90,"mSem":3.40,"fCom":3.40,"fSem":3.90,"jsCom":0.85,"jsSem":1.30,"promoPeriodo":0,"promoSpread":null,"dossier":300,"avaliacao":230,"contaMes":0,"capMin":30000,"capMax":2000000,"vRef":19.00,"mAno":150},"BIC":{"sCom":1.00,"sSem":1.50,"mCom":3.00,"mSem":3.50,"fCom":3.60,"fSem":4.10,"jsCom":1.00,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":400,"avaliacao":250,"contaMes":3.00,"capMin":25000,"capMax":1000000,"vRef":19.00,"mAno":150},"BNI":{"sCom":1.00,"sSem":1.50,"mCom":3.10,"mSem":3.60,"fCom":3.70,"fSem":4.20,"jsCom":1.00,"jsSem":1.50,"promoPeriodo":0,"promoSpread":null,"dossier":400,"avaliacao":250,"contaMes":3.00,"capMin":25000,"capMax":1000000,"vRef":19.00,"mAno":150}}`;


function withMeta(payload, source) {
  return {
    ...payload,
    meta: {
      updatedAt: CACHE.fetchedAt ? new Date(CACHE.fetchedAt).toISOString() : null,
      source,
      note: "Prestação/TAEG/MTIC podem diferir do oficial se o cenário não for exatamente igual (prazo, comissões, seguros, idade, finalidade, LTV e tipo de taxa)."
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });

  const forwardedFor = req.headers["x-forwarded-for"] || "";
  const realIp       = req.headers["x-real-ip"] || "";
  const ip = forwardedFor.split(",")[0]?.trim() || realIp || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Demasiados pedidos — tenta mais tarde" });

  resetDayIfNeeded();

  const cacheAgeMs      = Date.now() - CACHE.fetchedAt;
  const dailyLimitHit   = CACHE.callsToday >= MAX_CALLS_PER_DAY;
  const tooRecentToCall = cacheAgeMs < MIN_INTERVAL_MS;

  if (CACHE.data && (dailyLimitHit || tooRecentToCall)) {
    res.setHeader("X-Cache",       "HIT");
    res.setHeader("X-Cache-Age",   Math.floor(cacheAgeMs / 60000) + "min");
    res.setHeader("X-Calls-Today", CACHE.callsToday + "/" + MAX_CALLS_PER_DAY);
    res.setHeader("X-Data-Updated-At", CACHE.fetchedAt ? new Date(CACHE.fetchedAt).toISOString() : "");
    return res.status(200).json(withMeta(CACHE.data, "cache"));
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY nao configurada no Vercel" });

  try {
    const [eurResult, spreadsResult] = await Promise.allSettled([
      fetchEuribor(),
      callAnthropicAPI(apiKey, PROMPT)
    ]);

    const eur      = eurResult.status === "fulfilled" ? eurResult.value.eur      : null;
    const eurLabel = eurResult.status === "fulfilled" ? eurResult.value.eurLabel : "";

    if (spreadsResult.status === "rejected") {
      if (CACHE.data) {
        res.setHeader("X-Cache", "STALE");
        return res.status(200).json(withMeta(eur ? { ...CACHE.data, eur, eurLabel } : CACHE.data, "stale-cache"));
      }
      const err = spreadsResult.reason;
      return res.status(err.httpStatus || 500).json({ error: err.message });
    }

    CACHE.data      = { spreads: spreadsResult.value, eur, eurLabel };
    CACHE.fetchedAt = Date.now();
    CACHE.callsToday++;

    res.setHeader("X-Cache",       "MISS");
    res.setHeader("X-Calls-Today", CACHE.callsToday + "/" + MAX_CALLS_PER_DAY);
    res.setHeader("X-Data-Updated-At", CACHE.fetchedAt ? new Date(CACHE.fetchedAt).toISOString() : "");
    return res.status(200).json(withMeta(CACHE.data, "fresh"));
  } catch (err) {
    if (CACHE.data) {
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(withMeta(CACHE.data, "stale-cache"));
    }
    if (err.name === "TimeoutError") return res.status(504).json({ error: "Timeout: API demorou mais de 30s" });
    return res.status(500).json({ error: err.message });
  }
};
