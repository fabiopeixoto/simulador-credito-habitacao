// ── Upstash Redis ─────────────────────────────────────────────────────────
const kvAvailable = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

let kvClient = null;
if (kvAvailable) {
  try {
    const { Redis } = require("@upstash/redis");
    kvClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (_) {}
}

async function kvGet(key) {
  if (!kvClient) return null;
  try { return await kvClient.get(key); } catch (_) { return null; }
}

async function kvSet(key, value, opts = {}) {
  if (!kvClient) return false;
  try {
    if (opts.ex) await kvClient.set(key, value, { ex: opts.ex });
    else await kvClient.set(key, value);
    return true;
  } catch (_) { return false; }
}

const COMMENTS_KEY = "site:comments:v1";
const MAX_COMMENTS = 100;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    if (req.query && req.query.debug === "1") {
      const secret = process.env.DEBUG_SECRET;
      if (!secret || req.query.secret !== secret) return res.status(403).end();
      let pingErr = null, writeErr = null, readBack = null, currentCount = null;
      if (kvClient) {
        try { await kvClient.ping(); } catch (e) { pingErr = e.message; }
        try {
          await kvClient.set("debug:test", "ok", { ex: 60 });
          readBack = await kvClient.get("debug:test");
        } catch (e) { writeErr = e.message; }
        try {
          const list = await kvClient.get(COMMENTS_KEY);
          currentCount = Array.isArray(list) ? list.length : (list === null ? 0 : typeof list);
        } catch (e) { currentCount = "error: " + e.message; }
      }
      return res.status(200).json({
        kvAvailable,
        kvClient: !!kvClient,
        urlSet: !!process.env.UPSTASH_REDIS_REST_URL,
        tokenSet: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        pingErr,
        writeErr,
        readBack,
        currentCount,
      });
    }
    const list = (await kvGet(COMMENTS_KEY)) || [];
    return res.status(200).json(list);
  }

  if (req.method === "POST") {
    if (!kvClient) {
      return res.status(503).json({ error: "Base de dados não configurada. Adicione UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN nas env vars do Vercel." });
    }
    const { name, text, bank, simPt, realPt } = req.body || {};
    const t = typeof text === "string" ? text.trim() : "";
    if (t.length < 5 || t.length > 500) {
      return res.status(400).json({ error: "Comentário inválido (5–500 caracteres)" });
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

    return res.status(201).json(comment);
  }

  if (req.method === "DELETE") {
    const token = req.headers["x-admin-token"] || "";
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || token !== adminToken) {
      return res.status(403).json({ error: "Não autorizado" });
    }
    const id = (req.query && req.query.id) || "";
    if (!id) return res.status(400).json({ error: "ID em falta" });
    const existing = (await kvGet(COMMENTS_KEY)) || [];
    const updated = existing.filter(c => c.id !== id);
    const saved = await kvSet(COMMENTS_KEY, updated, { ex: 365 * 24 * 3600 });
    if (!saved) return res.status(500).json({ error: "Erro ao guardar" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
