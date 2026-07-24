const fs = require("fs");
const path = require("path");

const cacheDir = path.join(__dirname, "..", "data", "favicons");

// Allowlist of bank domains to prevent SSRF abuse. Deve espelhar BANK_DOMAINS
// em public/js/shared/inversa-bootstrap.js — os únicos domínios que o frontend
// pede a /api/favicon.
const ALLOWED_DOMAINS = new Set([
  "creditoagricola.pt", "ctt.pt", "bankinter.pt", "abanca.com",
  "millenniumbcp.pt", "activobank.pt", "bpi.pt", "bancomontepio.pt",
  "santander.pt", "novobanco.pt", "cgd.pt", "uci.es", "bnieuropa.pt",
]);

function safeDomain(raw) {
  const d = String(raw || "").toLowerCase().trim();
  // Allow only hostnames: letters, digits, dots, hyphens
  if (!/^[a-z0-9][a-z0-9.\-]{1,63}$/.test(d)) return null;
  if (!ALLOWED_DOMAINS.has(d)) return null;
  return d;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.writeHead(405); res.end(); return;
  }

  const domain = safeDomain(req.query && req.query.domain);
  if (!domain) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Domínio inválido ou não permitido" }));
    return;
  }

  const cacheFile = path.join(cacheDir, domain.replace(/[^a-z0-9.\-]/g, "_") + ".png");

  // Serve from cache if present
  if (fs.existsSync(cacheFile)) {
    const data = fs.readFileSync(cacheFile);
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=2592000, immutable",
      "Content-Length": data.length,
    });
    res.end(data);
    return;
  }

  // Fetch from Google server-side (only the server IP is sent, not the visitor's)
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(cacheFile, buf);
    res.writeHead(200, {
      "Content-Type": r.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=2592000, immutable",
      "Content-Length": buf.length,
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Favicon não disponível" }));
  }
};
