// In-memory rate limiter — best-effort within a warm Vercel instance.
// Cross-instance limiting requires a persistent store (e.g. @vercel/kv).
const rateMap = new Map();
const WINDOW_MS = 60 * 60 * 1000; // 1 hora
const MAX_REQ   = 20;

function isRateLimited(ip) {
  const now = Date.now();
  for (const [k, v] of rateMap) if (now > v.reset) rateMap.delete(k);
  const entry = rateMap.get(ip) || { count: 0, reset: now + WINDOW_MS };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + WINDOW_MS; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count > MAX_REQ;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Demasiados pedidos — tenta mais tarde" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY nao configurada no Vercel" });

  const prompt = `Com base no teu conhecimento de treino, indica o spread mínimo típico de crédito habitação HPP (1.ª habitação) com produtos associados (domiciliação + seguros vida e multirriscos) para cada banco português: CA (Crédito Agrícola), CTT, Bankinter, Abanca, BCP (Millennium), ActivoBank, BPI, Montepio, Santander, NovoBanco, CGD (Caixa), UCI, BIC, BNI. Se não souberes o valor exacto de algum banco, usa uma estimativa razoável. Responde APENAS com JSON puro (sem texto, sem markdown, sem explicações, sem comentários): {"CA":{"sCom":0.65,"sSem":1.65},"CTT":{"sCom":0.70,"sSem":1.30},"BNKTR":{"sCom":0.70,"sSem":1.05},"ABANCA":{"sCom":0.70,"sSem":1.70},"BCP":{"sCom":0.70,"sSem":1.25},"ACTVO":{"sCom":0.75,"sSem":1.50},"BPI":{"sCom":0.75,"sSem":1.50},"MNTPO":{"sCom":0.70,"sSem":1.50},"SANTR":{"sCom":0.80,"sSem":1.90},"NB":{"sCom":0.80,"sSem":1.50},"CGD":{"sCom":0.85,"sSem":1.35},"UCI":{"sCom":0.85,"sSem":1.30},"BIC":{"sCom":1.00,"sSem":1.50},"BNI":{"sCom":1.00,"sSem":1.50}}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || "Erro API", status: response.status });
    }
    const data = await response.json().catch(() => null);
    if (!data) return res.status(502).json({ error: "Resposta inválida da API" });
    return res.status(200).json(data);
  } catch (err) {
    if (err.name === "TimeoutError") return res.status(504).json({ error: "Timeout: API demorou mais de 30s" });
    return res.status(500).json({ error: err.message });
  }
};
