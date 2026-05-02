module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "ANTHROPIC_API_KEY nao configurada no Vercel" });

  const hoje = new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const prompt = `Dados actuais de ${hoje}. Qual é o spread mínimo de crédito habitação HPP (1.ª habitação) com produtos associados (domiciliação + seguros vida e multirriscos) para cada banco português: CA (Crédito Agrícola), CTT, Bankinter, Abanca, BCP (Millennium), ActivoBank, BPI, Montepio, Santander, NovoBanco, CGD (Caixa), UCI, BIC, BNI? Responde APENAS com JSON puro (sem texto, sem markdown, sem explicações): {"CA":{"sCom":0.65,"sSem":1.65},"CTT":{"sCom":0.70,"sSem":1.30},"BNKTR":{"sCom":0.70,"sSem":1.05},"ABANCA":{"sCom":0.70,"sSem":1.70},"BCP":{"sCom":0.70,"sSem":1.25},"ACTVO":{"sCom":0.75,"sSem":1.50},"BPI":{"sCom":0.75,"sSem":1.50},"MNTPO":{"sCom":0.70,"sSem":1.50},"SANTR":{"sCom":0.80,"sSem":1.90},"NB":{"sCom":0.80,"sSem":1.50},"CGD":{"sCom":0.85,"sSem":1.35},"UCI":{"sCom":0.85,"sSem":1.30},"BIC":{"sCom":1.00,"sSem":1.50},"BNI":{"sCom":1.00,"sSem":1.50}}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, messages: [{ role: "user", content: prompt }] })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || "Erro API", status: response.status });
    }
    return res.status(200).json(await response.json());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
