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
  if (req.method !== "POST") return res.status(405).json({ error: "Método não suportado" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Demasiados pedidos — tenta mais tarde" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY nao configurada no Vercel" });

  const prompt = `Com base no teu conhecimento de treino, indica para cada banco português (CA, CTT, BNKTR, ABANCA, BCP, ACTVO, BPI, MNTPO, SANTR, NB, CGD, UCI, BIC, BNI): spread mínimo HPP com produtos (sCom) e sem produtos (sSem), prémio mensal de seguro vida para titular de 30 anos e capital de 150.000€ (vRef, em EUR), e prémio anual de seguro multirriscos para imóvel de 200.000€ (mAno, em EUR). Se não souberes algum valor exacto usa uma estimativa razoável. Responde APENAS com JSON puro (sem texto, sem markdown, sem explicações, sem comentários): {"CA":{"sCom":0.65,"sSem":1.65,"vRef":22.68,"mAno":160},"CTT":{"sCom":0.70,"sSem":1.30,"vRef":15.71,"mAno":170},"BNKTR":{"sCom":0.70,"sSem":1.05,"vRef":33.28,"mAno":196},"ABANCA":{"sCom":0.70,"sSem":1.70,"vRef":16.76,"mAno":154},"BCP":{"sCom":0.70,"sSem":1.25,"vRef":19.92,"mAno":256},"ACTVO":{"sCom":0.75,"sSem":1.50,"vRef":19.84,"mAno":256},"BPI":{"sCom":0.75,"sSem":1.50,"vRef":13.12,"mAno":195},"MNTPO":{"sCom":0.70,"sSem":1.50,"vRef":8.29,"mAno":79},"SANTR":{"sCom":0.80,"sSem":1.90,"vRef":22.55,"mAno":246},"NB":{"sCom":0.80,"sSem":1.50,"vRef":17.55,"mAno":98},"CGD":{"sCom":0.85,"sSem":1.35,"vRef":29.82,"mAno":110},"UCI":{"sCom":0.85,"sSem":1.30,"vRef":19.00,"mAno":150},"BIC":{"sCom":1.00,"sSem":1.50,"vRef":19.00,"mAno":150},"BNI":{"sCom":1.00,"sSem":1.50,"vRef":19.00,"mAno":150}}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
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
