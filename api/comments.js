const fs = require("fs");
const path = require("path");

// ── Upstash Redis (primary) ───────────────────────────────────────────────
const kvAvailable = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
let kvClient = null;
if (kvAvailable) {
  try {
    const { Redis } = require("@upstash/redis");
    kvClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (_) {}
}

// ── SQLite (fallback when Redis is unavailable) ───────────────────────────
let sqliteDb = null;
let sqliteError = null;
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "comments.sqlite");

if (!kvClient) {
  try {
    const Database = require("better-sqlite3");
    fs.mkdirSync(dbDir, { recursive: true });
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        ts INTEGER NOT NULL,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        bank TEXT,
        simPt REAL,
        realPt REAL
      );
      CREATE INDEX IF NOT EXISTS idx_comments_ts ON comments(ts DESC);
    `);
  } catch (error) {
    sqliteError = error && error.message ? error.message : "SQLite init error";
  }
}

const COMMENTS_KEY = "site:comments:v1";
const MAX_COMMENTS = 100;

function hasSqlite() {
  return !!sqliteDb;
}

async function listComments() {
  if (kvClient) {
    try {
      const list = await kvClient.get(COMMENTS_KEY);
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  if (hasSqlite()) {
    const rows = sqliteDb
      .prepare("SELECT id, ts, name, text, bank, simPt, realPt FROM comments ORDER BY ts DESC LIMIT ?")
      .all(MAX_COMMENTS);
    return rows.map((row) => ({
      ...row,
      simPt: row.simPt === null ? null : Number(row.simPt),
      realPt: row.realPt === null ? null : Number(row.realPt),
    }));
  }

  return [];
}

async function insertComment(comment) {
  if (kvClient) {
    try {
      const existing = await kvClient.get(COMMENTS_KEY);
      const list = Array.isArray(existing) ? existing : [];
      const updated = [comment, ...list].slice(0, MAX_COMMENTS);
      await kvClient.set(COMMENTS_KEY, updated, { ex: 365 * 24 * 3600 });
      return true;
    } catch (_) {
      return false;
    }
  }

  if (hasSqlite()) {
    const insert = sqliteDb.prepare(`
      INSERT INTO comments (id, ts, name, text, bank, simPt, realPt)
      VALUES (@id, @ts, @name, @text, @bank, @simPt, @realPt)
    `);
    const trimOld = sqliteDb.prepare(`
      DELETE FROM comments
      WHERE id NOT IN (
        SELECT id FROM comments ORDER BY ts DESC LIMIT ?
      )
    `);
    const tx = sqliteDb.transaction((payload) => {
      insert.run(payload);
      trimOld.run(MAX_COMMENTS);
    });
    tx(comment);
    return true;
  }

  return false;
}

async function deleteCommentById(id) {
  if (kvClient) {
    try {
      const existing = await kvClient.get(COMMENTS_KEY);
      const list = Array.isArray(existing) ? existing : [];
      const updated = list.filter((c) => c.id !== id);
      await kvClient.set(COMMENTS_KEY, updated, { ex: 365 * 24 * 3600 });
      return true;
    } catch (_) {
      return false;
    }
  }

  if (hasSqlite()) {
    sqliteDb.prepare("DELETE FROM comments WHERE id = ?").run(id);
    return true;
  }

  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    if (req.query && req.query.debug === "1") {
      const secret = process.env.DEBUG_SECRET;
      if (!secret || req.query.secret !== secret) return res.status(403).end();
      let pingErr = null, writeErr = null, readBack = null, currentCount = null;
      if (kvClient) {
        try { await kvClient.ping(); } catch (e) { pingErr = e.message; }
        try {
          await kvClient.set("debug:test", "ok", { ex: 60 });
          readBack = await kvClient.get("debug:test");
        } catch (e) { writeErr = e.message; }
        try {
          const list = await kvClient.get(COMMENTS_KEY);
          currentCount = Array.isArray(list) ? list.length : (list === null ? 0 : typeof list);
        } catch (e) { currentCount = "error: " + e.message; }
      } else if (hasSqlite()) {
        try {
          currentCount = sqliteDb.prepare("SELECT COUNT(*) AS count FROM comments").get().count;
          readBack = "sqlite-ok";
        } catch (e) {
          currentCount = "error: " + e.message;
        }
      }
      return res.status(200).json({
        kvAvailable,
        kvClient: !!kvClient,
        sqlite: hasSqlite(),
        sqlitePath: hasSqlite() ? dbPath : null,
        sqliteError,
        urlSet: !!process.env.UPSTASH_REDIS_REST_URL,
        tokenSet: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        pingErr,
        writeErr,
        readBack,
        currentCount,
      });
    }
    const list = await listComments();
    return res.status(200).json(list);
  }

  if (req.method === "POST") {
    if (!kvClient && !hasSqlite()) {
      return res.status(503).json({
        error: "Base de dados não configurada. Defina Redis (UPSTASH_REDIS_REST_URL/TOKEN) ou instale SQLite fallback.",
        sqliteError,
      });
    }
    const { name, text, bank, simPt, realPt } = req.body || {};
    const t = typeof text === "string" ? text.trim() : "";
    if (t.length < 5 || t.length > 500) {
      return res.status(400).json({ error: "Comentário inválido (5–500 caracteres)" });
    }

    const cleanNum = (v) => {
      const n = parseFloat(String(v).replace(",", "."));
      return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    };

    const comment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      ts: Date.now(),
      name: (typeof name === "string" ? name.trim().slice(0, 50) : "") || "Anónimo",
      text: t.slice(0, 500),
      bank: typeof bank === "string" && bank.trim() ? bank.trim().slice(0, 40) : null,
      simPt: cleanNum(simPt),
      realPt: cleanNum(realPt),
    };

    const saved = await insertComment(comment);
    if (!saved) return res.status(500).json({ error: "Erro ao guardar comentário" });

    return res.status(201).json(comment);
  }

  if (req.method === "DELETE") {
    const token = req.headers["x-admin-token"] || "";
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || token !== adminToken) {
      return res.status(403).json({ error: "Não autorizado" });
    }
    const id = (req.query && req.query.id) || "";
    if (!id) return res.status(400).json({ error: "ID em falta" });
    const saved = await deleteCommentById(id);
    if (!saved) return res.status(500).json({ error: "Erro ao guardar" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
