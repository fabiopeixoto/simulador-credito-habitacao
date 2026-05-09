const fs = require("fs");
const path = require("path");

// ── SQLite ────────────────────────────────────────────────────────────────
let sqliteDb = null;
let sqliteError = null;
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "comments.sqlite");

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

const MAX_COMMENTS = 100;

function hasSqlite() {
  return !!sqliteDb;
}

async function listComments() {
  if (!hasSqlite()) return [];
  const rows = sqliteDb
    .prepare("SELECT id, ts, name, text, bank, simPt, realPt FROM comments ORDER BY ts DESC LIMIT ?")
    .all(MAX_COMMENTS);
  return rows.map((row) => ({
    ...row,
    simPt: row.simPt === null ? null : Number(row.simPt),
    realPt: row.realPt === null ? null : Number(row.realPt),
  }));
}

async function insertComment(comment) {
  if (!hasSqlite()) return false;
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

async function deleteCommentById(id) {
  if (!hasSqlite()) return false;
  sqliteDb.prepare("DELETE FROM comments WHERE id = ?").run(id);
  return true;
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
      let currentCount = null, readBack = null;
      if (hasSqlite()) {
        try {
          currentCount = sqliteDb.prepare("SELECT COUNT(*) AS count FROM comments").get().count;
          readBack = "sqlite-ok";
        } catch (e) {
          currentCount = "error: " + e.message;
        }
      }
      return res.status(200).json({
        sqlite: hasSqlite(),
        sqlitePath: hasSqlite() ? dbPath : null,
        sqliteError,
        readBack,
        currentCount,
      });
    }
    const list = await listComments();
    return res.status(200).json(list);
  }

  if (req.method === "POST") {
    if (!hasSqlite()) {
      return res.status(503).json({
        error: "Base de dados não disponível.",
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
