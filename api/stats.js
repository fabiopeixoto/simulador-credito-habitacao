const fs = require("fs");
const path = require("path");
const { openSqliteDb } = require(path.join(__dirname, "..", "lib", "open-sqlite.js"));

const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "stats.sqlite");

const STATS_SCHEMA = `
    CREATE TABLE IF NOT EXISTS daily (
      day TEXT PRIMARY KEY,
      homepage INTEGER NOT NULL DEFAULT 0,
      admin INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS visitor_locations (
      city         TEXT NOT NULL,
      country_code TEXT NOT NULL,
      country_name TEXT NOT NULL DEFAULT '',
      count        INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (city, country_code)
    );
  `;

const { db: sqliteDb } = openSqliteDb(dbPath, { label: "stats.js", schema: STATS_SCHEMA });

const _ipCache = new Map();
const _pending = new Map(); // ip → queued visit count while lookup is in flight

function incrementLocation(city, countryCode, countryName, n) {
  if (!sqliteDb || !city || !countryCode) return;
  sqliteDb.prepare(`
    INSERT INTO visitor_locations (city, country_code, country_name, count) VALUES (?, ?, ?, ?)
    ON CONFLICT(city, country_code) DO UPDATE SET count = count + excluded.count, country_name = excluded.country_name
  `).run(city, countryCode, countryName || countryCode, n || 1);
}

function isLoopback(ip) {
  return ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.');
}

async function recordVisitorLocation(ip) {
  if (!sqliteDb || !ip || ip === 'unknown' || isLoopback(ip)) return;
  if (_ipCache.has(ip)) {
    const loc = _ipCache.get(ip);
    if (loc) incrementLocation(loc.city, loc.country_code, loc.country_name);
    return;
  }
  if (_pending.has(ip)) {
    _pending.set(ip, _pending.get(ip) + 1); // queue visit; applied when lookup resolves
    return;
  }
  _pending.set(ip, 1);
  try {
    // Plano gratuito ip-api: apenas HTTP (HTTPS falha sem API paga).
    const r = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country,countryCode`,
      { signal: AbortSignal.timeout(5000) }
    );
    const d = await r.json();
    if (d.status === 'success') {
      const loc = { city: d.city || d.regionName || '?', country_code: d.countryCode, country_name: d.country };
      if (_ipCache.size >= 50000) _ipCache.clear();
      _ipCache.set(ip, loc);
      incrementLocation(loc.city, loc.country_code, loc.country_name, _pending.get(ip));
    } else {
      _ipCache.set(ip, null);
    }
  } catch (e) { console.error("stats.js: recordVisitorLocation ip-api failed:", e.message); }
  finally { _pending.delete(ip); }
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function bumpMeta(key) {
  if (!sqliteDb) return;
  sqliteDb
    .prepare(`
      INSERT INTO meta(key, value) VALUES (?, 1)
      ON CONFLICT(key) DO UPDATE SET value = value + 1
    `)
    .run(key);
}

function recordHomepageView() {
  if (!sqliteDb) return;
  const day = utcToday();
  sqliteDb
    .prepare(`
      INSERT INTO daily(day, homepage, admin) VALUES (?, 1, 0)
      ON CONFLICT(day) DO UPDATE SET homepage = homepage + 1
    `)
    .run(day);
  bumpMeta("homepage_total");
}

function recordAdminPageView() {
  if (!sqliteDb) return;
  const day = utcToday();
  sqliteDb
    .prepare(`
      INSERT INTO daily(day, homepage, admin) VALUES (?, 0, 1)
      ON CONFLICT(day) DO UPDATE SET admin = admin + 1
    `)
    .run(day);
  bumpMeta("admin_total");
}

function metaNum(key) {
  if (!sqliteDb) return 0;
  const row = sqliteDb.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? Number(row.value) || 0 : 0;
}

function countCommentsReadonly() {
  const dbPath = path.join(__dirname, "..", "data", "comments.sqlite");
  if (!fs.existsSync(dbPath)) return null;
  try {
    const Database = require("better-sqlite3");
    const cdb = new Database(dbPath, { readonly: true, fileMustExist: true });
    const n = cdb.prepare("SELECT COUNT(*) AS c FROM comments").get().c;
    cdb.close();
    return Number(n) || 0;
  } catch (_) {
    return null;
  }
}

function lastNDaysUtc(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getSnapshot() {
  const today = utcToday();
  let todayRow = { homepage: 0, admin: 0 };
  let recordedSince = null;
  let last7Days = [];

  if (sqliteDb) {
    const row = sqliteDb.prepare("SELECT homepage, admin FROM daily WHERE day = ?").get(today);
    if (row) todayRow = { homepage: row.homepage || 0, admin: row.admin || 0 };
    const minD = sqliteDb.prepare("SELECT MIN(day) AS m FROM daily").get();
    recordedSince = minD && minD.m ? minD.m : null;

    const keys = lastNDaysUtc(7);
    const map = new Map();
    sqliteDb
      .prepare(`SELECT day, homepage, admin FROM daily WHERE day >= ?`)
      .all(keys[0])
      .forEach((r) => map.set(r.day, { homepage: r.homepage || 0, admin: r.admin || 0 }));
    last7Days = keys.map((day) => ({
      day,
      homepage: map.get(day)?.homepage ?? 0,
      admin: map.get(day)?.admin ?? 0,
    }));
  }

  const locations = sqliteDb
    ? sqliteDb.prepare(`SELECT city, country_code, country_name, count FROM visitor_locations ORDER BY count DESC LIMIT 100`).all()
    : [];

  return {
    homepageTotal: metaNum("homepage_total"),
    adminTotal: metaNum("admin_total"),
    today: { date: today, homepage: todayRow.homepage, admin: todayRow.admin },
    recordedSince,
    last7Days,
    commentsTotal: countCommentsReadonly(),
    locations,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não suportado" });
  }

  const token = req.headers["x-admin-token"] || "";
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ error: "Não autorizado" });
  }

  return res.status(200).json(getSnapshot());
};

module.exports.recordHomepageView = recordHomepageView;
module.exports.recordAdminPageView = recordAdminPageView;
module.exports.recordVisitorLocation = recordVisitorLocation;
