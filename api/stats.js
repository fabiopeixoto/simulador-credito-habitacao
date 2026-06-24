const fs = require("fs");
const path = require("path");
const geoip = require("geoip-lite");
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
    CREATE TABLE IF NOT EXISTS stats_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `;

const { db: sqliteDb } = openSqliteDb(dbPath, { label: "stats.js", schema: STATS_SCHEMA });

const _ipCache = new Map();
const _pending = new Map(); // ip → queued visit count while lookup is in flight
let _excludedIps = null; // cached set, rebuilt from DB on first use or invalidation

function _loadExcludedIps() {
  if (!sqliteDb) return new Set();
  const row = sqliteDb.prepare("SELECT value FROM stats_config WHERE key = 'excluded_ips'").get();
  try { _excludedIps = new Set(JSON.parse(row ? row.value : '[]') || []); } catch(_) { _excludedIps = new Set(); }
  return _excludedIps;
}

function getExcludedIps() {
  return _excludedIps !== null ? _excludedIps : _loadExcludedIps();
}

function _saveExcludedIps(set) {
  if (!sqliteDb) return;
  sqliteDb.prepare(`
    INSERT INTO stats_config(key, value) VALUES ('excluded_ips', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(JSON.stringify([...set]));
  _excludedIps = set;
}

function addExcludedIp(ip) {
  if (!ip || isLoopback(ip)) return;
  const s = new Set(getExcludedIps());
  s.add(ip);
  _saveExcludedIps(s);
  _ipCache.delete(ip);
}

function removeExcludedIp(ip) {
  const s = new Set(getExcludedIps());
  s.delete(ip);
  _saveExcludedIps(s);
}

function clearExcludedIps() {
  _saveExcludedIps(new Set());
}

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

function recordVisitorLocation(ip) {
  if (!sqliteDb || !ip || ip === 'unknown' || isLoopback(ip)) return;
  if (getExcludedIps().has(ip)) return;
  if (_ipCache.has(ip)) {
    const loc = _ipCache.get(ip);
    if (loc) incrementLocation(loc.city, loc.country_code, loc.country_name);
    return;
  }
  const geo = geoip.lookup(ip);
  if (geo && geo.country) {
    const loc = { city: geo.city || geo.region || '—', country_code: geo.country, country_name: geo.country };
    if (_ipCache.size >= 50000) _ipCache.clear();
    _ipCache.set(ip, loc);
    incrementLocation(loc.city, loc.country_code, loc.country_name);
  } else {
    _ipCache.set(ip, null);
  }
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

function recordHomepageView(ip) {
  if (!sqliteDb) return;
  if (ip && !isLoopback(ip) && getExcludedIps().has(ip)) return;
  const day = utcToday();
  sqliteDb
    .prepare(`
      INSERT INTO daily(day, homepage, admin) VALUES (?, 1, 0)
      ON CONFLICT(day) DO UPDATE SET homepage = homepage + 1
    `)
    .run(day);
  bumpMeta("homepage_total");
}

function recordAdminPageView(ip) {
  if (!sqliteDb) return;
  if (ip && !isLoopback(ip) && getExcludedIps().has(ip)) return;
  const day = utcToday();
  sqliteDb
    .prepare(`
      INSERT INTO daily(day, homepage, admin) VALUES (?, 0, 1)
      ON CONFLICT(day) DO UPDATE SET admin = admin + 1
    `)
    .run(day);
  bumpMeta("admin_total");
}

function resetStats() {
  if (!sqliteDb) return;
  sqliteDb.prepare('DELETE FROM daily').run();
  sqliteDb.prepare('DELETE FROM meta').run();
  sqliteDb.prepare('DELETE FROM visitor_locations').run();
  _ipCache.clear();
  _pending.clear();
  const now = new Date().toISOString();
  sqliteDb.prepare(`
    INSERT INTO stats_config(key, value) VALUES ('reset_at', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(now);
  return now;
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

  const resetAtRow = sqliteDb
    ? sqliteDb.prepare("SELECT value FROM stats_config WHERE key = 'reset_at'").get()
    : null;
  const resetAt = resetAtRow ? resetAtRow.value : null;

  return {
    homepageTotal: metaNum("homepage_total"),
    adminTotal: metaNum("admin_total"),
    today: { date: today, homepage: todayRow.homepage, admin: todayRow.admin },
    recordedSince,
    resetAt,
    last7Days,
    commentsTotal: countCommentsReadonly(),
    locations,
    excludedIps: [...getExcludedIps()],
    generatedAt: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!["GET", "PUT", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Método não suportado" });
  }

  const token = req.headers["x-admin-token"] || "";
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ error: "Não autorizado" });
  }

  if (req.method === "DELETE") {
    const resetAt = resetStats();
    return res.status(200).json({ ok: true, resetAt });
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    if (body.action === "exclude") {
      const fwdFor = req.headers["x-forwarded-for"] || "";
      const realIp = req.headers["x-real-ip"] || "";
      const ip = fwdFor.split(",")[0]?.trim() || realIp || req.socket?.remoteAddress || "";
      if (!ip) return res.status(400).json({ error: "IP não detectado" });
      addExcludedIp(ip);
      return res.status(200).json({ ok: true, ip });
    }
    if (body.action === "exclude_manual") {
      const ip = String(body.ip || "").trim();
      if (!ip) return res.status(400).json({ error: "IP em falta" });
      addExcludedIp(ip);
      return res.status(200).json({ ok: true, ip });
    }
    if (body.action === "remove_excluded") {
      const ip = String(body.ip || "").trim();
      if (!ip) return res.status(400).json({ error: "IP em falta" });
      removeExcludedIp(ip);
      return res.status(200).json({ ok: true, ip });
    }
    if (body.action === "clear_excluded") {
      clearExcludedIps();
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Acção desconhecida" });
  }

  return res.status(200).json(getSnapshot());
};

module.exports.recordHomepageView = recordHomepageView;
module.exports.recordAdminPageView = recordAdminPageView;
module.exports.recordVisitorLocation = recordVisitorLocation;
module.exports.resetStats = resetStats;
