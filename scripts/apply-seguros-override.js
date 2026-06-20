#!/usr/bin/env node
/**
 * Aplica as correcções de seguros (vRef/mAno/minutas) apuradas na auditoria
 * 2026-06-20 (ver docs/auditoria.md §4-bis) como override LIVE, preservando
 * todos os outros campos de spread de cada banco.
 *
 * Porquê um script e não um payload fixo:
 *   - O POST /api/banks grava uma LINHA COMPLETA de spreads. Enviar só o vRef
 *     apagaria os restantes campos. Por isso lê-se primeiro o estado live
 *     (GET /api/banks), muda-se SÓ os campos de seguros, e regrava-se.
 *   - A `source` da regravação é escolhida conforme o `preferSource` do banco,
 *     para que o override fique de facto PREFERIDO em getLatestSpreads():
 *       · preferSource='manual' → source='manual'
 *       · caso contrário        → source='anthropic' (entra na preferência por
 *         recência, sobrevive ao reconcile do seed e NÃO congela futuras
 *         actualizações do preçário, que também são 'anthropic' mais recentes).
 *
 * Uso:
 *   BASE_URL=https://<host> ADMIN_TOKEN=<token> node scripts/apply-seguros-override.js [--dry-run]
 *
 * --dry-run mostra o antes/depois sem gravar.
 */
"use strict";

const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.ADMIN_TOKEN || "";
const DRY = process.argv.includes("--dry-run");

// Correcções apuradas contra os simuladores oficiais (API CGD + screenshots).
const CORRECTIONS = {
  CGD:   { vRef: 12.54, mAno: 135.36, minutas: 202.80 },
  SANTR: { vRef: 10.58 },
  NB:    { vRef: 11.51, mAno: 148.09 },
  ACTVO: { vRef: 14.39 },
};

async function main() {
  if (!BASE_URL || !TOKEN) {
    console.error("Define BASE_URL e ADMIN_TOKEN. Ex.:");
    console.error("  BASE_URL=https://exemplo.pt ADMIN_TOKEN=xxx node scripts/apply-seguros-override.js --dry-run");
    process.exit(1);
  }

  const r = await fetch(BASE_URL + "/api/banks");
  if (!r.ok) {
    console.error("GET /api/banks falhou: HTTP " + r.status);
    process.exit(1);
  }
  const { banks } = await r.json();

  for (const [code, corr] of Object.entries(CORRECTIONS)) {
    const bank = (banks || []).find((b) => b.code === code);
    if (!bank || !bank.spreads) {
      console.warn(`${code}: não encontrado ou sem spreads — ignorado`);
      continue;
    }
    const live = bank.spreads;
    const before = { vRef: live.vRef, mAno: live.mAno, minutas: live.minutas };
    const src = bank.preferSource === "manual" ? "manual" : "anthropic";

    // Linha completa = live + correcções; troca-se a origem para ficar preferida.
    const spreads = { ...live, ...corr, bank_code: code, source: src };
    delete spreads.fetchedAt;

    console.log(
      `${code}: source live='${live.source}' preferSource='${bank.preferSource}' → grava como '${src}'`
    );
    console.log(`   antes ${JSON.stringify(before)}  →  ${JSON.stringify(corr)}`);

    if (DRY) continue;

    const pr = await fetch(BASE_URL + "/api/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify({ spreads }),
    });
    if (!pr.ok) {
      const e = await pr.json().catch(() => ({}));
      console.error(`   ${code}: POST falhou — ${e.error || "HTTP " + pr.status}`);
    } else {
      console.log(`   ${code}: aplicado ✓`);
    }
  }

  if (DRY) console.log("\n(dry-run — nada foi gravado)");
}

main().catch((e) => {
  console.error("Erro:", e.message);
  process.exit(1);
});
