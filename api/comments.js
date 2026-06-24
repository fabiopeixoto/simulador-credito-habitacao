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

// ── Rate limiting (POST /api/comments) ───────────────────────────────────
const _rlMap = new Map(); // ip → { count, resetAt }
const RL_MAX = 5;
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
  if (!columns.includes("flagged")) {
    db.prepare("ALTER TABLE comments ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0").run();
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
    .prepare("SELECT id, ts, name, text, bank, simPt, realPt, parentId, flagged FROM comments ORDER BY ts DESC LIMIT ?")
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

function flagCommentById(id) {
  if (!hasSqlite()) return false;
  const info = sqliteDb.prepare("UPDATE comments SET flagged = 1 WHERE id = ?").run(id);
  if (info.changes > 0) invalidateTreeCache();
  return info.changes > 0;
}

function unflagCommentById(id) {
  if (!hasSqlite()) return false;
  const info = sqliteDb.prepare("UPDATE comments SET flagged = 0 WHERE id = ?").run(id);
  if (info.changes > 0) invalidateTreeCache();
  return info.changes > 0;
}

module.exports = async function handler(req, res) {
  const origin = getAllowedOrigin(req.headers.origin || "");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (origin !== "*") res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
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
    const clientIp = getClientIp(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({ error: "Demasiados comentários. Tenta novamente mais tarde." });
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

  if (req.method === "PATCH") {
    const id = (req.query && req.query.id) || "";
    if (!id) return res.status(400).json({ error: "ID em falta" });
    const action = (req.body && req.body.action) || "";
    const exists = getCommentById(id);
    if (!exists) return res.status(404).json({ error: "Comentário não encontrado" });
    if (action === "report") {
      flagCommentById(id);
      return res.status(200).json({ ok: true });
    }
    if (action === "unflag") {
      // Acção de admin: remove a marca de reportado ("Manter").
      const token = req.headers["x-admin-token"] || "";
      const adminToken = process.env.ADMIN_TOKEN;
      if (!adminToken || token !== adminToken) {
        return res.status(403).json({ error: "Não autorizado" });
      }
      unflagCommentById(id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Acção inválida" });
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
