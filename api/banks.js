const fs = require("fs");
const path = require("path");

// ── SQLite ────────────────────────────────────────────────────────────────
let sqliteDb = null;
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "banks.sqlite");

try {
  const Database = require("better-sqlite3");
  fs.mkdirSync(dbDir, { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma("journal_mode = WAL");

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS banks (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#666666',
      refs TEXT NOT NULL DEFAULT '["12m"]',
      jOk INTEGER NOT NULL DEFAULT 1,
      carenciaMax INTEGER NOT NULL DEFAULT 0,
      tipos TEXT NOT NULL DEFAULT '["variável"]',
      promos TEXT NOT NULL DEFAULT '[]',
      prod TEXT NOT NULL DEFAULT '',
      jProd TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS spreads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_code TEXT NOT NULL REFERENCES banks(code),
      sCom REAL, sSem REAL,
      mCom REAL, mSem REAL,
      fCom REAL, fSem REAL,
      jsCom REAL, jsSem REAL,
      promoPeriodo INTEGER DEFAULT 0,
      promoSpread REAL,
      dossier REAL DEFAULT 0,
      avaliacao REAL DEFAULT 0,
      contaMes REAL DEFAULT 0,
      contaNota TEXT DEFAULT '',
      capMin REAL DEFAULT 0,
      capMax REAL DEFAULT 0,
      vRef REAL DEFAULT 0,
      mAno REAL DEFAULT 0,
      insV TEXT DEFAULT '',
      insM TEXT DEFAULT '',
      minutas REAL DEFAULT 0,
      jovemIsenta INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      fetched_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_spreads_bank ON spreads(bank_code, fetched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_spreads_fetched ON spreads(fetched_at DESC);
  `);
} catch (e) {
  console.error("banks.js: SQLite init error:", e.message);
}

// ── Seed data ─────────────────────────────────────────────────────────────
const SEED_BANKS = [
  { code: "CA", name: "Crédito Agrícola", color: "#2d6a2d", refs: ["12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0,45% 2a→0,75%", "2 indexantes"], prod: "Dom. ordenado + Seg. Vida CA + Multirriscos CA", jProd: "0,45% 1.º bienio; isenção comissões" },
  { code: "CTT", name: "Banco CTT", color: "#e30613", refs: ["12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["Só 3 produtos — o mais simples"], prod: "Seg. Vida + Multirriscos + Dom. CTT", jProd: "TAN fixa 2,70% 2a; 1.ª anuidade seguros oferta" },
  { code: "BNKTR", name: "Bankinter", color: "#f7941d", refs: ["12m"], jOk: true, carenciaMax: 12, tipos: ["variável", "mista", "fixa"], promos: ["TAN fixa 2,25% 2 anos → spread 0,65%", "Aceita seguros externos"], prod: "Seg. Vida + Multirriscos + Dom. ordenado", jProd: "TAN fixa 2,25% 2 anos; 100% garantia Estado" },
  { code: "ABANCA", name: "Abanca", color: "#00529b", refs: ["12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["Taxa fixa 2,70% 1.º/2.º ano"], prod: "Dom. ≥1.000€ + Seg. Vida + Multi + Cartão", jProd: "TAN fixa 2,70% 1.º ano → spread 0,70%" },
  { code: "BCP", name: "Millennium BCP", color: "#c8102e", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0% primeiros 2 anos", "Isenção comissões ≤35a", "3 indexantes"], prod: "Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas", jProd: "Spread 0% 2 anos; isenção comissões ≤35a" },
  { code: "ACTVO", name: "ActivoBank", color: "#6d1e8a", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["Spread 0% primeiros 2 anos", "3 indexantes"], prod: "Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas", jProd: "Spread 0% 2 anos; 100% garantia Estado" },
  { code: "BPI", name: "Banco BPI", color: "#005ca9", refs: ["6m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Aceita seguradora externa"], prod: "Seg. Vida BPI + Multirriscos BPI (ou externa sem bonif.)", jProd: "100% financiamento c/ garantia Estado" },
  { code: "MNTPO", name: "Banco Montepio", color: "#7a0f2e", refs: ["6m"], jOk: true, carenciaMax: 24, tipos: ["variável", "mista"], promos: ["Cashback 1,5%"], prod: "Conta Ordenado + Cartão ≥500€/sem + Seg. Vida + Multirriscos Lusitania", jProd: "100% garantia Estado; cashback 1,5%" },
  { code: "SANTR", name: "Santander", color: "#ec0000", refs: ["6m"], jOk: true, carenciaMax: 12, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0% 3 anos (c/prod.) → 0,80%"], prod: "Cartão créd.≥300€ + Seg. Vida + Multirriscos Santander", jProd: "Spread 0% 3 anos c/prod.; 100% garantia Estado" },
  { code: "NB", name: "Novo Banco", color: "#00a651", refs: ["12m"], jOk: true, carenciaMax: 24, tipos: ["variável", "mista", "fixa"], promos: ["Cashback 1%", "Mudum — multirriscos mais barato"], prod: "Pack 1.º Banco (dom.) + GamaLife + Mudum", jProd: "100% financiamento; cashback 1%" },
  { code: "CGD", name: "CGD", color: "#006633", refs: ["6m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Banco público", "TAN fixa 2 anos → Eur.6M+0,65%", "Jovem: spread 0,65%", "Cert. A/B: -0,15%"], prod: "Pack Vinculação + Pack Ligação (Fidelidade Vida + Multi)", jProd: "Spread 0,65% TAEG 3,26% — MELHOR JOVEM" },
  { code: "UCI", name: "UCI", color: "#1a3a6b", refs: ["6m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["Especialista habitação", "Sem dom. obrigatória"], prod: "Seg. Vida + Multirriscos", jProd: "100% c/ garantia Estado" },
  { code: "BIC", name: "Banco BIC", color: "#e67e00", refs: ["12m"], jOk: true, carenciaMax: 0, tipos: ["variável"], promos: [], prod: "Domiciliação + Seguros", jProd: "Garantia Estado (Despacho 14916/2024)" },
  { code: "BNI", name: "BNI Europa", color: "#4a235a", refs: ["12m"], jOk: false, carenciaMax: 0, tipos: ["variável"], promos: [], prod: "Domiciliação + Seguros", jProd: "" },
];

const SEED_SPREADS = {
  CA: { sCom: 0.75, sSem: 1.65, mCom: 2.90, mSem: 3.80, fCom: 3.00, fSem: 3.80, jsCom: 0.75, jsSem: 1.65, promoPeriodo: 24, promoSpread: 0.45, dossier: 250, avaliacao: 200, contaMes: 3.50, contaNota: "Conta CA (estimativa)", capMin: 25000, capMax: 2000000, vRef: 22.68, mAno: 160, insV: "CA Seguros", insM: "CA Seguros", minutas: 0, jovemIsenta: true },
  CTT: { sCom: 0.85, sSem: 1.70, mCom: 3.40, mSem: 3.40, fCom: 3.95, fSem: 4.55, jsCom: 0.85, jsSem: 1.70, promoPeriodo: 0, promoSpread: null, dossier: 0, avaliacao: 200, contaMes: 0, contaNota: "Sem comissão de conta obrigatória", capMin: 25000, capMax: 1000000, vRef: 15.71, mAno: 170, insV: "CTT Seguros", insM: "CTT Seguros", minutas: 0, jovemIsenta: true },
  BNKTR: { sCom: 0.65, sSem: 1.00, mCom: 2.90, mSem: 3.25, fCom: 3.45, fSem: 3.80, jsCom: 0.65, jsSem: 1.00, promoPeriodo: 24, promoSpread: null, dossier: 350, avaliacao: 250, contaMes: 0, contaNota: "Sem comissão de conta obrigatória", capMin: 100000, capMax: 3000000, vRef: 33.28, mAno: 196, insV: "Bankinter Seguros", insM: "Bankinter Seguros", minutas: 0, jovemIsenta: false },
  ABANCA: { sCom: 0.70, sSem: 1.70, mCom: 2.70, mSem: 3.70, fCom: 4.30, fSem: 4.70, jsCom: 0.70, jsSem: 1.70, promoPeriodo: 0, promoSpread: null, dossier: 300, avaliacao: 230, contaMes: 6.24, contaNota: "Conta corrente Abanca (confirmado preçário)", capMin: 30000, capMax: 2000000, vRef: 16.76, mAno: 154, insV: "Abanca Seguros", insM: "Abanca Seguros", minutas: 0, jovemIsenta: true },
  BCP: { sCom: 0.65, sSem: 1.25, mCom: 4.10, mSem: 4.65, fCom: 4.65, fSem: 5.20, jsCom: 0.65, jsSem: 1.25, promoPeriodo: 24, promoSpread: 0, dossier: 300, avaliacao: 250, contaMes: 5.00, contaNota: "Conta Millennium (estimativa)", capMin: 20000, capMax: 3000000, vRef: 19.92, mAno: 256, insV: "Ocidental Vida", insM: "Ageas/Ocidental", minutas: 0, jovemIsenta: true },
  ACTVO: { sCom: 0.80, sSem: 1.50, mCom: 3.50, mSem: 4.25, fCom: 4.05, fSem: 5.05, jsCom: 0.80, jsSem: 1.50, promoPeriodo: 24, promoSpread: 0, dossier: 300, avaliacao: 250, contaMes: 0, contaNota: "Banco digital — sem comissão", capMin: 20000, capMax: 3000000, vRef: 19.84, mAno: 256, insV: "Ocidental Vida", insM: "Ageas/Ocidental", minutas: 0, jovemIsenta: true },
  BPI: { sCom: 0.85, sSem: 1.60, mCom: 3.10, mSem: 3.85, fCom: 4.05, fSem: 4.60, jsCom: 0.85, jsSem: 1.60, promoPeriodo: 0, promoSpread: null, dossier: 290, avaliacao: 230, contaMes: 4.90, contaNota: "Conta BPI (estimativa)", capMin: 25000, capMax: 3000000, vRef: 13.12, mAno: 195, insV: "BPI Vida", insM: "BPI Seguros", minutas: 190, jovemIsenta: true },
  MNTPO: { sCom: 0.70, sSem: 1.50, mCom: 3.70, mSem: 4.50, fCom: 4.20, fSem: 4.80, jsCom: 0.70, jsSem: 1.50, promoPeriodo: 0, promoSpread: null, dossier: 250, avaliacao: 200, contaMes: 5.41, contaNota: "Conta Ordenado Montepio (confirmado preçário mar.2026)", capMin: 20000, capMax: 2000000, vRef: 8.29, mAno: 79, insV: "Lusitania Vida", insM: "Lusitania", minutas: 0, jovemIsenta: false },
  SANTR: { sCom: 0.80, sSem: 1.90, mCom: 2.85, mSem: 4.75, fCom: 4.40, fSem: 5.60, jsCom: 0.80, jsSem: 1.90, promoPeriodo: 36, promoSpread: 0, dossier: 280, avaliacao: 250, contaMes: 2.90, contaNota: "Conta Santander (confirmado preçário jan.2026)", capMin: 30000, capMax: 3000000, vRef: 22.55, mAno: 246, insV: "Santander Seguros", insM: "Santander Seguros", minutas: 0, jovemIsenta: false },
  NB: { sCom: 0.90, sSem: 1.60, mCom: 3.80, mSem: 4.50, fCom: 5.17, fSem: 5.77, jsCom: 0.80, jsSem: 1.50, promoPeriodo: 0, promoSpread: null, dossier: 333, avaliacao: 332, contaMes: 8.22, contaNota: "Conta Pacote NB €8,22/mês IS incluído (preçário fev.2026)", capMin: 50000, capMax: 3000000, vRef: 17.55, mAno: 98, insV: "GamaLife", insM: "Mudum", minutas: 0, jovemIsenta: true },
  CGD: { sCom: 0.65, sSem: 1.35, mCom: 3.85, mSem: 4.55, fCom: 4.70, fSem: 5.40, jsCom: 0.65, jsSem: 1.35, promoPeriodo: 24, promoSpread: null, dossier: 250, avaliacao: 200, contaMes: 6.30, contaNota: "Conta Caixadirecta €6,30/mês IS incluído (confirmado preçário 2026)", capMin: 25000, capMax: 3000000, vRef: 29.82, mAno: 110, insV: "Fidelidade", insM: "Fidelidade Casa", minutas: 0, jovemIsenta: true },
  UCI: { sCom: 1.64, sSem: 2.14, mCom: 4.35, mSem: 4.85, fCom: 4.85, fSem: 5.35, jsCom: 1.64, jsSem: 2.14, promoPeriodo: 0, promoSpread: null, dossier: 300, avaliacao: 230, contaMes: 0, contaNota: "Sem conta obrigatória", capMin: 30000, capMax: 2000000, vRef: 19.00, mAno: 150, insV: "(est.)", insM: "(est.)", minutas: 0, jovemIsenta: false },
  BIC: { sCom: 1.00, sSem: 1.50, mCom: 3.00, mSem: 3.50, fCom: 3.60, fSem: 4.10, jsCom: 1.00, jsSem: 1.50, promoPeriodo: 0, promoSpread: null, dossier: 400, avaliacao: 250, contaMes: 3.00, contaNota: "(estimativa)", capMin: 25000, capMax: 1000000, vRef: 19.00, mAno: 150, insV: "(est.)", insM: "(est.)", minutas: 0, jovemIsenta: false },
  BNI: { sCom: 1.00, sSem: 1.50, mCom: 3.10, mSem: 3.60, fCom: 3.70, fSem: 4.20, jsCom: 1.00, jsSem: 1.50, promoPeriodo: 0, promoSpread: null, dossier: 400, avaliacao: 250, contaMes: 3.00, contaNota: "(estimativa)", capMin: 25000, capMax: 1000000, vRef: 19.00, mAno: 150, insV: "(est.)", insM: "(est.)", minutas: 0, jovemIsenta: false },
};

function seedIfEmpty() {
  if (!sqliteDb) return;
  const count = sqliteDb.prepare("SELECT COUNT(*) AS c FROM banks").get().c;
  if (count > 0) return;

  const insertBank = sqliteDb.prepare(`
    INSERT OR IGNORE INTO banks (code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, sort_order)
    VALUES (@code, @name, @color, @refs, @jOk, @carenciaMax, @tipos, @promos, @prod, @jProd, @sort_order)
  `);

  const insertSpread = sqliteDb.prepare(`
    INSERT INTO spreads (bank_code, sCom, sSem, mCom, mSem, fCom, fSem, jsCom, jsSem,
      promoPeriodo, promoSpread, dossier, avaliacao, contaMes, contaNota,
      capMin, capMax, vRef, mAno, insV, insM, minutas, jovemIsenta, source)
    VALUES (@bank_code, @sCom, @sSem, @mCom, @mSem, @fCom, @fSem, @jsCom, @jsSem,
      @promoPeriodo, @promoSpread, @dossier, @avaliacao, @contaMes, @contaNota,
      @capMin, @capMax, @vRef, @mAno, @insV, @insM, @minutas, @jovemIsenta, @source)
  `);

  const tx = sqliteDb.transaction(() => {
    SEED_BANKS.forEach((bank, i) => {
      insertBank.run({
        code: bank.code,
        name: bank.name,
        color: bank.color,
        refs: JSON.stringify(bank.refs),
        jOk: bank.jOk ? 1 : 0,
        carenciaMax: bank.carenciaMax,
        tipos: JSON.stringify(bank.tipos),
        promos: JSON.stringify(bank.promos),
        prod: bank.prod,
        jProd: bank.jProd,
        sort_order: i,
      });

      const sd = SEED_SPREADS[bank.code];
      if (sd) {
        insertSpread.run({
          bank_code: bank.code,
          sCom: sd.sCom,
          sSem: sd.sSem,
          mCom: sd.mCom,
          mSem: sd.mSem,
          fCom: sd.fCom,
          fSem: sd.fSem,
          jsCom: sd.jsCom,
          jsSem: sd.jsSem,
          promoPeriodo: sd.promoPeriodo || 0,
          promoSpread: sd.promoSpread,
          dossier: sd.dossier || 0,
          avaliacao: sd.avaliacao || 0,
          contaMes: sd.contaMes || 0,
          contaNota: sd.contaNota || "",
          capMin: sd.capMin || 0,
          capMax: sd.capMax || 0,
          vRef: sd.vRef || 0,
          mAno: sd.mAno || 0,
          insV: sd.insV || "",
          insM: sd.insM || "",
          minutas: sd.minutas || 0,
          jovemIsenta: sd.jovemIsenta ? 1 : 0,
          source: "seed",
        });
      }
    });
  });
  tx();
}

seedIfEmpty();

// ── Queries ───────────────────────────────────────────────────────────────

function getAllBanks() {
  if (!sqliteDb) return [];
  return sqliteDb.prepare(`
    SELECT code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, active, sort_order, updated_at
    FROM banks WHERE active = 1 ORDER BY sort_order
  `).all().map(row => ({
    ...row,
    refs: JSON.parse(row.refs),
    tipos: JSON.parse(row.tipos),
    promos: JSON.parse(row.promos),
    jOk: !!row.jOk,
    active: !!row.active,
  }));
}

function getLatestSpreads() {
  if (!sqliteDb) return {};
  const rows = sqliteDb.prepare(`
    SELECT s.* FROM spreads s
    INNER JOIN (
      SELECT bank_code, MAX(fetched_at) AS max_fetched
      FROM spreads GROUP BY bank_code
    ) latest ON s.bank_code = latest.bank_code AND s.fetched_at = latest.max_fetched
  `).all();

  const result = {};
  for (const row of rows) {
    result[row.bank_code] = {
      sCom: row.sCom, sSem: row.sSem,
      mCom: row.mCom, mSem: row.mSem,
      fCom: row.fCom, fSem: row.fSem,
      jsCom: row.jsCom, jsSem: row.jsSem,
      promoPeriodo: row.promoPeriodo,
      promoSpread: row.promoSpread,
      dossier: row.dossier,
      avaliacao: row.avaliacao,
      contaMes: row.contaMes,
      contaNota: row.contaNota,
      capMin: row.capMin,
      capMax: row.capMax,
      vRef: row.vRef,
      mAno: row.mAno,
      insV: row.insV,
      insM: row.insM,
      minutas: row.minutas,
      jovemIsenta: !!row.jovemIsenta,
      source: row.source,
      fetchedAt: row.fetched_at,
    };
  }
  return result;
}

function getSpreadsHistory(bankCode, limit = 10) {
  if (!sqliteDb) return [];
  return sqliteDb.prepare(`
    SELECT * FROM spreads WHERE bank_code = ? ORDER BY fetched_at DESC LIMIT ?
  `).all(bankCode, limit).map(row => ({
    ...row,
    jovemIsenta: !!row.jovemIsenta,
  }));
}

function upsertBank(bankData) {
  if (!sqliteDb) return false;
  const stmt = sqliteDb.prepare(`
    INSERT INTO banks (code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, active, sort_order, updated_at)
    VALUES (@code, @name, @color, @refs, @jOk, @carenciaMax, @tipos, @promos, @prod, @jProd, @active, @sort_order, @updated_at)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, color = excluded.color, refs = excluded.refs,
      jOk = excluded.jOk, carenciaMax = excluded.carenciaMax, tipos = excluded.tipos,
      promos = excluded.promos, prod = excluded.prod, jProd = excluded.jProd,
      active = excluded.active, sort_order = excluded.sort_order, updated_at = excluded.updated_at
  `);
  stmt.run({
    code: bankData.code,
    name: bankData.name,
    color: bankData.color || "#666666",
    refs: JSON.stringify(bankData.refs || ["12m"]),
    jOk: bankData.jOk ? 1 : 0,
    carenciaMax: bankData.carenciaMax || 0,
    tipos: JSON.stringify(bankData.tipos || ["variável"]),
    promos: JSON.stringify(bankData.promos || []),
    prod: bankData.prod || "",
    jProd: bankData.jProd || "",
    active: bankData.active !== false ? 1 : 0,
    sort_order: bankData.sort_order || 0,
    updated_at: Date.now(),
  });
  return true;
}

function insertSpreads(bankCode, spreadsData, source = "manual") {
  if (!sqliteDb) return false;
  const stmt = sqliteDb.prepare(`
    INSERT INTO spreads (bank_code, sCom, sSem, mCom, mSem, fCom, fSem, jsCom, jsSem,
      promoPeriodo, promoSpread, dossier, avaliacao, contaMes, contaNota,
      capMin, capMax, vRef, mAno, insV, insM, minutas, jovemIsenta, source)
    VALUES (@bank_code, @sCom, @sSem, @mCom, @mSem, @fCom, @fSem, @jsCom, @jsSem,
      @promoPeriodo, @promoSpread, @dossier, @avaliacao, @contaMes, @contaNota,
      @capMin, @capMax, @vRef, @mAno, @insV, @insM, @minutas, @jovemIsenta, @source)
  `);
  stmt.run({
    bank_code: bankCode,
    sCom: spreadsData.sCom ?? null,
    sSem: spreadsData.sSem ?? null,
    mCom: spreadsData.mCom ?? null,
    mSem: spreadsData.mSem ?? null,
    fCom: spreadsData.fCom ?? null,
    fSem: spreadsData.fSem ?? null,
    jsCom: spreadsData.jsCom ?? null,
    jsSem: spreadsData.jsSem ?? null,
    promoPeriodo: spreadsData.promoPeriodo || 0,
    promoSpread: spreadsData.promoSpread ?? null,
    dossier: spreadsData.dossier || 0,
    avaliacao: spreadsData.avaliacao || 0,
    contaMes: spreadsData.contaMes || 0,
    contaNota: spreadsData.contaNota || "",
    capMin: spreadsData.capMin || 0,
    capMax: spreadsData.capMax || 0,
    vRef: spreadsData.vRef || 0,
    mAno: spreadsData.mAno || 0,
    insV: spreadsData.insV || "",
    insM: spreadsData.insM || "",
    minutas: spreadsData.minutas || 0,
    jovemIsenta: spreadsData.jovemIsenta ? 1 : 0,
    source,
  });
  return true;
}

function bulkInsertSpreads(spreadsMap, source = "anthropic") {
  if (!sqliteDb) return false;
  const stmt = sqliteDb.prepare(`
    INSERT INTO spreads (bank_code, sCom, sSem, mCom, mSem, fCom, fSem, jsCom, jsSem,
      promoPeriodo, promoSpread, dossier, avaliacao, contaMes, contaNota,
      capMin, capMax, vRef, mAno, insV, insM, minutas, jovemIsenta, source)
    VALUES (@bank_code, @sCom, @sSem, @mCom, @mSem, @fCom, @fSem, @jsCom, @jsSem,
      @promoPeriodo, @promoSpread, @dossier, @avaliacao, @contaMes, @contaNota,
      @capMin, @capMax, @vRef, @mAno, @insV, @insM, @minutas, @jovemIsenta, @source)
  `);
  const tx = sqliteDb.transaction((map) => {
    for (const [code, data] of Object.entries(map)) {
      stmt.run({
        bank_code: code,
        sCom: data.sCom ?? null,
        sSem: data.sSem ?? null,
        mCom: data.mCom ?? null,
        mSem: data.mSem ?? null,
        fCom: data.fCom ?? null,
        fSem: data.fSem ?? null,
        jsCom: data.jsCom ?? null,
        jsSem: data.jsSem ?? null,
        promoPeriodo: data.promoPeriodo || 0,
        promoSpread: data.promoSpread ?? null,
        dossier: data.dossier || 0,
        avaliacao: data.avaliacao || 0,
        contaMes: data.contaMes || 0,
        contaNota: data.contaNota || "",
        capMin: data.capMin || 0,
        capMax: data.capMax || 0,
        vRef: data.vRef || 0,
        mAno: data.mAno || 0,
        insV: data.insV || "",
        insM: data.insM || "",
        minutas: data.minutas || 0,
        jovemIsenta: data.jovemIsenta ? 1 : 0,
        source,
      });
    }
  });
  tx(spreadsMap);
  return true;
}

function deleteBank(code) {
  if (!sqliteDb) return false;
  sqliteDb.prepare("UPDATE banks SET active = 0, updated_at = ? WHERE code = ?").run(Date.now(), code);
  return true;
}

// ── HTTP Handler ──────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!sqliteDb) {
    return res.status(503).json({ error: "Base de dados não disponível" });
  }

  // GET /api/banks — lista todos os bancos com spreads mais recentes
  if (req.method === "GET") {
    const banks = getAllBanks();
    const spreads = getLatestSpreads();

    // ?history=CODE — devolve histórico de um banco
    if (req.query && req.query.history) {
      const history = getSpreadsHistory(req.query.history, parseInt(req.query.limit) || 10);
      return res.status(200).json({ history });
    }

    const result = banks.map(bank => ({
      ...bank,
      spreads: spreads[bank.code] || null,
    }));

    return res.status(200).json(result);
  }

  // POST/PUT/DELETE require admin token
  const token = req.headers["x-admin-token"] || "";
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ error: "Não autorizado" });
  }

  // POST /api/banks — criar/actualizar banco
  if (req.method === "POST") {
    const { bank, spreads: spreadsData } = req.body || {};

    if (bank) {
      if (!bank.code || !bank.name) {
        return res.status(400).json({ error: "code e name são obrigatórios" });
      }
      if (!/^[A-Z0-9_]{2,10}$/.test(bank.code)) {
        return res.status(400).json({ error: "code deve ter 2-10 caracteres maiúsculos/números" });
      }
      upsertBank(bank);
    }

    if (spreadsData && typeof spreadsData === "object") {
      if (spreadsData.bank_code) {
        insertSpreads(spreadsData.bank_code, spreadsData, spreadsData.source || "manual");
      } else {
        bulkInsertSpreads(spreadsData, "manual");
      }
    }

    return res.status(200).json({ ok: true });
  }

  // DELETE /api/banks?code=XX — desactivar banco
  if (req.method === "DELETE") {
    const code = (req.query && req.query.code) || "";
    if (!code) return res.status(400).json({ error: "code em falta" });
    deleteBank(code);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Método não suportado" });
};

// Export functions for use by spreads.js
module.exports.bulkInsertSpreads = bulkInsertSpreads;
module.exports.getLatestSpreads = getLatestSpreads;
module.exports.getAllBanks = getAllBanks;
