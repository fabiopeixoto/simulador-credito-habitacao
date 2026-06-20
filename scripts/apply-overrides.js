#!/usr/bin/env node
/**
 * Aplica como override LIVE todas as correcções apuradas na auditoria 2026-06-20
 * (seguros + spreads + escalões LTV), preservando os restantes campos de cada banco.
 *
 * Grava com `source: 'anthropic'` (em vez de 'manual') para que o override:
 *   - fique PREFERIDO em getLatestSpreads() sem mudar `preferSource` para Manual;
 *   - sobreviva ao reconcile do seed (que ignora linhas 'anthropic');
 *   - NÃO congele o auto-refresh do preçário (um refresh futuro, também 'anthropic'
 *     e mais recente, volta a sobrepor-se naturalmente).
 *
 * Lê o estado live (GET /api/banks) e altera SÓ os campos indicados — nunca apaga
 * spreads existentes.
 *
 * Uso:
 *   BASE_URL=https://<host> ADMIN_TOKEN=<token> node scripts/apply-overrides.js [--dry-run]
 */
"use strict";

const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.ADMIN_TOKEN || "";
const DRY = process.argv.includes("--dry-run");

// Correcções por banco: spreads (campos a sobrepor) e/ou ltvBrackets (no registo do banco).
const CORRECTIONS = {
  CGD:   { spreads: { vRef: 12.54, mAno: 135.36, minutas: 202.80 } },
  SANTR: { spreads: { vRef: 10.58 } },
  NB:    { spreads: { vRef: 11.51, mAno: 148.09 } },
  ACTVO: { spreads: { vRef: 14.39 }, ltvBrackets: [{ max: 70, add: 0 }, { max: 80, add: 0 }, { max: 90, add: 0 }, { max: 100, add: 0.10 }] },
  CTT:   { spreads: { vRef: 16.13, sCom: 0.75, sSem: 1.35 }, ltvBrackets: [{ max: 100, add: 0 }] },
  UCI:   { spreads: { vRef: 16.88, mAno: 205.22 } },
  BCP:   { spreads: { sSem: 1.25 } },
};

async function main() {
  if (!BASE_URL || !TOKEN) {
    console.error("Define BASE_URL e ADMIN_TOKEN. Ex.:");
    console.error("  BASE_URL=https://exemplo.pt ADMIN_TOKEN=xxx node scripts/apply-overrides.js --dry-run");
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

    // Linha completa de spreads = live + correcções; origem 'anthropic' para ficar preferida.
    const spreads = { ...bank.spreads, ...corr.spreads, bank_code: code, source: "anthropic" };
    delete spreads.fetchedAt;

    // Corpo do POST: spreads sempre; bank só quando há ltvBrackets a alterar.
    const body = { spreads };
    if (corr.ltvBrackets) {
      body.bank = { ...bank, ltvBrackets: corr.ltvBrackets };
      delete body.bank.spreads; // o registo do banco não leva spreads aninhados
    }

    const changes = { ...corr.spreads, ...(corr.ltvBrackets ? { ltvBrackets: "(novo)" } : {}) };
    console.log(`${code}: source live='${bank.spreads.source}' → grava 'anthropic'  | ${JSON.stringify(changes)}`);

    if (DRY) continue;

    const pr = await fetch(BASE_URL + "/api/banks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify(body),
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
