const BCE_BASE = "https://data-api.ecb.europa.eu/service/data/FM/";
const BCE_SERIES = {
  "3m":  "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
  "6m":  "M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
  "12m": "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
};

function parseAllRows(csv) {
  const lines = csv.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  const dateIdx = headers.indexOf("TIME_PERIOD");
  const valIdx  = headers.indexOf("OBS_VALUE");
  if (dateIdx < 0 || valIdx < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
    const date = cols[dateIdx];
    const val  = parseFloat(cols[valIdx]);
    if (date && !isNaN(val)) out.push({ date, value: val });
  }
  return out;
}

let _cache    = null;
let _cacheAt  = 0;
const CACHE_TTL = 6 * 3600 * 1000;

async function fetchHistory() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  const result = {};
  await Promise.allSettled(
    Object.entries(BCE_SERIES).map(async ([key, series]) => {
      const r = await fetch(
        BCE_BASE + series + "?format=csvdata&startPeriod=2015-01",
        { signal: AbortSignal.timeout(20000) }
      );
      if (!r.ok) throw new Error("BCE " + key + " HTTP " + r.status);
      result[key] = parseAllRows(await r.text());
    })
  );
  _cache   = result;
  _cacheAt = Date.now();
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não suportado" });
  }
  try {
    const data = await fetchHistory();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(503).json({ error: "Indisponível", detail: err.message });
  }
};
