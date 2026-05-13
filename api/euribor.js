const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const BCE_BASE = "https://data-api.ecb.europa.eu/service/data/FM/";
const BCE_SERIES = {
  "3m":  "M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA",
  "6m":  "M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA",
  "12m": "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
};

function parseEuriborCSV(csv) {
  const lines = csv.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) throw new Error("CSV vazio");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  const dateIdx = headers.indexOf("TIME_PERIOD");
  const valIdx  = headers.indexOf("OBS_VALUE");
  if (dateIdx < 0 || valIdx < 0) throw new Error("Colunas não encontradas");
  const cols = lines[lines.length - 1].split(",").map(c => c.trim().replace(/"/g, ""));
  const val  = parseFloat(cols[valIdx]);
  const date = cols[dateIdx] || "";
  if (isNaN(val)) throw new Error("Valor inválido");
  return { val, date };
}

/**
 * Fetches the latest Euribor 3m/6m/12m rates from the ECB API.
 * Returns { eur: { "3m": number, "6m": number, "12m": number }, eurLabel: string }.
 * Throws if all three series fail.
 */
async function fetchEuribor(timeoutMs = 15000) {
  const eur = {};
  let eurLabel = "";
  const settled = await Promise.allSettled(
    Object.entries(BCE_SERIES).map(async ([key, series]) => {
      const r = await fetch(
        BCE_BASE + series + "?format=csvdata&lastNObservations=1",
        { signal: AbortSignal.timeout(timeoutMs) }
      );
      if (!r.ok) throw new Error("BCE " + key + " HTTP " + r.status);
      const { val, date } = parseEuriborCSV(await r.text());
      eur[key] = val;
      if (!eurLabel && date) {
        const [y, m] = date.split("-");
        eurLabel = (MESES[parseInt(m, 10) - 1] || m) + ". " + y;
      }
    })
  );
  if (settled.every(r => r.status === "rejected"))
    throw new Error(settled[0].reason?.message || "BCE indisponível");
  return { eur, eurLabel };
}

module.exports = { fetchEuribor };
