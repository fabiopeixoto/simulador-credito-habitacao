const path = require("path");
const { openSqliteDb } = require(path.join(__dirname, "..", "lib", "open-sqlite.js"));
const { randomUUID } = require("crypto");

// ── CORS ──────────────────────────────────────────────────────────────────
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://simhabitacao.pt";

function getAllowedOrigin(reqOrigin) {
  if (!reqOrigin) return null;
  if (CORS_ORIGIN === "*") return "*";
  const allowed = CORS_ORIGIN.split(",").map((s) => s.trim());
  if (allowed.includes(reqOrigin)) return reqOrigin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin)) return reqOrigin;
  return allowed[0];
}

// ── Rate limiting (POST /api/rating) — guarda anti-flood, não é dedupe ─────
const _rlMap = new Map(); // ip → { count, resetAt }
const RL_MAX = 20;
const RL_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = _rlMap.get(ip);
  if (!entry || now > entry.resetAt) {
    _rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    if (_rlMap.size > 10000) {
      for (const [k, v] of _rlMap) { if (now > v.resetAt) _rlMap.delete(k); }
    }
    return false;
  }
  if (entry.count >= RL_MAX) return true;
  entry.count++;
  return false;
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"] || "";
  return fwd.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.socket?.remoteAddress || "";
}

// ── SQLite ────────────────────────────────────────────────────────────────
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "ratings.sqlite");

const RATINGS_SCHEMA = `
    CREATE TABLE IF NOT EXISTS votes (
      id    TEXT PRIMARY KEY,
      ts    INTEGER NOT NULL,
      value INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_votes_ts ON votes(ts);
  `;

const { db: sqliteDb } = openSqliteDb(dbPath, { label: "rating.js", schema: RATINGS_SCHEMA });

// A partir de quantos votos o aggregateRating é publicado no JSON-LD (evita
// amostras minúsculas, ex.: "1 avaliação de 5,0", que o Google trata como
// pouco fiáveis). Fonte única do limiar.
const RATING_MIN_PUBLISH = 10;

function hasSqlite() {
  return !!sqliteDb;
}

/** Devolve { average, count } — average arredondado a 1 casa, ou null se count===0. */
function getStats() {
  if (!hasSqlite()) return { average: null, count: 0 };
  const row = sqliteDb.prepare("SELECT COUNT(*) AS count, AVG(value) AS avg FROM votes").get();
  const count = Number(row.count) || 0;
  const average = count > 0 ? Math.round(Number(row.avg) * 10) / 10 : null;
  return { average, count };
}

function insertVote(value) {
  if (!hasSqlite()) return false;
  sqliteDb.prepare("INSERT INTO votes (id, ts, value) VALUES (?, ?, ?)").run(randomUUID(), Date.now(), value);
  return true;
}

function resetVotes() {
  if (!hasSqlite()) return false;
  sqliteDb.prepare("DELETE FROM votes").run();
  return true;
}

/**
 * Para injeção server-side no JSON-LD da homepage.
 * Devolve { ratingValue: "4.7", ratingCount: 123 } ou null se count < RATING_MIN_PUBLISH.
 */
function getAggregateRating() {
  const { average, count } = getStats();
  if (count < RATING_MIN_PUBLISH || average == null) return null;
  return { ratingValue: average.toFixed(1), ratingCount: count };
}

module.exports = async function handler(req, res) {
  const origin = getAllowedOrigin(req.headers.origin || "");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (origin !== "*") res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json(getStats());
  }

  if (req.method === "POST") {
    if (!hasSqlite()) {
      return res.status(503).json({ error: "Base de dados não disponível." });
    }
    if (isRateLimited(getClientIp(req))) {
      return res.status(429).json({ error: "Demasiados votos. Tenta novamente mais tarde." });
    }
    const raw = req.body && req.body.value;
    const value = typeof raw === "number" ? raw : parseInt(raw, 10);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return res.status(400).json({ error: "Valor inválido (1–5)" });
    }
    if (!insertVote(value)) return res.status(500).json({ error: "Erro ao guardar avaliação" });
    return res.status(201).json(getStats());
  }

  if (req.method === "DELETE") {
    const token = req.headers["x-admin-token"] || "";
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || token !== adminToken) {
      return res.status(403).json({ error: "Não autorizado" });
    }
    resetVotes();
    return res.status(200).json({ ok: true, ...getStats() });
  }

  return res.status(405).json({ error: "Método não suportado" });
};

module.exports.getAggregateRating = getAggregateRating;
module.exports.getStats = getStats;
module.exports.RATING_MIN_PUBLISH = RATING_MIN_PUBLISH;
