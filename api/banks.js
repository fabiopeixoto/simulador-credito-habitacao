const fs = require("fs");
const path = require("path");
const { fetchEuribor: fetchEuriborFromBce } = require("./euribor.js");

// ── SQLite ────────────────────────────────────────────────────────────────
let sqliteDb = null;
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "banks.sqlite");

/** Códigos retirados do produto (podem persistir em bases antigas) — não expor na API. */
const DROPPED_BANK_CODES = new Set(["BIC"]);

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

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);
} catch (e) {
  console.error("banks.js: SQLite init error:", e.message);
}

// ── Euribor cache helpers ──────────────────────────────────────────────────
/** Intervalo mínimo entre pedidos HTTP ao BCE em GET /api/banks (evita sobrecarga). */
const EUR_BCE_NET_MIN_MS = 90 * 1000;
let lastEuriborNetAttemptMs = 0;

function euriborPayloadDiffers(prev, eur, eurLabel) {
  if (!eur || typeof eur !== "object") return false;
  const keys = ["3m", "6m", "12m"];
  if (!prev || !prev.eur) return keys.some((k) => typeof eur[k] === "number" && Number.isFinite(eur[k]));
  const pe = prev.eur;
  for (const k of keys) {
    const a = pe[k];
    const b = eur[k];
    if ((a == null || !Number.isFinite(a)) && (b == null || !Number.isFinite(b))) continue;
    if (typeof a !== "number" || typeof b !== "number") return true;
    if (Math.abs(a - b) > 1e-10) return true;
  }
  const la = String(prev.eurLabel || "").trim();
  const lb = String(eurLabel || "").trim();
  return la !== lb;
}

function setEuribor(eur, eurLabel) {
  if (!sqliteDb) return;
  const prev = getEuribor();
  if (!euriborPayloadDiffers(prev, eur, eurLabel)) return;
  try {
    sqliteDb.prepare(`
      INSERT INTO kv_store(key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run("euribor", JSON.stringify({ eur, eurLabel, fetchedAt: Date.now() }), Date.now());
  } catch (_) {}
}

function getEuribor() {
  if (!sqliteDb) return null;
  try {
    const row = sqliteDb.prepare("SELECT value, updated_at FROM kv_store WHERE key = ?").get("euribor");
    if (!row) return null;
    return JSON.parse(row.value);
  } catch (_) { return null; }
}

async function fetchAndCacheEuribor() {
  const { eur, eurLabel } = await fetchEuriborFromBce(10000);
  const result = { eur, eurLabel, fetchedAt: Date.now() };
  setEuribor(eur, eurLabel);
  return result;
}

/**
 * Re-descobre Euribor na rede com throttle; só persiste em SQLite quando os valores
 * diferem do cache (setEuribor já compara).
 */
async function refreshEuriborFromBceForGet() {
  const now = Date.now();
  if (now - lastEuriborNetAttemptMs < EUR_BCE_NET_MIN_MS) {
    return getEuribor();
  }
  lastEuriborNetAttemptMs = now;
  try {
    await fetchAndCacheEuribor();
  } catch (_) {
    /* mantém cache anterior */
  }
  return getEuribor();
}

// ── Seed data ─────────────────────────────────────────────────────────────
const SEED_BANKS = [
  { code: "CA", name: "Crédito Agrícola", color: "#2d6a2d", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH CA Dedicado: spread 0,70–1,83% (PRE-FT: Euribor 1/3/6/12m; simulador 3/6/12m)", "Spread promocional 0,45% primeiros 24m (campanha)", "Taxa fixa ilustr. 4,70–5,83% (5/10/15a)"], prod: "Dom. ordenado + Seg. Vida CA + Multirriscos CA", jProd: "18–30a: isenção comissão abertura + manutenção DO nos exemplos TAEG (Nota 1e/1f)" },
  { code: "CTT", name: "Banco CTT", color: "#e30613", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread CH Normal: 0,85% c/ prod. / 1,45% s/ prod. (Euribor 3/6/12m)", "Mista 2a: TAN 3,05% c/ prod. / 3,65% s/ prod.", "Taxa fixa 30a: TAN 4,10% c/ prod. / 4,70% s/ prod.", "CH Jovem DL44: var. 0,75%/1,35%; mista 2,75%/3,35%; fixa 3,95%/4,55%"], prod: "Seg. Vida + Multirriscos + Dom. CTT (Generali Seguros, S.A.)", jProd: "CH Jovem: var. 0,75% c/ prod.; mista 2,75%; fixa 3,95% (Garantia Estado DL44/2024)" },
  { code: "BNKTR", name: "Bankinter", color: "#f7941d", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 12, tipos: ["variável", "mista", "fixa"], promos: ["Spread mín. 0,70% c/ pack (−0,35pp vs sem pack)", "CH Jovem ≤35: mesmo spread — benefício=isenção Avaliação+Estudo", "Euribor 3m · 6m · 12m", "Aceita seguros externos"], prod: "Seg. Vida + Multirriscos + Dom. ordenado", jProd: "Mesmo spread; isenção Comissão de Avaliação + Comissão de Estudo; 100% garantia Estado" },
  { code: "ABANCA", name: "Abanca", color: "#00529b", refs: ["6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["Indexante Euribor 6m ou 12m", "Taxa fixa 2,70% 1.º/2.º ano"], prod: "Dom. ≥1.000€ + Seg. Vida + Multi + Cartão", jProd: "TAN fixa 2,70% 1.º ano → spread 0,70%" },
  { code: "BCP", name: "Millennium BCP", color: "#c8102e", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH: spread 0,70–1,50% (SECCAO_18 mai.2026)", "CH Jovem: 0,85%/1,50% (verif. simulador)", "Spread 0% primeiros 2 anos", "Isenção comissões ≤35a", "3 indexantes"], prod: "Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas", jProd: "Promo 24m + packs; isenção comissões ≤35a" },
  { code: "ACTVO", name: "ActivoBank", color: "#6d1e8a", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0% primeiros 2 anos (mista 24m)", "3 indexantes (E3/E6/E12)", "Taxa fixa: TAN 4,00% c/ prod. / 4,75% s/ prod."], prod: "Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas", jProd: "Spread 0% 2 anos; taxa fixa disponível; 100% garantia Estado" },
  { code: "BPI", name: "Banco BPI", color: "#005ca9", refs: ["6m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread CH 0,75–1,50% (FINE; máx. 75 p.b. vendas associadas)", "CH Jovem DL44: spreads variáveis iguais; TAN fixa ilustr. mais baixa", "Aceita seguradora externa"], prod: "Seg. Vida BPI + Multirriscos BPI (ou externa sem bonif.)", jProd: "Garantia Estado até 100%; campanha isenção comissões iniciais" },
  { code: "MNTPO", name: "Banco Montepio", color: "#7a0f2e", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 24, tipos: ["variável", "mista", "fixa"], promos: ["CH §18.1: Euribor 3/6/12m + spread 0,70–2,30% (mai.2026)", "Mista 2a: TAN 3,05% c/ prod.", "Taxa fixa: TAN ~4,50% c/ prod. / ~5,90% s/ prod.", "Cashback 1,5%"], prod: "Conta Ordenado + Cartão ≥500€/sem + Seg. Vida + Multirriscos Lusitania", jProd: "100% garantia Estado; taxa fixa disponível; cashback 1,5%" },
  { code: "SANTR", name: "Santander", color: "#ec0000", refs: ["6m"], jOk: true, carenciaMax: 12, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0,5% 3 anos (c/prod.) → 0,80% (simulador mai.2026)", "Spread base 1,90% s/ pack", "Garantia Estado ≤35a + benefícios fiscais jovem"], prod: "Cartão créd.≥300€ + Seg. Vida + Multirriscos Santander", jProd: "Garantia Estado; isenções IMT/selo/emol. (Lei 30-A/2024, DL48-D) — ver FINE" },
  { code: "NB", name: "Novo Banco", color: "#00a651", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 24, tipos: ["variável", "mista", "fixa"], promos: ["Euribor 3m · 6m · 12m", "Cashback 1%", "Mudum — multirriscos mais barato"], prod: "Pack 1.º Banco (dom.) + GamaLife + Mudum", jProd: "100% financiamento; cashback 1%" },
  { code: "CGD", name: "CGD", color: "#006633", refs: ["6m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Banco público", "CH Reg. Geral: E6 + spread 0,70%–2,90% (folh. 18)", "Medida Jovem: spreads no simulador CGD", "Cert. A/B: -0,15%"], prod: "Pack Vinculação + Pack Ligação (Fidelidade Vida + Multi)", jProd: "Reg. Geral E6+0,70–2,90% (mai.2026); Medida Jovem 0,65% no simulador oficial" },
  { code: "UCI", name: "UCI", color: "#1a3a6b", refs: ["6m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["CH variável: E6 + spread 1,43–2,30% (§18.1 mai.2026)", "Mista: TAN 4,09% (5a) / 4,29% (10a fixo + E6)", "Fixa até 10a (prazo máx): TAN 4,39% — não simulada (prazo curto)", "Montante 12,5k–1M€", "Sem conta obrigatória"], prod: "Seg. Vida + Multirriscos", jProd: "100% c/ garantia Estado (ver condições UCI)" },
  { code: "BNI", name: "BNI Europa", color: "#4a235a", refs: ["3m", "6m", "12m"], jOk: false, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH garantia hipotecária: spread 2,0–3,1% (Euribor 3/6/12m; §18.1 mai.2026)", "Mista: TAN fixa ilustr. 24m + fase var. (notas TAEG)", "Estudo processo 0,5% (mín. 750€) + avaliação 200€"], prod: "Domiciliação + Seguros", jProd: "Quadro sem CH Jovem dedicado no §18.1 analisado" },
  { code: "BEST", name: "Banco Best", color: "#e85520", refs: ["3m", "6m", "12m"], jOk: false, carenciaMax: 24, tipos: ["variável", "mista", "fixa"], promos: ["Intermediário de crédito Novo Banco (entidade mutuante NB)", "CH variável: E3/E6/E12m + spread 0,90–1,90% (mai.2026)", "Mista e taxa fixa disponíveis", "GamaLife + Mudum (mesmos seguros que NB)"], prod: "Conta 360° + Dom. ordenado + Seg. Vida GamaLife + Multirriscos Mudum", jProd: "Sem linha de CH Jovem dedicada" },
];

/** Valores canónicos servidos via GET /api/banks (SQLite). Actualizar aqui + deploy; `reconcileSeedSpreadsToDb` insere linha nova se divergirem. */
const SEED_SPREADS = {
  CA: { sCom: 0.70, sSem: 1.83, mCom: 3.45, mSem: 4.58, fCom: 4.70, fSem: 5.83, jsCom: 0.75, jsSem: 1.88, promoPeriodo: 24, promoSpread: 0.45, dossier: 250, avaliacao: 200, contaMes: 3.50, contaNota: "Manutenção DO incluída nos exemplos TAEG §18.1; valor mensal estimado fora do quadro", capMin: 25000, capMax: 2000000, vRef: 22.68, mAno: 160, insV: "CA Seguros", insM: "CA Seguros", minutas: 0, jovemIsenta: true },
  CTT: { sCom: 0.85, sSem: 1.45, mCom: 3.05, mSem: 3.65, fCom: 4.10, fSem: 4.70, jsCom: 0.75, jsSem: 1.35, promoPeriodo: 0, promoSpread: null, dossier: 280, avaliacao: 230, contaMes: 1.73, contaNota: "20€/ano conta + IS 4% (exemplos TAEG FINE mai.2026) ≈ 1,73€/mês", capMin: 25000, capMax: 1000000, vRef: 21.51, mAno: 207.12, insV: "Generali Seguros, S.A.", insM: "Generali Seguros, S.A.", minutas: 160, jovemIsenta: false },
  BNKTR: { sCom: 0.70, sSem: 1.05, mCom: 2.25, mSem: 2.60, fCom: 3.45, fSem: 3.80, jsCom: 0.70, jsSem: 1.05, jmCom: 2.25, jmSem: 2.60, jfCom: 3.45, jfSem: 3.80, promoPeriodo: 24, promoSpread: null, dossier: 270, avaliacao: 220, contaMes: 0, contaNota: "Sem comissão de conta obrigatória", capMin: 100000, capMax: 3000000, vRef: 33.28, mAno: 210, insV: "Generali Seguros, S.A.", insM: "Generali Seguros, S.A.", minutas: 0, jovemIsenta: true, jovemSameSpread: true, jovemIsentaAval: true },
  ABANCA: { sCom: 0.70, sSem: 1.70, mCom: 3.45, mSem: 4.45, fCom: 2.70, fSem: 3.50, jsCom: 0.58, jsSem: 1.58, promoPeriodo: 0, promoSpread: null, dossier: 520, avaliacao: 286, contaMes: 6.24, contaNota: "Conta à ordem — exemplo FINE Nota 1 (mai.2026): 6,24€/mês incl. IS", capMin: 5000, capMax: 2000000, vRef: 16.76, mAno: 154, insV: "Abanca Seguros", insM: "Abanca Seguros", minutas: 0, jovemIsenta: true },
  BCP: { sCom: 0.70, sSem: 1.50, mCom: 3.45, mSem: 4.25, fCom: 4.10, fSem: 4.65, jsCom: 0.85, jsSem: 1.50, promoPeriodo: 24, promoSpread: 0, dossier: 300, avaliacao: 250, contaMes: 5.00, contaNota: "Conta Millennium (estimativa; comissões conta fora do §18.1 CH)", capMin: 20000, capMax: 3000000, vRef: 19.92, mAno: 256, insV: "Ocidental Vida", insM: "Ageas/Ocidental", minutas: 0, jovemIsenta: true },
  ACTVO: { sCom: 0.75, sSem: 1.50, mCom: 3.85, mSem: 4.75, fCom: 4.00, fSem: 4.75, jsCom: 0.68, jsSem: 1.38, promoPeriodo: 24, promoSpread: 0, dossier: 300, avaliacao: 250, contaMes: 0, contaNota: "Banco digital — sem comissão", capMin: 20000, capMax: 3000000, vRef: 19.84, mAno: 256, insV: "Ocidental Vida", insM: "Ageas/Ocidental", minutas: 0, jovemIsenta: true },
  BPI: { sCom: 0.75, sSem: 1.50, mCom: 3.20, mSem: 3.95, fCom: 4.10, fSem: 4.85, jsCom: 0.75, jsSem: 1.50, promoPeriodo: 0, promoSpread: null, dossier: 290, avaliacao: 230, contaMes: 4.90, contaNota: "Conta Pacote BPI (estimativa; FINE CH exclui manutenção da TAEG)", capMin: 25000, capMax: 3000000, vRef: 13.12, mAno: 195, insV: "BPI Vida", insM: "BPI Seguros", minutas: 190, jovemIsenta: true },
  MNTPO: { sCom: 0.70, sSem: 2.30, mCom: 3.05, mSem: 4.75, fCom: 4.50, fSem: 5.90, jsCom: 0.58, jsSem: 1.38, promoPeriodo: 0, promoSpread: null, dossier: 312, avaliacao: 239, contaMes: 3.11, contaNota: "Conta Base c/ domiciliação ordenado 2,99€/mês + IS 4% ≈ 3,11€ (PRE-FC mai.2026)", capMin: 10000, capMax: 2000000, vRef: 8.29, mAno: 79, insV: "Lusitania Vida", insM: "Lusitania", minutas: 0, jovemIsenta: false },
  SANTR: { sCom: 0.80, sSem: 1.90, mCom: 3.25, mSem: 4.35, fCom: 4.40, fSem: 4.40, jsCom: 0.80, jsSem: 1.90, promoPeriodo: 36, promoSpread: 0.50, dossier: 725, avaliacao: 230, contaMes: 2.90, contaNota: "Conta (estimativa; FINE CH exclui manutenção mensal da TAEG)", capMin: 30000, capMax: 3000000, vRef: 22.55, mAno: 246, insV: "Santander Seguros", insM: "Santander Seguros", minutas: 0, jovemIsenta: false, jovemSameSpread: true },
  NB: { sCom: 0.75, sSem: 1.70, mCom: 3.65, mSem: 4.60, fCom: 3.71, fSem: 5.99, jsCom: 0.65, jsSem: 1.60, promoPeriodo: 0, promoSpread: null, dossier: 333, avaliacao: 322, contaMes: 8.22, contaNota: "Conta Pacote (fam. 100%) 7,90€/mês + IS 4% ≈ 8,22€ (PRE-FC fev.2026)", capMin: 10000, capMax: 3000000, vRef: 17.55, mAno: 98, insV: "GamaLife", insM: "Mudum", minutas: 0, jovemIsenta: true },
  CGD: { sCom: 0.70, sSem: 2.90, mCom: 3.15, mSem: 5.35, fCom: 4.75, fSem: 6.95, jsCom: 0.65, jsSem: 1.35, promoPeriodo: 24, promoSpread: null, dossier: 250, avaliacao: 200, contaMes: 6.30, contaNota: "Conta Caixadirecta €6,30/mês IS incluído (reconfirmar folheto comissões particulares)", capMin: 5000, capMax: 3000000, vRef: 29.82, mAno: 110, insV: "Fidelidade", insM: "Fidelidade Casa", minutas: 0, jovemIsenta: true },
  UCI: { sCom: 1.43, sSem: 2.30, mCom: 4.09, mSem: 4.09, fCom: 4.39, fSem: 4.39, jsCom: 1.43, jsSem: 2.30, promoPeriodo: 0, promoSpread: null, dossier: 600, avaliacao: 225, contaMes: 0, contaNota: "Sem conta obrigatória", capMin: 12500, capMax: 1000000, vRef: 19.00, mAno: 150, insV: "(est.)", insM: "(est.)", minutas: 400, jovemIsenta: false },
  BNI: { sCom: 2.00, sSem: 3.10, mCom: 4.45, mSem: 5.55, fCom: 5.30, fSem: 6.20, jsCom: 2.00, jsSem: 3.10, promoPeriodo: 0, promoSpread: null, dossier: 750, avaliacao: 200, contaMes: 3.00, contaNota: "Conta DO (estimativa; fora do quadro §18.1)", capMin: 25000, capMax: 1000000, vRef: 19.00, mAno: 150, insV: "(est.)", insM: "(est.)", minutas: 0, jovemIsenta: false },
  BEST: { sCom: 0.90, sSem: 1.90, mCom: 3.65, mSem: 4.60, fCom: 4.41, fSem: 5.99, jsCom: 0.90, jsSem: 1.90, promoPeriodo: 0, promoSpread: null, dossier: 333, avaliacao: 322, contaMes: 8.84, contaNota: "Conta 360° 8,84€/mês IS incluído (est.; intermediário NB)", capMin: 10000, capMax: 1800000, vRef: 17.55, mAno: 123, insV: "GamaLife", insM: "Mudum", minutas: 0, jovemIsenta: false },
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
reconcileSeedBankMetadataToDb();

/** Em cada arranque: se `SEED_SPREADS` diverge do último registo do banco, insere uma linha nova (deploy sem POST manual). Não sobrepõe spreads `source=manual` (POST admin). */
function reconcileSeedSpreadsToDb() {
  if (!sqliteDb) return;
  try {
    const latest = getLatestSpreads();
    const map = {};
    for (const [code, sd] of Object.entries(SEED_SPREADS)) {
      const row = latest[code];
      if (row && String(row.source || "").trim() === "manual") continue;
      map[code] = sd;
    }
    if (Object.keys(map).length === 0) return;
    bulkInsertSpreads(map, "seed-reconcile");
  } catch (e) {
    console.error("banks.js: reconcileSeedSpreadsToDb:", e.message);
  }
}
reconcileSeedSpreadsToDb();

/** Em cada arranque: alinha metadados canónicos na tabela `banks` a `SEED_BANKS` quando divergem (deploy sem POST manual). Corrige instalações antigas em que `INSERT OR IGNORE` deixou `refs`, `tipos`, etc. desactualizados (ex. CA só «12m», CTT/Montepio sem 3m/6m). Não altera `sort_order` nem `active`. Insere bancos novos do seed que ainda não existam na BD. */
function reconcileSeedBankMetadataToDb() {
  if (!sqliteDb) return;
  try {
    const exists = sqliteDb.prepare(`SELECT code FROM banks WHERE code = ?`);
    const ins = sqliteDb.prepare(`
      INSERT OR IGNORE INTO banks (code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, sort_order)
      VALUES (@code, @name, @color, @refs, @jOk, @carenciaMax, @tipos, @promos, @prod, @jProd, @sort_order)
    `);
    const sel = sqliteDb.prepare(`
      SELECT code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd
      FROM banks WHERE code = ? AND active = 1
    `);
    const upd = sqliteDb.prepare(`
      UPDATE banks SET
        name = @name, color = @color, refs = @refs, jOk = @jOk, carenciaMax = @carenciaMax,
        tipos = @tipos, promos = @promos, prod = @prod, jProd = @jProd, updated_at = @updated_at
      WHERE code = @code
    `);
    for (const [i, bank] of SEED_BANKS.entries()) {
      if (!exists.get(bank.code)) {
        ins.run({
          code: bank.code,
          name: bank.name,
          color: bank.color || "#666666",
          refs: JSON.stringify(bank.refs && bank.refs.length ? bank.refs : ["12m"]),
          jOk: bank.jOk ? 1 : 0,
          carenciaMax: Number(bank.carenciaMax) || 0,
          tipos: JSON.stringify(bank.tipos && bank.tipos.length ? bank.tipos : ["variável"]),
          promos: JSON.stringify(bank.promos || []),
          prod: bank.prod || "",
          jProd: bank.jProd || "",
          sort_order: i,
        });
        continue;
      }
      const row = sel.get(bank.code);
      if (!row) continue;
      const refs = JSON.stringify(bank.refs && bank.refs.length ? bank.refs : ["12m"]);
      const tipos = JSON.stringify(bank.tipos && bank.tipos.length ? bank.tipos : ["variável"]);
      const promos = JSON.stringify(bank.promos || []);
      const name = bank.name;
      const color = bank.color || "#666666";
      const prod = bank.prod || "";
      const jProd = bank.jProd || "";
      const jOk = bank.jOk ? 1 : 0;
      const carenciaMax = Number(bank.carenciaMax) || 0;
      if (
        row.refs === refs &&
        row.tipos === tipos &&
        row.promos === promos &&
        row.prod === prod &&
        row.jProd === jProd &&
        row.name === name &&
        row.color === color &&
        Number(row.jOk) === jOk &&
        Number(row.carenciaMax) === carenciaMax
      ) {
        continue;
      }
      upd.run({
        code: bank.code,
        name,
        color,
        refs,
        jOk,
        carenciaMax,
        tipos,
        promos,
        prod,
        jProd,
        updated_at: Date.now(),
      });
    }
  } catch (e) {
    console.error("banks.js: reconcileSeedBankMetadataToDb:", e.message);
  }
}

/** sCom = spread normal (fora da promo); promoSpread = durante a promo (≤ sCom). Corrige inversões da API. */
function normalizeCampaignSpreadPair(d) {
  if (!d || typeof d !== "object") return d;
  const out = { ...d };
  const pp = Number(out.promoPeriodo) || 0;
  if (pp <= 0) return out;
  if (typeof out.promoSpread !== "number" || !Number.isFinite(out.promoSpread)) return out;
  if (typeof out.sCom !== "number" || !Number.isFinite(out.sCom)) return out;
  const hi = Math.max(out.sCom, out.promoSpread);
  const lo = Math.min(out.sCom, out.promoSpread);
  out.sCom = hi;
  out.promoSpread = lo;
  return out;
}

function nclose(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < 1e-8;
}

/** True se o último spread em DB for semanticamente igual ao payload (evita histórico duplicado). */
function spreadComparableEqual(stored, incomingNorm) {
  if (!stored || !incomingNorm || typeof incomingNorm !== "object") return false;
  const S = { ...stored };
  const I = incomingNorm;
  delete S.fetchedAt;
  delete S.source;
  const nums = [
    "sCom", "sSem", "mCom", "mSem", "fCom", "fSem", "jsCom", "jsSem",
    "dossier", "avaliacao", "contaMes", "capMin", "capMax", "vRef", "mAno", "minutas",
  ];
  for (const k of nums) {
    if (!nclose(S[k], I[k])) return false;
  }
  if (Number(S.promoPeriodo || 0) !== Number(I.promoPeriodo || 0)) return false;
  if (!nclose(S.promoSpread, I.promoSpread)) return false;
  if (String(S.contaNota || "").trim() !== String(I.contaNota || "").trim()) return false;
  if (String(S.insV || "").trim() !== String(I.insV || "").trim()) return false;
  if (String(S.insM || "").trim() !== String(I.insM || "").trim()) return false;
  if (!!S.jovemIsenta !== !!I.jovemIsenta) return false;
  return true;
}

// ── Queries ───────────────────────────────────────────────────────────────

function getAllBanks() {
  if (!sqliteDb) return [];
  return sqliteDb.prepare(`
    SELECT code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, active, sort_order, updated_at
    FROM banks WHERE active = 1 ORDER BY sort_order
  `).all().filter(row => !DROPPED_BANK_CODES.has(row.code)).map(row => ({
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
    if (DROPPED_BANK_CODES.has(row.bank_code)) continue;
    result[row.bank_code] = normalizeCampaignSpreadPair({
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
    });
  }
  return result;
}

function getSpreadsHistory(bankCode, limit = 10) {
  if (!sqliteDb) return [];
  if (DROPPED_BANK_CODES.has(bankCode)) return [];
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
  if (DROPPED_BANK_CODES.has(bankCode)) return false;
  if (!spreadsData || typeof spreadsData !== "object") return false;
  spreadsData = normalizeCampaignSpreadPair({ ...spreadsData });
  const latest = getLatestSpreads();
  if (spreadComparableEqual(latest[bankCode], spreadsData)) return true;
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
    const latest = getLatestSpreads();
    for (const [code, data] of Object.entries(map)) {
      if (DROPPED_BANK_CODES.has(code)) continue;
      if (!data || typeof data !== "object") continue;
      const d = normalizeCampaignSpreadPair({ ...data });
      if (spreadComparableEqual(latest[code], d)) continue;
      stmt.run({
        bank_code: code,
        sCom: d.sCom ?? null,
        sSem: d.sSem ?? null,
        mCom: d.mCom ?? null,
        mSem: d.mSem ?? null,
        fCom: d.fCom ?? null,
        fSem: d.fSem ?? null,
        jsCom: d.jsCom ?? null,
        jsSem: d.jsSem ?? null,
        promoPeriodo: d.promoPeriodo || 0,
        promoSpread: d.promoSpread ?? null,
        dossier: d.dossier || 0,
        avaliacao: d.avaliacao || 0,
        contaMes: d.contaMes || 0,
        contaNota: d.contaNota || "",
        capMin: d.capMin || 0,
        capMax: d.capMax || 0,
        vRef: d.vRef || 0,
        mAno: d.mAno || 0,
        insV: d.insV || "",
        insM: d.insM || "",
        minutas: d.minutas || 0,
        jovemIsenta: d.jovemIsenta ? 1 : 0,
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
    // ?history=CODE — devolve histórico de um banco
    if (req.query && req.query.history) {
      const history = getSpreadsHistory(req.query.history, parseInt(req.query.limit) || 10);
      return res.status(200).json({ history });
    }

    const maxSpreadAt = sqliteDb.prepare("SELECT MAX(fetched_at) AS mx FROM spreads").get()?.mx || 0;
    const eurRow = sqliteDb.prepare("SELECT updated_at FROM kv_store WHERE key = 'euribor'").get();
    const eurUpdatedAt = eurRow?.updated_at || 0;
    const maxBankAt = sqliteDb.prepare("SELECT MAX(updated_at) AS mx FROM banks").get()?.mx || 0;
    const etag = `"banks-${maxSpreadAt}-${eurUpdatedAt}-${maxBankAt}"`;
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304);
      return res.end();
    }
    res.setHeader("ETag", etag);

    const banks = getAllBanks();
    const spreads = getLatestSpreads();
    const result = banks.map(bank => ({
      ...bank,
      spreads: spreads[bank.code] || null,
    }));

    // Euribor: sincroniza com BCE (throttle à rede); SQLite só actualiza se os valores diferirem
    let euriborData = getEuribor();
    try {
      euriborData = await refreshEuriborFromBceForGet();
    } catch (_) {
      /* mantém cache */
    }

    return res.status(200).json({ banks: result, euribor: euriborData || null });
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
      if (DROPPED_BANK_CODES.has(bank.code)) {
        return res.status(400).json({ error: "Código de banco não suportado" });
      }
      upsertBank(bank);
    }

    if (spreadsData && typeof spreadsData === "object") {
      if (spreadsData.bank_code) {
        if (DROPPED_BANK_CODES.has(spreadsData.bank_code)) {
          return res.status(400).json({ error: "Código de banco não suportado" });
        }
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
module.exports.setEuribor = setEuribor;
