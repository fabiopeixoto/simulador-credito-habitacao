const fs = require("fs");
const path = require("path");

/**
 * Opens better-sqlite3 with WAL, optional initial schema, and optional post-open hook.
 * @param {string} dbPath Absolute or relative path to the .sqlite file
 * @param {{ schema?: string, label?: string, onOpen?: (db: import("better-sqlite3").Database) => void }}=} options
 * @returns {{ db: import("better-sqlite3").Database | null, error: string | null }}
 */
function openSqliteDb(dbPath, options) {
  const { schema = "", label = "sqlite", onOpen } = options || {};
  let db = null;
  let error = null;
  try {
    const Database = require("better-sqlite3");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    if (schema) db.exec(schema);
    if (typeof onOpen === "function") onOpen(db);
  } catch (e) {
    error = e && e.message ? e.message : String(e);
    console.error(`${label}: SQLite init error:`, error);
  }
  return { db, error };
}

module.exports = { openSqliteDb };
