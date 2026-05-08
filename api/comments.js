// ── KV (Vercel KV) ────────────────────────────────────────────────────────
const kvAvailable = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let kvClient = null;
if (kvAvailable) {
  try {
    const mod = require("@vercel/kv");
    kvClient = mod.kv || mod.default || mod;
  } catch (_) {}
}

async function kvGet(key) {
  if (!kvClient) return null;
  try { return await kvClient.get(key); } catch (_) { return null; }
}

async function kvSet(key, value, opts = {}) {
  if (!kvClient) return false;
  try { await kvClient.set(key, value, opts); return true; } catch (_) { return false; }
}

const COMMENTS_KEY = "site:comments:v1";
const MAX_COMMENTS = 100;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const list = (await kvGet(COMMENTS_KEY)) || [];
    return res.status(200).json(list);
  }

  if (req.method === "POST") {
    if (!kvClient) {
      return res.status(503).json({ error: "Base de dados não configurada. Ligue o Vercel KV no dashboard do projecto." });
    }
    const { name, text, bank, simPt, realPt } = req.body || {};
    const t = typeof text === "string" ? text.trim() : "";
    if (t.length < 5 || t.length > 500) {
      return res.status(400).json({ error: "Comentário inválido (5–500 caracteres)" });
    }

    // Rate limit: 1 comentário por 30 min por IP
    const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || "unknown";
    const rateKey = "comment:rate:" + Buffer.from(ip).toString("base64").slice(0, 24);
    const lastTs = await kvGet(rateKey);
    if (lastTs && Date.now() - Number(lastTs) < 30 * 60 * 1000) {
      return res.status(429).json({ error: "Aguarde 30 minutos antes de comentar novamente" });
    }

    const cleanNum = (v) => {
      const n = parseFloat(String(v).replace(",", "."));
      return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    };

    const comment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      ts: Date.now(),
      name: (typeof name === "string" ? name.trim().slice(0, 50) : "") || "Anónimo",
      text: t.slice(0, 500),
      bank: typeof bank === "string" && bank.trim() ? bank.trim().slice(0, 40) : null,
      simPt: cleanNum(simPt),
      realPt: cleanNum(realPt),
    };

    const existing = (await kvGet(COMMENTS_KEY)) || [];
    const updated = [comment, ...existing].slice(0, MAX_COMMENTS);
    await kvSet(COMMENTS_KEY, updated, { ex: 365 * 24 * 3600 });
    await kvSet(rateKey, String(Date.now()), { ex: 30 * 60 });

    return res.status(201).json(comment);
  }

  return res.status(405).json({ error: "Method not allowed" });
};
