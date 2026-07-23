const path = require("path");
const { openSqliteDb } = require(path.join(__dirname, "..", "lib", "open-sqlite.js"));

// Constantes fiscais/regulatórias — mesmo ficheiro que serve de fallback no browser
const SIM_DEFAULTS = require(path.join(__dirname, "..", "public", "js", "shared", "sim-defaults.js"));
const IMI_MUNICIPIOS_DEFAULTS = require(path.join(__dirname, "..", "public", "js", "shared", "imi-municipios-defaults.js"));

// ── SQLite ────────────────────────────────────────────────────────────────
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "banks.sqlite");

/** Códigos retirados do produto (podem persistir em bases antigas) — não expor na API. */
const DROPPED_BANK_CODES = new Set(["BIC", "BEST"]);

const BANKS_SCHEMA = `
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
      jovemSameSpread INTEGER DEFAULT 0,
      jovemIsentaAval INTEGER DEFAULT 0,
      jmCom REAL,
      jmSem REAL,
      jfCom REAL,
      jfSem REAL,
      vCap REAL DEFAULT 150000,
      vAge INTEGER DEFAULT 30,
      pRef REAL DEFAULT 200000,
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
  `;

function runBanksMigrations(db) {
  const newCols = [
    "ALTER TABLE spreads ADD COLUMN jovemSameSpread INTEGER DEFAULT 0",
    "ALTER TABLE spreads ADD COLUMN jovemIsentaAval INTEGER DEFAULT 0",
    "ALTER TABLE spreads ADD COLUMN jmCom REAL",
    "ALTER TABLE spreads ADD COLUMN jmSem REAL",
    "ALTER TABLE spreads ADD COLUMN jfCom REAL",
    "ALTER TABLE spreads ADD COLUMN jfSem REAL",
    "ALTER TABLE spreads ADD COLUMN vCap REAL DEFAULT 150000",
    "ALTER TABLE spreads ADD COLUMN vAge INTEGER DEFAULT 30",
    "ALTER TABLE spreads ADD COLUMN pRef REAL DEFAULT 200000",
  ];
  for (const sql of newCols) {
    try {
      db.exec(sql);
    } catch (_) {
      /* coluna já existe */
    }
  }
  try {
    db.exec("ALTER TABLE banks ADD COLUMN ltvBrackets TEXT DEFAULT NULL");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE banks ADD COLUMN preferSource TEXT DEFAULT 'api'");
  } catch (_) {}
}

const { db: sqliteDb } = openSqliteDb(dbPath, {
  label: "banks.js",
  schema: BANKS_SCHEMA,
  onOpen: runBanksMigrations,
});

// ── Euribor cache helpers ──────────────────────────────────────────────────
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
  } catch (e) {
    console.error("banks.js: setEuribor persist failed:", e.message);
  }
}

function getEuribor() {
  if (!sqliteDb) return null;
  try {
    const row = sqliteDb.prepare("SELECT value, updated_at FROM kv_store WHERE key = ?").get("euribor");
    if (!row) return null;
    return JSON.parse(row.value);
  } catch (_) { return null; }
}

// ── Seed data ─────────────────────────────────────────────────────────────
/** Escalões de spread adicional por LTV, por banco. Fonte canónica — espelha inversa-bootstrap.js. */
const SEED_LTV_BRACKETS = {
  CA:    [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  CTT:   [{max:100,add:0}],
  BNKTR: [{max:75,add:0},{max:80,add:0.05},{max:90,add:0.10},{max:100,add:0.15}],
  ABANCA:[{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  BCP:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  ACTVO: [{max:70,add:0},{max:80,add:0},{max:90,add:0},{max:100,add:0.10}],
  BPI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  MNTPO: [{max:70,add:0},{max:80,add:0},{max:90,add:0},{max:100,add:0}],
  SANTR: [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  NB:    [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  CGD:   [{max:70,add:0},{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  UCI:   [{max:80,add:0},{max:90,add:0.05},{max:100,add:0.10}],
  BNI:   [{max:80,add:0},{max:90,add:0.10}],
};

const SEED_BANKS = [
  { code: "CA", name: "Crédito Agrícola", color: "#2d6a2d", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH CA Dedicado: spread 0,75–1,60% (PRE-FT: Euribor 1/3/6/12m; simulador 3/6/12m)", "Spread promocional 0,50% primeiros 24m (campanha)", "Taxa fixa ilustr. 4,75–5,60% (15a)"], prod: "Dom. ordenado + Seg. Vida CA + Multirriscos CA", jProd: "18–30a: isenção comissão abertura + manutenção DO nos exemplos TAEG (Nota 1e/1f)" },
  { code: "CTT", name: "Banco CTT", color: "#e30613", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread CH Normal: 0,75% c/ prod. / 1,35% s/ prod. (Euribor 3/6/12m)", "Mista 2a: TAN 3,05% c/ prod. / 3,65% s/ prod.", "Taxa fixa 30a: TAN 4,10% c/ prod. / 4,70% s/ prod.", "CH Jovem DL44: var. 0,75%/1,35%; mista 2,75%/3,35%; fixa 3,95%/4,55%"], prod: "Seg. Vida + Multirriscos + Dom. CTT (Generali Seguros, S.A.)", jProd: "CH Jovem: var. 0,75% c/ prod.; mista 2,75%; fixa 3,95% (Garantia Estado DL44/2024)" },
  { code: "BNKTR", name: "Bankinter", color: "#f7941d", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 12, tipos: ["variável", "mista", "fixa"], promos: ["Spread mín. 0,70% c/ pack (−0,35pp vs sem pack)", "CH Jovem ≤35: mesmo spread — benefício=isenção Avaliação+Estudo", "Euribor 3m · 6m · 12m", "Aceita seguros externos"], prod: "Seg. Vida + Multirriscos + Dom. ordenado", jProd: "Mesmo spread; isenção Comissão de Avaliação + Comissão de Estudo; 100% garantia Estado" },
  { code: "ABANCA", name: "Abanca", color: "#00529b", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH variável: E12M + spread 0,70–1,70% (mai.2026)", "Mista 2a: TAN 2,70% c/ prod. / 3,70% s/ prod.", "Taxa fixa: TAN 3,85% c/ prod. / 4,85% s/ prod.", "CH Jovem: mista 1a 2,70%/3,70%; spread 0,70%/1,70%"], prod: "Dom. ≥1.000€ + Seg. Vida + Multi + Cartão", jProd: "CH Jovem: mista 1a 2,70%/3,70%; spread 0,70%/1,70%; 100% garantia Estado; sem IMT/IS" },
  { code: "BCP", name: "Millennium BCP", color: "#c8102e", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH: spread 0,70–1,50% (SECCAO_18 mai.2026)", "CH Jovem: 0,85%/1,50% (verif. simulador)", "Spread 0% primeiros 2 anos", "Isenção comissões ≤35a", "3 indexantes"], prod: "Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas", jProd: "Promo 24m + packs; isenção comissões ≤35a" },
  { code: "ACTVO", name: "ActivoBank", color: "#6d1e8a", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0% primeiros 2 anos (mista 24m)", "3 indexantes (E3/E6/E12)", "Taxa fixa: TAN 4,00% c/ prod. / 4,75% s/ prod."], prod: "Cartão créd.≥100€ + Créd.pessoal + Dom. + Seg. Ocidental + Ageas", jProd: "Spread 0% 2 anos; taxa fixa disponível; 100% garantia Estado" },
  { code: "BPI", name: "Banco BPI", color: "#005ca9", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Spread CH 0,75–1,50% (FINE; máx. 75 p.b. vendas associadas)", "CH Jovem DL44: spreads variáveis iguais; TAN fixa ilustr. mais baixa", "Aceita seguradora externa"], prod: "Seg. Vida BPI + Multirriscos BPI (ou externa sem bonif.)", jProd: "Garantia Estado até 100%; campanha isenção comissões iniciais" },
  { code: "MNTPO", name: "Banco Montepio", color: "#7a0f2e", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 24, tipos: ["variável", "mista", "fixa"], promos: ["CH §18.1: Euribor 3/6/12m + spread 0,70–2,30% (mai.2026)", "Mista 2a: TAN 3,10% c/ prod.", "Taxa fixa: TAN 4,20% c/ prod. / 5,00% s/ prod.", "Cashback 1,5%"], prod: "Conta Ordenado + Cartão ≥500€/sem + Seg. Vida + Multirriscos Lusitania", jProd: "100% garantia Estado; taxa fixa disponível; cashback 1,5%" },
  { code: "SANTR", name: "Santander", color: "#ec0000", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 12, tipos: ["variável", "mista", "fixa"], promos: ["Spread 0,5% 3 anos (c/prod.) → 0,80% (simulador mai.2026)", "Spread base 1,90% s/ pack", "Garantia Estado ≤35a + benefícios fiscais jovem"], prod: "Cartão créd.≥300€ + Seg. Vida + Multirriscos Santander", jProd: "Garantia Estado; isenções IMT/selo/emol. (Lei 30-A/2024, DL48-D) — ver FINE" },
  { code: "NB", name: "Novo Banco", color: "#00a651", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 24, tipos: ["variável", "mista", "fixa"], promos: ["Euribor 3m · 6m · 12m", "Cashback 1%", "Mudum — multirriscos mais barato"], prod: "Pack 1.º Banco (dom.) + GamaLife + Mudum", jProd: "100% financiamento; cashback 1%" },
  { code: "CGD", name: "CGD", color: "#006633", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["Banco público", "CH Reg. Geral: E6 + spread 0,65%–1,35% (FINE mai.2026)", "Medida Jovem: spreads no simulador CGD", "Cert. A/B: -0,15%"], prod: "Pack Vinculação + Pack Ligação (Fidelidade Vida + Multi)", jProd: "CH Normal: 0,65%/1,35% c/s prod.; Medida Jovem: 1,65%/2,35% c/s prod. (FINE mai.2026)" },
  { code: "UCI", name: "UCI", color: "#1a3a6b", refs: ["3m", "6m", "12m"], jOk: true, carenciaMax: 0, tipos: ["variável", "mista"], promos: ["CH variável: E6 + spread 1,43–2,30% (§18.1 mai.2026)", "Mista: TAN 4,09% (5a) / 4,29% (10a fixo + E6)", "Fixa até 10a (prazo máx): TAN 4,39% — não simulada (prazo curto)", "Montante 12,5k–1M€", "Sem conta obrigatória"], prod: "Seg. Vida + Multirriscos", jProd: "100% c/ garantia Estado (ver condições UCI)" },
  { code: "BNI", name: "BNI Europa", color: "#4a235a", refs: ["3m", "6m", "12m"], jOk: false, carenciaMax: 0, tipos: ["variável", "mista", "fixa"], promos: ["CH garantia hipotecária: spread 2,0–3,1% (Euribor 3/6/12m; §18.1 mai.2026)", "Mista: TAN fixa ilustr. 24m + fase var. (notas TAEG)", "Estudo processo 0,5% (mín. 750€) + avaliação 200€"], prod: "Domiciliação + Seguros", jProd: "Quadro sem CH Jovem dedicado no §18.1 analisado" },];

/** Valores canónicos servidos via GET /api/banks (SQLite). Actualizar aqui + deploy; `reconcileSeedSpreadsToDb` insere linha nova se divergirem. */
const SEED_SPREADS = {
  CA:    { sCom:0.75,sSem:1.60,mCom:2.50,mSem:3.35,fCom:4.75,fSem:5.60,jsCom:0.75,jsSem:1.60,promoPeriodo:24,promoSpread:0.50,dossier:197.60,avaliacao:239.20,contaMes:5.20,contaNota:"60€/mês base + IS 4% = 62,40€/ano = 5,20€/mês (FINE mai.2026)",capMin:25000,capMax:2000000,vRef:22.68,mAno:160,insV:"CA Seguros",insM:"CA Seguros",minutas:0,jovemIsenta:true,jovemSameSpread:true,jovemIsentaAval:false,jmCom:2.50,jmSem:3.35,jfCom:4.75,jfSem:5.60,vCap:150000,vAge:30,pRef:200000 },
  CTT:   { sCom:0.75,sSem:1.35,mCom:3.05,mSem:3.65,fCom:4.10,fSem:4.70,jsCom:0.75,jsSem:1.35,jmCom:2.75,jmSem:3.35,jfCom:3.95,jfSem:4.55,promoPeriodo:0,promoSpread:null,dossier:280,avaliacao:230,contaMes:1.73,contaNota:"20€/ano conta + IS 4% (exemplos TAEG FINE mai.2026) ≈ 1,73€/mês",capMin:25000,capMax:1000000,vRef:16.13,mAno:207.12,insV:"Generali Seguros, S.A.",insM:"Generali Seguros, S.A.",minutas:160,jovemIsenta:false,jovemSameSpread:false,jovemIsentaAval:false,vCap:150000,vAge:30,pRef:200000 },
  BNKTR: { sCom:0.70,sSem:1.05,mCom:2.25,mSem:2.60,fCom:3.45,fSem:3.80,jsCom:0.70,jsSem:1.05,jmCom:2.25,jmSem:2.60,jfCom:3.45,jfSem:3.80,promoPeriodo:24,promoSpread:null,dossier:270,avaliacao:220,contaMes:0,contaNota:"Sem comissão de conta obrigatória",capMin:100000,capMax:3000000,vRef:33.28,mAno:210,insV:"Generali Seguros, S.A.",insM:"Generali Seguros, S.A.",minutas:0,jovemIsenta:true,jovemSameSpread:true,jovemIsentaAval:true,vCap:150000,vAge:36,pRef:200000 },
  ABANCA:{ sCom:0.70,sSem:1.70,mCom:2.70,mSem:3.70,fCom:3.85,fSem:4.85,jsCom:0.70,jsSem:1.70,promoPeriodo:0,promoSpread:null,dossier:520,avaliacao:286,contaMes:6.24,contaNota:"Conta à ordem — exemplo FINE Nota 1 (mai.2026): 6,24€/mês incl. IS",capMin:5000,capMax:2000000,vRef:16.76,mAno:154,insV:"Abanca Seguros",insM:"Abanca Seguros",minutas:0,jovemIsenta:true,jovemSameSpread:false,jovemIsentaAval:false,jmCom:2.70,jmSem:3.70,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },
  BCP:   { sCom:0.70,sSem:1.25,mCom:3.45,mSem:4.25,fCom:4.10,fSem:4.65,jsCom:0.85,jsSem:1.50,promoPeriodo:24,promoSpread:0,dossier:300,avaliacao:250,contaMes:5.00,contaNota:"Conta Millennium (estimativa; comissões conta fora do §18.1 CH)",capMin:20000,capMax:3000000,vRef:19.92,mAno:256,insV:"Ocidental Vida",insM:"Ageas/Ocidental",minutas:0,jovemIsenta:true,jovemSameSpread:false,jovemIsentaAval:false,jmCom:null,jmSem:null,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },
  ACTVO: { sCom:0.75,sSem:1.25,mCom:3.85,mSem:4.75,fCom:4.00,fSem:4.75,jsCom:0.68,jsSem:1.38,promoPeriodo:24,promoSpread:0,dossier:300,avaliacao:250,contaMes:0,contaNota:"Banco digital — sem comissão",capMin:20000,capMax:3000000,vRef:14.39,mAno:256,insV:"Ocidental Vida",insM:"Ageas/Ocidental",minutas:0,jovemIsenta:true,jovemSameSpread:false,jovemIsentaAval:false,jmCom:null,jmSem:null,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },
  BPI:   { sCom:0.75,sSem:1.50,mCom:3.20,mSem:3.95,fCom:4.10,fSem:4.85,jsCom:0.75,jsSem:1.50,promoPeriodo:0,promoSpread:null,dossier:290,avaliacao:230,contaMes:4.90,contaNota:"Conta Pacote BPI (estimativa; FINE CH exclui manutenção da TAEG)",capMin:25000,capMax:3000000,vRef:13.12,mAno:195,insV:"BPI Vida",insM:"BPI Seguros",minutas:190,jovemIsenta:true,jovemSameSpread:false,jovemIsentaAval:false,jmCom:null,jmSem:null,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },
  MNTPO: { sCom:0.70,sSem:1.50,mCom:3.10,mSem:3.90,fCom:4.20,fSem:5.00,jsCom:0.70,jsSem:1.50,promoPeriodo:0,promoSpread:null,dossier:312,avaliacao:239.20,contaMes:5.41,contaNota:"Conta DO 5,20€/mês + IS 4% = 5,41€ (FINE mai.2026)",capMin:10000,capMax:2000000,vRef:8.006,mAno:62.88,insV:"Lusitania Vida",insM:"Lusitania",minutas:208,jovemIsenta:false,jovemSameSpread:true,jovemIsentaAval:false,jmCom:3.10,jmSem:3.90,jfCom:4.20,jfSem:5.00,vCap:100000,vAge:30,pRef:100000 },
  SANTR: { sCom:0.80,sSem:1.90,mCom:2.80,mSem:4.70,fCom:4.40,fSem:4.40,jsCom:0.80,jsSem:1.90,jmCom:2.80,jmSem:4.70,jfCom:null,jfSem:null,promoPeriodo:36,promoSpread:0.50,dossier:725,avaliacao:230,contaMes:2.90,contaNota:"Conta (estimativa; FINE CH exclui manutenção mensal da TAEG)",capMin:30000,capMax:3000000,vRef:10.58,mAno:246,insV:"Santander Seguros",insM:"Santander Seguros",minutas:0,jovemIsenta:false,jovemSameSpread:true,jovemIsentaAval:false,vCap:150000,vAge:30,pRef:200000 },
  NB:    { sCom:0.80,sSem:1.50,mCom:3.65,mSem:4.60,fCom:3.71,fSem:5.99,jsCom:0.65,jsSem:1.60,promoPeriodo:0,promoSpread:null,dossier:333,avaliacao:322,contaMes:8.22,contaNota:"Conta Pacote (fam. 100%) 7,90€/mês + IS 4% ≈ 8,22€ (PRE-FC fev.2026)",capMin:10000,capMax:3000000,vRef:11.51,mAno:148.09,insV:"GamaLife",insM:"Mudum",minutas:0,jovemIsenta:true,jovemSameSpread:false,jovemIsentaAval:false,jmCom:null,jmSem:null,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },
  CGD:   { sCom:0.65,sSem:1.35,mCom:3.80,mSem:4.50,fCom:4.65,fSem:5.35,jsCom:1.65,jsSem:2.35,promoPeriodo:24,promoSpread:null,dossier:226.20,avaliacao:239.20,contaMes:6.55,contaNota:"Conta Caixa M 6,30€/mês + IS 4% = 6,55€/mês (FINE mai.2026)",capMin:5000,capMax:3000000,vRef:12.54,mAno:135.36,insV:"Fidelidade",insM:"Fidelidade Casa",minutas:202.80,jovemIsenta:false,jovemSameSpread:false,jovemIsentaAval:false,jmCom:4.80,jmSem:5.50,jfCom:5.65,jfSem:6.35,vCap:150000,vAge:30,pRef:200000 },
  UCI:   { sCom:1.43,sSem:2.30,mCom:4.09,mSem:4.09,fCom:4.39,fSem:4.39,jsCom:1.43,jsSem:2.30,promoPeriodo:0,promoSpread:null,dossier:600,avaliacao:225,contaMes:0,contaNota:"Sem conta obrigatória",capMin:12500,capMax:1000000,vRef:16.88,mAno:205.22,insV:"(est.)",insM:"(est.)",minutas:400,jovemIsenta:false,jovemSameSpread:false,jovemIsentaAval:false,jmCom:null,jmSem:null,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },
  BNI:   { sCom:2.00,sSem:3.10,mCom:4.45,mSem:5.55,fCom:5.30,fSem:6.20,jsCom:2.00,jsSem:3.10,promoPeriodo:0,promoSpread:null,dossier:750,avaliacao:200,contaMes:3.00,contaNota:"Conta DO (estimativa; fora do quadro §18.1)",capMin:25000,capMax:1000000,vRef:19.00,mAno:150,insV:"(est.)",insM:"(est.)",minutas:0,jovemIsenta:false,jovemSameSpread:false,jovemIsentaAval:false,jmCom:null,jmSem:null,jfCom:null,jfSem:null,vCap:150000,vAge:30,pRef:200000 },};

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
      const src = row ? String(row.source || "").trim() : "";
      // Dados aprovados pelo admin (AI) nunca devem ser sobrepostos pelo seed —
      // caso contrário, a cada arranque/redeploy o seed-reconcile reverteria as
      // aprovações (source=gemini/anthropic) para os valores canónicos.
      if (src === "gemini" || src === "anthropic") continue;
      if (src === "manual") {
        // Skip manual rows only when all new seed fields are already consistent
        const boolsMatch = (!!row.jovemSameSpread === !!sd.jovemSameSpread)
          && (!!row.jovemIsentaAval === !!sd.jovemIsentaAval);
        const numsOk = (sd.jmCom == null || row.jmCom != null)
          && (sd.jmSem == null || row.jmSem != null)
          && (sd.jfCom == null || row.jfCom != null)
          && (sd.jfSem == null || row.jfSem != null);
        const capOk = row.vCap != null && row.pRef != null && row.vAge != null;
        if (boolsMatch && numsOk && capOk) continue;
      }
      map[code] = sd;
    }
    if (Object.keys(map).length === 0) return;
    bulkInsertSpreads(map, "seed-reconcile");
  } catch (e) {
    console.error("banks.js: reconcileSeedSpreadsToDb:", e.message);
  }
}
reconcileSeedSpreadsToDb();

function reconcileLtvBracketsToDb() {
  if (!sqliteDb) return;
  try {
    const sel = sqliteDb.prepare("SELECT ltvBrackets FROM banks WHERE code = ?");
    const upd = sqliteDb.prepare(
      "UPDATE banks SET ltvBrackets = ?, updated_at = ? WHERE code = ?"
    );
    for (const [code, brackets] of Object.entries(SEED_LTV_BRACKETS)) {
      const row = sel.get(code);
      if (!row) continue;
      const seedJson = JSON.stringify(brackets);
      if (row.ltvBrackets === seedJson) continue;
      upd.run(seedJson, Date.now(), code);
    }
  } catch (e) {
    console.error("banks.js: reconcileLtvBracketsToDb:", e.message);
  }
}
reconcileLtvBracketsToDb();

// ── Constantes fiscais/regulatórias (kv_store, chave "const:<grupo>") ─────
// Valor guardado: {"data":{...},"source":"seed"|"manual"}. Edições manuais do
// admin nunca são sobrepostas pelo reconcile (mesma semântica do preferSource).
const CONSTANT_GROUPS = ["fiscal", "regras", "custos", "vida", "euribor_fallback", "imi_municipios"];

const SEED_CONSTANTS = {
  fiscal: SIM_DEFAULTS.fiscal,
  regras: SIM_DEFAULTS.regras,
  custos: SIM_DEFAULTS.custos,
  vida: SIM_DEFAULTS.vida,
  euribor_fallback: SIM_DEFAULTS.euriborFallback,
  imi_municipios: IMI_MUNICIPIOS_DEFAULTS.imi_municipios,
};

function isFin(v, lo, hi) { return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi; }

function validateImtTable(t) {
  if (!Array.isArray(t) || t.length < 3 || t.length > 10) return "tabela IMT: 3-10 escalões";
  let prev = 0;
  for (let i = 0; i < t.length; i++) {
    const b = t[i];
    if (!b || typeof b !== "object") return "escalão IMT inválido";
    const last = i === t.length - 1;
    if (last) { if (b.max !== null) return "último escalão IMT deve ter max:null"; }
    else {
      if (!isFin(b.max, 1, 1e8) || b.max <= prev) return "max IMT deve ser crescente";
      prev = b.max;
    }
    if (!isFin(b.rate, 0, 0.15)) return "rate IMT fora de gama [0, 0.15]";
    if (!isFin(b.ded, 0, 1e6)) return "ded IMT fora de gama";
  }
  return null;
}

/** Devolve null se válido, ou uma mensagem de erro. */
function validateConstant(group, d) {
  if (d == null || typeof d !== "object") return "payload em falta";
  switch (group) {
    case "fiscal": {
      if (!d.imt || typeof d.imt !== "object") return "fiscal.imt em falta";
      const e1 = validateImtTable(d.imt.hpp); if (e1) return "imt.hpp: " + e1;
      const e2 = validateImtTable(d.imt.outros); if (e2) return "imt.outros: " + e2;
      if (!isFin(d.imt.jovemIsencaoTotal, 1, 1e7) || !isFin(d.imt.jovemIsencaoParcial, 1, 1e7) ||
          d.imt.jovemIsencaoParcial <= d.imt.jovemIsencaoTotal) return "limiares IMT jovem inválidos";
      if (!isFin(d.imt.jovemTaxaExcedente, 0, 0.15)) return "jovemTaxaExcedente fora de gama";
      if (!d.is || !isFin(d.is.escritura, 0, 0.05) || !isFin(d.is.credito, 0, 0.05)) return "taxas IS fora de gama [0, 0.05]";
      if (!isFin(d.is.jovemIsencaoTotal, 1, 1e7) || !isFin(d.is.jovemIsencaoParcial, 1, 1e7)) return "limiares IS jovem inválidos";
      if (!isFin(d.ias, 300, 2000)) return "ias fora de gama [300, 2000]";
      if (!d.imi || !isFin(d.imi.taxaRustico, 0, 0.02)) return "imi.taxaRustico fora de gama";
      if (!isFin(d.imi.isencaoPermVptMult, 1, 1000) || !isFin(d.imi.isencaoPermRendMult, 1, 1000)) return "multiplicadores IMI inválidos";
      const t = d.imi.isencaoTemp;
      if (!t || !isFin(t.vpt1, 1, 1e7) || !isFin(t.vpt2, 1, 1e7) || t.vpt2 < t.vpt1 ||
          !isFin(t.anosBase, 1, 10) || !isFin(t.anosDep3, 1, 10)) return "imi.isencaoTemp inválido";
      return null;
    }
    case "regras": {
      if (!isFin(d.prazoMaxJovem, 10, 50) || !isFin(d.prazoMaxNormal, 10, 50)) return "prazos fora de gama [10, 50]";
      if (!isFin(d.idadeCorteJovem, 18, 60) || !isFin(d.idadeFimMax, 50, 100)) return "idades fora de gama";
      if (!isFin(d.stressAddon, 0, 5)) return "stressAddon fora de gama [0, 5]";
      if (!isFin(d.dstiPrudente, 10, 100) || !isFin(d.dstiAmarelo, 10, 100) || !isFin(d.dstiLimite, 10, 100) ||
          !(d.dstiPrudente <= d.dstiAmarelo && d.dstiAmarelo <= d.dstiLimite)) return "DSTI: exige prudente ≤ amarelo ≤ limite em [10, 100]";
      if (!isFin(d.encargoDependente, 0, 5000)) return "encargoDependente fora de gama";
      if (!d.finalidadeAddon || !d.finalidadeMaxLtv) return "finalidadeAddon/finalidadeMaxLtv em falta";
      for (const v of Object.values(d.finalidadeAddon)) if (!isFin(v, 0, 2)) return "finalidadeAddon fora de gama [0, 2]";
      for (const v of Object.values(d.finalidadeMaxLtv)) if (!isFin(v, 50, 100)) return "finalidadeMaxLtv fora de gama [50, 100]";
      if (!isFin(d.garantiaPublicaCap, 0, 2e6)) return "garantiaPublicaCap fora de gama";
      if (!isFin(d.amortPenaltyVar, 0, 0.1) || !isFin(d.amortPenaltyFixa, 0, 0.1)) return "penalizações fora de gama [0, 0.1]";
      return null;
    }
    case "custos": {
      for (const k of ["dossierDefault", "avaliacaoDefault", "dpa", "notario", "custosFixosEstimativa", "registoBase"])
        if (!isFin(d[k], 0, 5000)) return k + " fora de gama [0, 5000]";
      if (!isFin(d.registoRate, 0, 0.01)) return "registoRate fora de gama [0, 0.01]";
      return null;
    }
    case "vida": {
      if (!Array.isArray(d) || d.length < 2 || d.length > 15) return "vida: 2-15 bandas";
      let prev = 0, prevTaxa = 0;
      for (let i = 0; i < d.length; i++) {
        const b = d[i], last = i === d.length - 1;
        if (!b || typeof b !== "object") return "banda vida inválida";
        if (last) { if (b.max !== null) return "última banda deve ter max:null"; }
        else { if (!isFin(b.max, 18, 100) || b.max <= prev) return "max vida deve ser crescente"; prev = b.max; }
        if (!isFin(b.taxa, 0.0001, 0.1) || b.taxa < prevTaxa) return "taxa vida deve ser não-decrescente em [0.0001, 0.1]";
        prevTaxa = b.taxa;
      }
      return null;
    }
    case "euribor_fallback": {
      const keys = Object.keys(d);
      if (keys.length !== 3 || !["3m", "6m", "12m"].every((k) => keys.includes(k))) return "exige exactamente 3m/6m/12m";
      for (const k of ["3m", "6m", "12m"]) {
        const e = d[k];
        if (!e || !isFin(e.valor, -2, 15)) return k + ".valor fora de gama [-2, 15]";
        if (typeof e.data !== "string" || !e.data.trim() || e.data.length > 40) return k + ".data inválida";
      }
      return null;
    }
    case "imi_municipios": {
      const m = d.municipios;
      if (!Array.isArray(m) || m.length < 250 || m.length > 400) return "municipios: 250-400 entradas";
      let nulls = 0;
      for (const e of m) {
        if (!e || typeof e.label !== "string" || !e.label.trim() || e.label.length > 60) return "label de município inválido";
        if (e.taxa === null) { nulls++; continue; }
        if (!isFin(e.taxa, 0.001, 0.01)) return "taxa de " + e.label + " fora de gama [0.001, 0.01]";
      }
      if (nulls > 1) return "só é permitida uma entrada com taxa:null";
      return null;
    }
    default:
      return "grupo desconhecido";
  }
}

function getConstant(group) {
  if (!sqliteDb || !CONSTANT_GROUPS.includes(group)) return null;
  try {
    const row = sqliteDb.prepare("SELECT value, updated_at FROM kv_store WHERE key = ?").get("const:" + group);
    if (!row) return { data: SEED_CONSTANTS[group], source: "seed", updated_at: 0 };
    const parsed = JSON.parse(row.value);
    return { data: parsed.data, source: parsed.source || "seed", updated_at: row.updated_at || 0 };
  } catch (_) {
    return { data: SEED_CONSTANTS[group], source: "seed", updated_at: 0 };
  }
}

function setConstant(group, data, source) {
  if (!sqliteDb || !CONSTANT_GROUPS.includes(group)) return false;
  try {
    sqliteDb.prepare(`
      INSERT INTO kv_store(key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run("const:" + group, JSON.stringify({ data, source: source || "manual" }), Date.now());
    return true;
  } catch (e) {
    console.error("banks.js: setConstant(" + group + "):", e.message);
    return false;
  }
}

/** Envelope de constantes para o GET (exclui imi_municipios — servido à parte). */
function getAllConstants() {
  const out = { meta: { sources: {}, updatedAt: 0 } };
  const keyMap = { fiscal: "fiscal", regras: "regras", custos: "custos", vida: "vida", euribor_fallback: "euriborFallback" };
  for (const [group, outKey] of Object.entries(keyMap)) {
    const row = getConstant(group);
    out[outKey] = row.data;
    out.meta.sources[group] = row.source;
    if (row.updated_at > out.meta.updatedAt) out.meta.updatedAt = row.updated_at;
  }
  return out;
}

/** Em cada arranque: semeia/actualiza kv_store a partir de sim-defaults.js.
 *  source:"manual" (edição admin) nunca é sobreposto — repor via POST {constants:{grupo:null}}. */
function reconcileConstantsToDb() {
  if (!sqliteDb) return;
  try {
    const sel = sqliteDb.prepare("SELECT value FROM kv_store WHERE key = ?");
    for (const group of CONSTANT_GROUPS) {
      const seed = SEED_CONSTANTS[group];
      const seedErr = validateConstant(group, seed);
      if (seedErr) { console.error("banks.js: seed inválido para const:" + group + " — " + seedErr); continue; }
      const row = sel.get("const:" + group);
      if (!row) { setConstant(group, seed, "seed"); continue; }
      let parsed = null;
      try { parsed = JSON.parse(row.value); } catch (_) {}
      if (parsed && parsed.source === "manual") continue;
      if (!parsed || JSON.stringify(parsed.data) !== JSON.stringify(seed)) setConstant(group, seed, "seed");
    }
  } catch (e) {
    console.error("banks.js: reconcileConstantsToDb:", e.message);
  }
}
reconcileConstantsToDb();

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
    "jmCom", "jmSem", "jfCom", "jfSem", "vCap", "vAge", "pRef",
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
  if (!!S.jovemSameSpread !== !!I.jovemSameSpread) return false;
  if (!!S.jovemIsentaAval !== !!I.jovemIsentaAval) return false;
  return true;
}

// ── Queries ───────────────────────────────────────────────────────────────

function getAllBanks() {
  if (!sqliteDb) return [];
  return sqliteDb.prepare(`
    SELECT code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, active, sort_order, updated_at, ltvBrackets, preferSource
    FROM banks WHERE active = 1 ORDER BY sort_order
  `).all().filter(row => !DROPPED_BANK_CODES.has(row.code)).map(row => ({
    ...row,
    refs: JSON.parse(row.refs),
    tipos: JSON.parse(row.tipos),
    promos: JSON.parse(row.promos),
    ltvBrackets: row.ltvBrackets ? JSON.parse(row.ltvBrackets) : (SEED_LTV_BRACKETS[row.code] || null),
    preferSource: row.preferSource || 'api',
    jOk: !!row.jOk,
    active: !!row.active,
  }));
}

function getLatestSpreads() {
  if (!sqliteDb) return {};
  const rows = sqliteDb.prepare(`
    WITH pref AS (
      SELECT s.bank_code, MAX(s.fetched_at) AS max_fetched
      FROM spreads s
      JOIN banks b ON b.code = s.bank_code
      WHERE (COALESCE(b.preferSource, 'api') = 'manual' AND s.source = 'manual')
         OR (COALESCE(b.preferSource, 'api') != 'manual' AND s.source IN ('seed', 'seed-reconcile', 'gemini', 'anthropic'))
      GROUP BY s.bank_code
    ),
    fallback AS (
      SELECT bank_code, MAX(fetched_at) AS max_fetched
      FROM spreads
      WHERE bank_code NOT IN (SELECT bank_code FROM pref)
      GROUP BY bank_code
    ),
    combined AS (
      SELECT bank_code, max_fetched FROM pref
      UNION ALL
      SELECT bank_code, max_fetched FROM fallback
    )
    SELECT s.* FROM spreads s
    JOIN combined c ON s.bank_code = c.bank_code AND s.fetched_at = c.max_fetched
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
      jmCom: row.jmCom ?? null,
      jmSem: row.jmSem ?? null,
      jfCom: row.jfCom ?? null,
      jfSem: row.jfSem ?? null,
      jovemSameSpread: !!row.jovemSameSpread,
      jovemIsentaAval: !!row.jovemIsentaAval,
      vCap: row.vCap ?? 150000,
      vAge: row.vAge ?? 30,
      pRef: row.pRef ?? 200000,
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
    INSERT INTO banks (code, name, color, refs, jOk, carenciaMax, tipos, promos, prod, jProd, active, sort_order, ltvBrackets, preferSource, updated_at)
    VALUES (@code, @name, @color, @refs, @jOk, @carenciaMax, @tipos, @promos, @prod, @jProd, @active, @sort_order, @ltvBrackets, @preferSource, @updated_at)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, color = excluded.color, refs = excluded.refs,
      jOk = excluded.jOk, carenciaMax = excluded.carenciaMax, tipos = excluded.tipos,
      promos = excluded.promos, prod = excluded.prod, jProd = excluded.jProd,
      active = excluded.active, sort_order = excluded.sort_order,
      ltvBrackets = COALESCE(excluded.ltvBrackets, ltvBrackets),
      preferSource = COALESCE(excluded.preferSource, preferSource),
      updated_at = excluded.updated_at
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
    ltvBrackets: bankData.ltvBrackets ? JSON.stringify(bankData.ltvBrackets) : null,
    preferSource: bankData.preferSource === 'manual' ? 'manual' : bankData.preferSource === 'api' ? 'api' : null,
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
      capMin, capMax, vRef, mAno, insV, insM, minutas, jovemIsenta,
      jovemSameSpread, jovemIsentaAval, jmCom, jmSem, jfCom, jfSem, vCap, vAge, pRef, source)
    VALUES (@bank_code, @sCom, @sSem, @mCom, @mSem, @fCom, @fSem, @jsCom, @jsSem,
      @promoPeriodo, @promoSpread, @dossier, @avaliacao, @contaMes, @contaNota,
      @capMin, @capMax, @vRef, @mAno, @insV, @insM, @minutas, @jovemIsenta,
      @jovemSameSpread, @jovemIsentaAval, @jmCom, @jmSem, @jfCom, @jfSem, @vCap, @vAge, @pRef, @source)
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
    jovemSameSpread: spreadsData.jovemSameSpread ? 1 : 0,
    jovemIsentaAval: spreadsData.jovemIsentaAval ? 1 : 0,
    jmCom: spreadsData.jmCom ?? null,
    jmSem: spreadsData.jmSem ?? null,
    jfCom: spreadsData.jfCom ?? null,
    jfSem: spreadsData.jfSem ?? null,
    vCap: spreadsData.vCap ?? 150000,
    vAge: spreadsData.vAge ?? 30,
    pRef: spreadsData.pRef ?? 200000,
    source,
  });
  return true;
}

function bulkInsertSpreads(spreadsMap, source = "gemini") {
  if (!sqliteDb) return false;
  const stmt = sqliteDb.prepare(`
    INSERT INTO spreads (bank_code, sCom, sSem, mCom, mSem, fCom, fSem, jsCom, jsSem,
      promoPeriodo, promoSpread, dossier, avaliacao, contaMes, contaNota,
      capMin, capMax, vRef, mAno, insV, insM, minutas, jovemIsenta,
      jovemSameSpread, jovemIsentaAval, jmCom, jmSem, jfCom, jfSem, vCap, vAge, pRef, source)
    VALUES (@bank_code, @sCom, @sSem, @mCom, @mSem, @fCom, @fSem, @jsCom, @jsSem,
      @promoPeriodo, @promoSpread, @dossier, @avaliacao, @contaMes, @contaNota,
      @capMin, @capMax, @vRef, @mAno, @insV, @insM, @minutas, @jovemIsenta,
      @jovemSameSpread, @jovemIsentaAval, @jmCom, @jmSem, @jfCom, @jfSem, @vCap, @vAge, @pRef, @source)
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
        jovemSameSpread: d.jovemSameSpread ? 1 : 0,
        jovemIsentaAval: d.jovemIsentaAval ? 1 : 0,
        jmCom: d.jmCom ?? null,
        jmSem: d.jmSem ?? null,
        jfCom: d.jfCom ?? null,
        jfSem: d.jfSem ?? null,
        vCap: d.vCap ?? 150000,
        vAge: d.vAge ?? 30,
        pRef: d.pRef ?? 200000,
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

const CORS_ORIGIN_BANKS = process.env.CORS_ORIGIN || "https://simhabitacao.pt";

function getAllowedOriginBanks(reqOrigin) {
  if (!reqOrigin) return null;
  if (CORS_ORIGIN_BANKS === "*") return "*";
  const allowed = CORS_ORIGIN_BANKS.split(",").map((s) => s.trim());
  if (allowed.includes(reqOrigin)) return reqOrigin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin)) return reqOrigin;
  return allowed[0];
}

module.exports = async function handler(req, res) {
  const origin = getAllowedOriginBanks(req.headers.origin || "");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (origin !== "*") res.setHeader("Vary", "Origin");
  }
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

    // ?municipios=1 — taxas IMI municipais (só a página IMI as pede; ETag próprio)
    if (req.query && req.query.municipios) {
      const mun = getConstant("imi_municipios");
      const munEtag = `"mun-${mun.updated_at}"`;
      if (req.headers["if-none-match"] === munEtag) {
        res.writeHead(304);
        return res.end();
      }
      res.setHeader("ETag", munEtag);
      return res.status(200).json({
        municipios: mun.data.municipios,
        source: mun.source,
        updatedAt: mun.updated_at,
      });
    }

    const maxSpreadAt = sqliteDb.prepare("SELECT MAX(fetched_at) AS mx FROM spreads").get()?.mx || 0;
    const eurRow = sqliteDb.prepare("SELECT updated_at FROM kv_store WHERE key = 'euribor'").get();
    const eurUpdatedAt = eurRow?.updated_at || 0;
    const maxBankAt = sqliteDb.prepare("SELECT MAX(updated_at) AS mx FROM banks").get()?.mx || 0;
    // Constantes: exclui imi_municipios para que editar a tabela grande não
    // invalide o cache de todas as páginas
    const maxConstAt = sqliteDb.prepare(
      "SELECT MAX(updated_at) AS mx FROM kv_store WHERE key LIKE 'const:%' AND key != 'const:imi_municipios'"
    ).get()?.mx || 0;
    const etag = `"banks-${maxSpreadAt}-${eurUpdatedAt}-${maxBankAt}-${maxConstAt}"`;
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

    // Euribor servida da BD (sem rede). A actualização via BCE só acontece no
    // refresh do admin (POST /api/spreads), não no carregamento público.
    const euriborData = getEuribor();

    return res.status(200).json({
      banks: result,
      euribor: euriborData || null,
      constants: getAllConstants(),
    });
  }

  // POST/PUT/DELETE require admin token
  const token = req.headers["x-admin-token"] || "";
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ error: "Não autorizado" });
  }

  // POST /api/banks — criar/actualizar banco
  if (req.method === "POST") {
    const { bank, spreads: spreadsData, constants: constantsData } = req.body || {};

    // {constants:{<grupo>: <data>|null}} — null = repor seed
    if (constantsData && typeof constantsData === "object") {
      for (const [group, data] of Object.entries(constantsData)) {
        if (!CONSTANT_GROUPS.includes(group)) {
          return res.status(400).json({ error: "Grupo de constantes desconhecido: " + group });
        }
        if (data === null) {
          setConstant(group, SEED_CONSTANTS[group], "seed");
          continue;
        }
        const err = validateConstant(group, data);
        if (err) return res.status(400).json({ error: "const:" + group + " — " + err });
        setConstant(group, data, "manual");
      }
      if (!bank && !spreadsData) return res.status(200).json({ ok: true });
    }

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
module.exports.getEuribor = getEuribor;
module.exports.getConstant = getConstant;
module.exports.setConstant = setConstant;
module.exports.getAllConstants = getAllConstants;
