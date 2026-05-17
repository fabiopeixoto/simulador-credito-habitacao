const fs = require("fs");
const path = require("path");

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

// ── SQLite persistence (banks.sqlite / kv_store) ───────────────────────────
let sqliteDb = null;
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "banks.sqlite");

try {
  const Database = require("better-sqlite3");
  fs.mkdirSync(dbDir, { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);
} catch (e) {
  console.error("euribor-history.js: SQLite init:", e.message);
}

const CACHE_TTL = 6 * 3600 * 1000;
const KV_KEY = "euribor_history";

function readFromDb() {
  if (!sqliteDb) return null;
  try {
    const row = sqliteDb.prepare("SELECT value, updated_at FROM kv_store WHERE key = ?").get(KV_KEY);
    if (!row || Date.now() - row.updated_at > CACHE_TTL) return null;
    return { data: JSON.parse(row.value), cachedAt: row.updated_at };
  } catch (_) {
    return null;
  }
}

function writeToDb(data) {
  if (!sqliteDb) return;
  try {
    sqliteDb.prepare(`
      INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(KV_KEY, JSON.stringify(data), Date.now());
  } catch (_) {}
}

let _cache   = null;
let _cacheAt = 0;

async function fetchHistory() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;

  const dbEntry = readFromDb();
  if (dbEntry) {
    _cache   = dbEntry.data;
    _cacheAt = dbEntry.cachedAt;
    return _cache;
  }

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

  if (Object.keys(result).length > 0) {
    _cache   = result;
    _cacheAt = Date.now();
    writeToDb(result);
  }
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
