const path = require("path");
const { openSqliteDb } = require(path.join(__dirname, "..", "lib", "open-sqlite.js"));
const { randomUUID } = require("crypto");

// ── SQLite ────────────────────────────────────────────────────────────────
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "comments.sqlite");

const COMMENTS_SCHEMA = `
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      ts INTEGER NOT NULL,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      bank TEXT,
      simPt REAL,
      realPt REAL,
      parentId TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_comments_ts ON comments(ts DESC);
  `;

function migrateComments(db) {
  const columns = db.prepare("PRAGMA table_info(comments)").all().map((column) => column.name);
  if (!columns.includes("parentId")) {
    db.prepare("ALTER TABLE comments ADD COLUMN parentId TEXT").run();
  }
  db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parentId, ts)").run();
}

const { db: sqliteDb, error: sqliteOpenError } = openSqliteDb(dbPath, {
  label: "comments.js",
  schema: COMMENTS_SCHEMA,
  onOpen: migrateComments,
});
const sqliteError = sqliteOpenError;

const MAX_COMMENTS = 100;
const TREE_CACHE_TTL = 30 * 1000;

let _treeCache = null;
let _treeCacheAt = 0;

function invalidateTreeCache() {
  _treeCache = null;
}

function hasSqlite() {
  return !!sqliteDb;
}

async function listComments() {
  if (_treeCache && Date.now() - _treeCacheAt < TREE_CACHE_TTL) return _treeCache;
  if (!hasSqlite()) return [];
  const rows = sqliteDb
    .prepare("SELECT id, ts, name, text, bank, simPt, realPt, parentId FROM comments ORDER BY ts DESC LIMIT ?")
    .all(MAX_COMMENTS);
  const comments = rows.map((row) => ({
    ...row,
    parentId: row.parentId || null,
    replies: [],
    simPt: row.simPt === null ? null : Number(row.simPt),
    realPt: row.realPt === null ? null : Number(row.realPt),
  }));
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const roots = [];
  comments.forEach((comment) => {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId).replies.push(comment);
    } else if (!comment.parentId) {
      roots.push(comment);
    }
  });
  roots.sort((a, b) => b.ts - a.ts);
  roots.forEach((comment) => comment.replies.sort((a, b) => a.ts - b.ts));
  _treeCache = roots;
  _treeCacheAt = Date.now();
  return roots;
}

async function insertComment(comment) {
  if (!hasSqlite()) return false;
  const insert = sqliteDb.prepare(`
    INSERT INTO comments (id, ts, name, text, bank, simPt, realPt, parentId)
    VALUES (@id, @ts, @name, @text, @bank, @simPt, @realPt, @parentId)
  `);
  const trimOld = sqliteDb.prepare(`
    DELETE FROM comments
    WHERE id NOT IN (
      SELECT id FROM comments ORDER BY ts DESC LIMIT ?
    )
  `);
  const trimOrphanReplies = sqliteDb.prepare(`
    DELETE FROM comments
    WHERE parentId IS NOT NULL
      AND parentId NOT IN (SELECT id FROM comments)
  `);
  const tx = sqliteDb.transaction((payload) => {
    insert.run(payload);
    trimOld.run(MAX_COMMENTS);
    trimOrphanReplies.run();
  });
  tx(comment);
  invalidateTreeCache();
  return true;
}

async function deleteCommentById(id) {
  if (!hasSqlite()) return false;
  sqliteDb.prepare("DELETE FROM comments WHERE id = ? OR parentId = ?").run(id, id);
  invalidateTreeCache();
  return true;
}

function getCommentById(id) {
  if (!hasSqlite()) return null;
  return sqliteDb.prepare("SELECT id, parentId FROM comments WHERE id = ?").get(id) || null;
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
    const { name, text, bank, simPt, realPt, parentId } = req.body || {};
    const t = typeof text === "string" ? text.trim() : "";
    if (t.length < 5 || t.length > 500) {
      return res.status(400).json({ error: "Comentário inválido (5–500 caracteres)" });
    }
    const cleanParentId = typeof parentId === "string" && parentId.trim() ? parentId.trim() : null;
    if (cleanParentId) {
      const parent = getCommentById(cleanParentId);
      if (!parent) return res.status(404).json({ error: "Comentário original não encontrado" });
      if (parent.parentId) return res.status(400).json({ error: "Só é possível responder a comentários principais" });
    }

    const cleanNum = (v) => {
      const n = parseFloat(String(v).replace(",", "."));
      return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    };

    const comment = {
      id: randomUUID(),
      ts: Date.now(),
      name: (typeof name === "string" ? name.trim().slice(0, 50) : "") || "Anónimo",
      text: t.slice(0, 500),
      bank: cleanParentId ? null : (typeof bank === "string" && bank.trim() ? bank.trim().slice(0, 40) : null),
      simPt: cleanParentId ? null : cleanNum(simPt),
      realPt: cleanParentId ? null : cleanNum(realPt),
      parentId: cleanParentId,
    };

    const saved = await insertComment(comment);
    if (!saved) return res.status(500).json({ error: "Erro ao guardar comentário" });

    return res.status(201).json({ ...comment, replies: [] });
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
