#!/usr/bin/env node
// Health-check dos URLs de preçário (BANK_SOURCES) via a URL context tool do Gemini.
//
// Uso:   GEMINI_API_KEY=... node scripts/audit-urls.js
//        npm run audit:urls
//
// Códigos de saída (úteis em Jenkins/cron):
//   0 — todos os URLs acessíveis (urlRetrievalStatus === SUCCESS)
//   1 — pelo menos um URL inacessível
//   2 — erro de configuração/execução (sem chave, falha de rede/API)
//
// Não escreve em cache nem publica nada — apenas consulta o estado de retrieval.
const path = require("path");
const { auditUrls } = require(path.join(__dirname, "..", "api", "spreads.js"));

(async () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Falta GEMINI_API_KEY (ou GOOGLE_API_KEY) no ambiente.");
    process.exit(2);
  }

  let r;
  try {
    r = await auditUrls(apiKey);
  } catch (e) {
    console.error("Auditoria falhou:", e && e.message ? e.message : e);
    process.exit(2);
  }

  for (const x of r.results) {
    const tag = x.ok ? "OK   " : (x.status === "UNKNOWN" ? "?    " : "FALHA");
    console.log(`${tag} ${x.codes.join("/").padEnd(9)} ${x.url}`);
  }
  if (r.banksWithoutUrl.length) {
    console.log("\nSem URL (o modelo estima):", r.banksWithoutUrl.join(", "));
  }
  console.log(`\n${r.ok}/${r.total} acessíveis @ ${r.checkedAt}`);

  if (r.failed.length) {
    console.error(`\nFALHA: ${r.failed.length} URL(s) inacessíveis —`);
    for (const f of r.failed) console.error(`  ${f.codes.join("/")}: ${f.url} (${f.status})`);
    process.exit(1);
  }
  console.log("OK: todos os URLs de preçário estão acessíveis.");
})();
