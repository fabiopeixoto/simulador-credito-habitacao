const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");

const root = path.join(__dirname, "public");
const { fetchEuribor } = require(path.join(__dirname, "api", "euribor.js"));
const spreadsHandler = require(path.join(__dirname, "api", "spreads.js"));
const commentsHandler = require(path.join(__dirname, "api", "comments.js"));
const banksHandler = require(path.join(__dirname, "api", "banks.js"));
const statsHandler = require(path.join(__dirname, "api", "stats.js"));
const euriborHistoryHandler = require(path.join(__dirname, "api", "euribor-history.js"));
const faviconHandler = require(path.join(__dirname, "api", "favicon.js"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const cacheControlHeaders = {
  "/sw.js": "no-cache",
  "/manifest.json": "max-age=86400",
  "/og-image.svg": "max-age=31536000, immutable",
};

function getCacheControl(pathname, ext) {
  if (cacheControlHeaders[pathname]) return cacheControlHeaders[pathname];
  if ([".js", ".css", ".svg", ".json", ".png", ".jpg", ".jpeg", ".webmanifest", ".woff2", ".woff"].includes(ext)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=0, no-cache";
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getCompression(req, contentType) {
  if (!contentType) return null;
  const isCompressible =
    contentType.startsWith("text/") ||
    contentType.includes("javascript") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("svg");
  if (!isCompressible) return null;

  const accept = String(req.headers["accept-encoding"] || "").toLowerCase();
  if (accept.includes("br")) return "br";
  if (accept.includes("gzip")) return "gzip";
  return null;
}

function decorateResponse(res) {
  let sent = false;

  res.status = function (statusCode) {
    res.statusCode = statusCode;
    return res;
  };

  res.json = function (payload) {
    if (sent) return res;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    sent = true;
    return res;
  };

  res.send = function (payload) {
    if (sent) return res;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end(typeof payload === "string" ? payload : String(payload));
    sent = true;
    return res;
  };

  return res;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function runApiHandler(req, res, requestUrl, handler) {
  decorateResponse(res);
  req.query = Object.fromEntries(requestUrl.searchParams.entries());

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try {
      req.body = await readJsonBody(req);
    } catch (_) {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
  }

  return handler(req, res);
}

const SECURITY_HEADERS = {
  // Prevents framing by any origin (clickjacking protection)
  "X-Frame-Options": "DENY",
  // Disables MIME sniffing
  "X-Content-Type-Options": "nosniff",
  // Limits referrer info sent to third parties
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Disables browser features not needed by this app
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // Minimal CSP: blocks Flash/plugins and base-tag injection without breaking AdSense or inline scripts
  "Content-Security-Policy": "object-src 'none'; base-uri 'self'",
};

const server = http.createServer(async (req, res) => {
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname === "/api/euribor-history") {
      if (!["GET", "OPTIONS"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, euriborHistoryHandler);
    }

    if (pathname === "/api/spreads") {
      if (!["GET", "POST"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, POST", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, spreadsHandler);
    }

    if (pathname === "/api/comments") {
      if (!["GET", "POST", "PATCH", "DELETE", "OPTIONS"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, POST, PATCH, DELETE, OPTIONS", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, commentsHandler);
    }

    if (pathname === "/api/favicon") {
      if (req.method !== "GET") {
        res.writeHead(405, { Allow: "GET", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, faviconHandler);
    }

    if (pathname === "/api/banks") {
      if (!["GET", "POST", "PUT", "DELETE", "OPTIONS"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, POST, PUT, DELETE, OPTIONS", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, banksHandler);
    }

    if (pathname === "/api/stats") {
      if (!["GET", "DELETE", "OPTIONS"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, DELETE, OPTIONS", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, statsHandler);
    }

    let filePath = pathname === "/" ? "/index.html" : pathname;
    filePath = decodeURIComponent(filePath);
    const normalizedPath = path.normalize(filePath).replace(/^([/\\]+|\.\.\/?)+/, "");
    const fullPath = path.join(root, normalizedPath);

    if (!fullPath.startsWith(root)) {
      return sendJson(res, 400, { error: "Caminho inválido" });
    }

    const stat = await fs.promises.stat(fullPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return sendJson(res, 404, { error: "Não encontrado" });
    }

    if (req.method === "GET") {
      try {
        if (pathname === "/" || normalizedPath === "index.html") {
          statsHandler.recordHomepageView();
          const fwdFor = req.headers["x-forwarded-for"] || "";
          const realIp = req.headers["x-real-ip"] || "";
          const ip = fwdFor.split(",")[0]?.trim() || realIp || req.socket?.remoteAddress || "";
          if (ip) statsHandler.recordVisitorLocation(ip);
        } else if (normalizedPath === "admin.html") statsHandler.recordAdminPageView();
      } catch (_) {}
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = (pathname === "/LICENSE" ? "text/plain; charset=utf-8" : null) || mimeTypes[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": getCacheControl(pathname, ext),
    };

    const stream = fs.createReadStream(fullPath);
    const compression = getCompression(req, contentType);
    if (compression === "br") {
      headers["Content-Encoding"] = "br";
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      stream.pipe(zlib.createBrotliCompress()).pipe(res);
    } else if (compression === "gzip") {
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      stream.pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, headers);
      stream.pipe(res);
    }
    stream.on("error", (error) => {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Erro no servidor" }));
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Erro no servidor" });
  }
});

const EURIBOR_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h
const EURIBOR_STALE_MS  = 12 * 60 * 60 * 1000; // considera stale após 12h

async function refreshEuriborIfStale() {
  const banks = require(path.join(__dirname, "api", "banks.js"));
  const stored = banks.getEuribor ? banks.getEuribor() : null;
  if (stored && stored.fetchedAt && (Date.now() - stored.fetchedAt) < EURIBOR_STALE_MS) return;
  try {
    const { eur, eurLabel } = await fetchEuribor();
    if (banks.setEuribor) banks.setEuribor(eur, eurLabel);
    console.log("server: Euribor atualizada —", eurLabel);
  } catch (e) {
    console.warn("server: falha ao atualizar Euribor:", e.message);
  }
}

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  // Aguarda 5s para a BD inicializar antes do primeiro fetch
  setTimeout(() => {
    refreshEuriborIfStale();
    setInterval(refreshEuriborIfStale, EURIBOR_REFRESH_MS);
  }, 5000);
});
